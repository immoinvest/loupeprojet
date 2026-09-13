# Clean Code Guidelines — ALPHA10X

Shared reference across `/implement`, `/architecture`, `/qa-tests` and `/bug-fix`.
Consult this file BEFORE writing any code.

---

## 1. Single Responsibility Principle (SRP)

Each function does **ONE thing only**. If the description requires "and", split into 2 functions.

```python
# ❌ God Function — does too many things
async def process_run(db, run_id):
    run = await db.get(Run, run_id)
    metrics = await fetch_metrics(run)
    scores = {}
    for m in metrics:
        result = await call_llm_judge(m)
        scores[m.id] = parse_llm_response(result)
    composite = sum(scores.values()) / len(scores)
    run.composite_score = composite
    run.status = "completed"
    await db.commit()
    await send_notification(run)
    return run

# ✅ Broken down — each function has a single job
async def evaluate_run(db: AsyncSession, run_id: str) -> Run:
    """Orchestrate run evaluation (coordination only)."""
    run = await fetch_run(db, run_id)
    metric_scores = await compute_all_metric_scores(db, run)
    composite = compute_composite_score(metric_scores)
    return await finalize_run(db, run, composite)

async def compute_all_metric_scores(db: AsyncSession, run: Run) -> dict[str, float]:
    """Evaluate each metric via LLM judge."""
    results = {}
    for metric in run.metrics:
        results[metric.id] = await evaluate_single_metric(metric)
    return results

def compute_composite_score(scores: dict[str, float]) -> float:
    """Weighted average of metric scores."""
    if not scores:
        return 0.0
    valid = {k: v for k, v in scores.items() if v is not None and math.isfinite(v)}
    if not valid:
        return 0.0
    return sum(valid.values()) / len(valid)

async def finalize_run(db: AsyncSession, run: Run, score: float) -> Run:
    """Persist final score and mark run as completed."""
    run.composite_score = score
    run.status = "completed"
    await db.commit()
    return run
```

### Indicators that a function does too much

- More than **20 lines** of logic (excluding docstring/imports) → decompose
- More than **3 levels of indentation** → extract the inner blocks
- The name contains "and" / "et" / "then" → 2 functions
- More than **4 parameters** → encapsulate in a dataclass/schema

---

## 2. File organization

### Size limits

| Element     | Limit                       | Action if exceeded                        |
| ----------- | --------------------------- | ----------------------------------------- |
| Function    | 20 lines of logic           | Extract into sub-functions                |
| Class       | 200 lines                   | Extract into sub-classes or mixins        |
| File        | 300 lines (excluding tests) | Split into sub-modules                    |
| Test module | 500 lines                   | Split by category (unit/edge/integration) |

### Domain-based structure

```text
✅ Our structure (layer-based, consistent):
app/
  services/metric_service.py      ← business logic
  api/rest/v1/metrics.py          ← HTTP layer
  schemas/metrics.py              ← validation
  db/models/metric.py             ← persistence

✅ Also OK (domain-based):
app/
  metrics/
    service.py
    routes.py
    schemas.py
    models.py

❌ FORBIDDEN:
app/
  helpers.py        ← catch-all
  utils.py          ← catch-all with no domain
  service.py        ← a single file for the whole app
```

### The helpers/utils file rule

If a helper is used by **1 service only** → put it in that service as a private function (`_helper`).
If used by **2+ services** → put it in `app/utils/` with an explicit name (`app/utils/score_math.py`, not `app/utils/helpers.py`).

---

## 3. Mandatory Design Patterns

### Repository Pattern — Isolate DB access

```python
# ❌ DB access directly in the route
@router.get("/metrics/{metric_id}")
async def get_metric(metric_id: str, db: ...):
    result = await db.execute(select(Metric).where(Metric.id == metric_id))
    metric = result.scalar_one_or_none()
    if not metric:
        raise HTTPException(404)
    return metric

# ✅ DB access isolated in the service
@router.get("/metrics/{metric_id}")
async def get_metric(metric_id: str, db: ...):
    return await metric_service.get_by_id(db, metric_id)

# In metric_service.py
async def get_by_id(db: AsyncSession, metric_id: str) -> MetricResponse:
    metric = await _fetch_metric(db, metric_id)
    if not metric:
        raise ResourceNotFoundError(f"Metric {metric_id} not found")
    return MetricResponse.model_validate(metric)
```

### Strategy Pattern — Algorithm variants

```python
# When we have different types of scoring, judges, or discovery types
from typing import Protocol

class ScoringStrategy(Protocol):
    def compute(self, raw_data: dict) -> float: ...

class WeightedAverageScoring:
    def __init__(self, weights: dict[str, float]):
        self.weights = weights

    def compute(self, raw_data: dict) -> float:
        total = sum(raw_data.get(k, 0) * w for k, w in self.weights.items())
        return total / sum(self.weights.values())

class ThresholdScoring:
    def compute(self, raw_data: dict) -> float:
        passed = sum(1 for v in raw_data.values() if v >= 0.75)
        return passed / len(raw_data) * 100 if raw_data else 0.0
```

### Factory Pattern — Creation of complex objects

```python
# ❌ Inline construction in the route
run = Run(
    id=uuid4(),
    use_case=data.use_case,
    status="pending",
    created_at=datetime.utcnow(),
    query_set_version=data.query_set_version,
    config=default_config(),
)

# ✅ Factory method in the model or the service
class Run(Base):
    @classmethod
    def create(cls, use_case: str, query_set_version: str) -> "Run":
        return cls(
            id=uuid4(),
            use_case=use_case,
            status="pending",
            created_at=datetime.utcnow(),
            query_set_version=query_set_version,
            config=default_config(),
        )
```

### Dependency Injection — Via FastAPI Depends

```python
# ✅ Always via Depends, never a direct import of a DB session
async def get_metric(
    metric_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _auth: Annotated[dict, Depends(verify_token)],
) -> MetricDetailResponse:
    ...
```

### FORBIDDEN Anti-patterns

| Anti-pattern          | Symptom                           | Correction                                |
| --------------------- | --------------------------------- | ----------------------------------------- |
| God Function          | 50+ lines, 5+ responsibilities    | Decompose into sub-functions              |
| Spaghetti Imports     | Circular imports between modules  | Extract a common interface, TYPE_CHECKING |
| Magic Numbers         | `if score > 75`, `limit=10`       | Named constants: `GREEN_THRESHOLD = 75`   |
| Copy-Paste            | 3+ occurrences of the same block  | Extract into a reusable function          |
| Stringly-Typed        | `status = "completed"` everywhere | Enum: `class RunStatus(str, Enum)`        |
| Catch-All             | `except Exception: pass`          | Specific exceptions, never silent         |
| Premature Abstraction | AbstractBaseFactory for 1 case    | YAGNI — abstract when 2+ cases exist      |

---

## 4. Readability

### Naming

```python
# ❌ Cryptic names
d = get_data()
tmp = process(d)
res = calc(tmp, 0.75)

# ✅ Names that tell the story
metric_history = fetch_metric_history(metric_id)
normalized_scores = normalize_to_percentage(metric_history)
composite_score = compute_weighted_average(normalized_scores, P0_WEIGHTS)
```

### One-liners: readability > conciseness

```python
# ✅ OK — simple and readable
active_metrics = [m for m in metrics if m.is_active]

# ✅ OK — simple ternary
label = "green" if score >= GREEN_THRESHOLD else "red"

# ❌ Too dense — unreadable
result = {k: [x.score for x in v if x.score > threshold] for k, v in grouped.items() if len(v) > min_count}

# ✅ Unrolled for readability
result = {}
for category, items in grouped.items():
    if len(items) <= min_count:
        continue
    result[category] = [x.score for x in items if x.score > threshold]

# ❌ Nested ternary
label = "green" if score >= 75 else "yellow" if score >= 50 else "red"

# ✅ Dict/match-case
SCORE_LABELS = [(75, "green"), (50, "yellow"), (0, "red")]

def get_score_label(score: float) -> str:
    for threshold, label in SCORE_LABELS:
        if score >= threshold:
            return label
    return "red"
```

### Named constants

```python
# ❌ Magic numbers
if score >= 75:
    color = "green"
elif score >= 50:
    color = "yellow"

# ✅ Explicit constants
GREEN_THRESHOLD = 75
YELLOW_THRESHOLD = 50

if score >= GREEN_THRESHOLD:
    color = "green"
elif score >= YELLOW_THRESHOLD:
    color = "yellow"
```

---

## 5. Handling edge cases

**RULE: Always handle edge cases FIRST** before the business logic.

```python
async def compute_composite_score(metrics: dict[str, float | None]) -> float:
    """Weighted average of P0 metrics → 0-100 scale."""
    # 1. Edge case: nothing
    if not metrics:
        return 0.0

    # 2. Edge case: only nulls/NaN/Infinity
    valid = {
        k: v for k, v in metrics.items()
        if v is not None and math.isfinite(v)
    }
    if not valid:
        return 0.0

    # 3. Happy path
    weighted_sum = sum(valid[k] * P0_WEIGHTS.get(k, 1.0) for k in valid)
    total_weight = sum(P0_WEIGHTS.get(k, 1.0) for k in valid)
    return round(weighted_sum / total_weight, 2)
```

### Edge case checklist by type

| Input type              | Cases to handle                                                       |
| ----------------------- | --------------------------------------------------------------------- |
| Collection (list, dict) | Empty, None, a single element, very large (10K+)                      |
| Number (int, float)     | 0, negative, NaN, Infinity, -Infinity, exactly at the threshold       |
| String                  | Empty `""`, None, very long (10K chars), unicode/emoji, SQL injection |
| UUID                    | Invalid ("not-a-uuid"), valid but nonexistent in DB                   |
| Date/timestamp          | None, epoch (1970), distant future, timezone mismatch                 |
| DB relation             | Orphan (parent deleted), circular, null FK                            |

---

## 6. Error Handling

### Service layer pattern

```python
from sqlalchemy.exc import SQLAlchemyError

async def get_metric_detail(db: AsyncSession, metric_id: str) -> MetricDetail:
    """Fetch metric with full detail. Raises ResourceNotFoundError if absent."""
    try:
        metric = await _fetch_metric(db, metric_id)
    except SQLAlchemyError as e:
        logger.error("DB query failed", metric_id=metric_id, error=str(e))
        raise DatabaseError(f"Failed to fetch metric: {e!s}") from e

    if metric is None:
        raise ResourceNotFoundError(f"Metric {metric_id} not found")

    return MetricDetail.from_orm(metric)
```

### Rules

- **Never** `except Exception` in services — use `SQLAlchemyError` for DB errors
- **Never** `except Exception: pass` (silent)
- **Never** `# type: ignore` without a comment explaining why
- **Always** `raise ... from e` to preserve the stack trace
- **Always** log the error BEFORE propagating it
- Business errors (not found, validation) → custom exceptions, not HTTPException in the services

---

## 7. Imports

```python
# Strict order: stdlib → third-party → local
import math
import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_db, verify_token
from app.db.models.metric import Metric
from app.schemas.metrics import MetricResponse
```

- One import per line for local imports (eases git diffs)
- `TYPE_CHECKING` for circular type imports
- No `*` import — always explicit

---

## 8. Secure logging

### Rules

```text
1. NEVER print() — use structlog exclusively
2. NEVER log secrets, tokens, passwords, PII (emails, names)
3. ALWAYS log opaque identifiers (run_id, metric_id), not data
4. ALWAYS log errors BEFORE propagating them
5. Semantic log levels (not everything at info)
```

### Patterns

```python
from app.logging import get_logger
logger = get_logger(__name__)

# Log levels — when to use each
logger.debug("Query details", sql=str(stmt), params=params)    # Dev only
logger.info("Run created", run_id=str(run.id), use_case=uc)    # Business events
logger.warning("LLM timeout", metric_id=mid, attempt=2, max=3) # Degradation
logger.error("DB query failed", error=str(e), table="metrics") # Recoverable error
logger.critical("Auth0 JWKS unreachable", url=jwks_url)        # System error

# FORBIDDEN — sensitive data in the logs
logger.info("User auth", token=jwt_token)           # Token in the logs
logger.info("Login", email=user.email)               # PII
logger.error("Failed", password=user_password)        # Secret
logger.debug("API call", api_key=settings.api_key)    # API key
```

### Error messages — client/server separation

```python
# The CLIENT receives a generic message
raise HTTPException(
    status_code=500,
    detail="An internal error occurred. Please try again.",
)

# The SERVER logs the technical detail
logger.error(
    "Composite score computation failed",
    run_id=str(run.id),
    error=str(e),
    metric_count=len(metrics),
)

# FORBIDDEN — stack trace or technical detail in the HTTP response
raise HTTPException(
    status_code=500,
    detail=f"SQLAlchemy error: {e}\n{traceback.format_exc()}"  # NEVER
)
```

---

## 9. Input validation — defense in depth

### System boundary = strict validation

```python
# ANY input that crosses a system boundary must be validated

# HTTP boundary → Pydantic
class CreateRunRequest(BaseModel):
    use_case: str = Field(..., min_length=1, max_length=100)
    query: str = Field(..., min_length=1, max_length=10_000)
    limit: int = Field(default=20, ge=1, le=100)

# LLM boundary → parsing + validation
def parse_llm_judge_response(raw: str) -> JudgeResult:
    try:
        data = json.loads(raw)
        return JudgeResult.model_validate(data)
    except (json.JSONDecodeError, ValidationError) as e:
        logger.warning("Invalid LLM response", error=str(e))
        return JudgeResult(score=None, status="error", reason=str(e))

# DB boundary → ORM (no raw SQL with variables)
stmt = select(Metric).where(Metric.id == metric_id)  # OK
```

### Internal code = trust it

```python
# Between internal modules, do NOT re-validate if already validated upstream
# The service trusts the Pydantic schema that has already validated

async def create_run(db: AsyncSession, data: CreateRunRequest) -> Run:
    # data is already validated by Pydantic — no need to re-check
    run = Run.create(use_case=data.use_case, query=data.query)
    db.add(run)
    await db.commit()
    return run
```

---

## 10. Security of external dependencies

### LLM (Claude, OpenAI) — treat as untrusted

```python
# LLM responses are UNTRUSTED content
# Never eval(), exec(), or SQL/HTML interpolation

# OK — parse and validate with a schema
parsed = json.loads(llm_response)
validated = ResponseSchema.model_validate(parsed)

# OK — log for debugging
logger.debug("LLM raw response", response=llm_response[:500])

# CRITICAL — direct execution
eval(llm_response)                                    # NEVER
text(f"INSERT INTO results VALUES ('{llm_response}')")  # NEVER
```

### External APIs — resilience

```python
# Mandatory timeouts
async with httpx.AsyncClient(timeout=30.0) as client:
    response = await client.get(url)

# Retry with backoff
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
async def call_external_api(url: str) -> dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.json()
```
