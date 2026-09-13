---
name: qa-tests
description: >
  Validates code quality through the full test pyramid: 70% unit,
  20% integration, 10% E2E. Includes vicious edge cases, boundary
  values, concurrency, corrupted data, and malicious inputs.
  Use when user says "run tests", "write tests", "QA", "validate quality",
  or invokes /qa-tests.
  Do NOT use for security-specific audits — use /security-audit instead.
metadata:
  author: ALPHA10X
  version: 3.0.0
  category: development-pipeline
  tags: [testing, qa, edge-cases, coverage]
---

# QA Tests — Quality Validation

Full test pyramid: unit → integration → edge cases.

---

## Prerequisites

- `.product/specs/[slug]-specs.md` — Gherkin acceptance criteria
- CLAUDE.md (repos) — Testing conventions

## Coverage and quality objectives

→ See `references/quality-gates.md` for the coverage table by file type and the test quality criteria.

---

## Test pyramid

```
        ┌─────────┐
        │   E2E   │  10% — Critical smoke tests
        ├─────────┤
        │  Integ  │  20% — API endpoints, complete workflows
        ├─────────┤
        │  Unit   │  70% — Pure business logic, services, utils
        └─────────┘
```

---

## Your Mission

### Step 1: Inventory the test cases from the specs

For each User Story:

- Transform the Gherkin scenarios into test cases
- Add the edge cases not covered by the specs
- Identify the security cases (auth, validation)

### Step 2: Unit tests (70%)

```python
class TestCompositeScore:
    def test_all_perfect_scores(self):
        values = {"precision_at_k": 1.0, "recall_at_k": 1.0}
        assert compute_composite_score(values) == 100.0

    def test_empty_metrics(self):
        assert compute_composite_score({}) == 0.0
```

### Step 3: Integration tests (20%)

```python
@pytest.mark.narrow_int
async def test_create_run(client, sample_run_data):
    response = await client.post("/rest/v1/runs", json=sample_run_data)
    assert response.status_code == 201
    assert "run_id" in response.json()
```

### Step 4: Vicious edge cases — "Stress the happy path"

**MANDATORY**: For each endpoint/service, cover ALL these categories.

#### 4a. Boundary values (boundary testing)

```python
class TestScoreThresholds:
    def test_exactly_on_green_threshold(self):
        assert get_score_label(75.0) == "green"

    def test_just_below_green(self):
        assert get_score_label(74.9999) == "yellow"

    def test_exactly_on_yellow_threshold(self):
        assert get_score_label(50.0) == "yellow"

    def test_zero_score(self):
        assert get_score_label(0.0) == "red"

    def test_negative_score(self):
        assert get_score_label(-1.0) == "red"

    def test_score_above_100(self):
        assert get_score_label(105.0) == "green"
```

#### 4b. Toxic values (NaN, Infinity, None)

```python
class TestToxicValues:
    def test_nan_in_composite(self):
        assert compute_composite_score({"precision": float("nan")}) == 0.0

    def test_infinity_in_composite(self):
        assert compute_composite_score({"precision": float("inf")}) == 0.0

    def test_all_none_metrics(self):
        assert compute_composite_score({"precision": None, "recall": None}) == 0.0

    def test_mix_valid_and_none(self):
        result = compute_composite_score({"precision": 0.8, "recall": None})
        assert result > 0
```

#### 4c. Empty and minimal collections

```python
class TestEmptyStates:
    async def test_dashboard_no_runs(self, client):
        response = await client.get("/rest/v1/dashboard")
        assert response.status_code == 200
        assert response.json()["use_cases"] == []

    async def test_metric_history_empty(self, client, metric_id):
        response = await client.get(f"/rest/v1/metrics/{metric_id}/history")
        assert response.status_code == 200
        assert response.json()["trend"] is None

    async def test_metric_history_single_point(self, client, metric_id):
        response = await client.get(f"/rest/v1/metrics/{metric_id}/history")
        assert response.json()["trend"] is None
```

#### 4d. Malicious inputs (injection, overflow)

```python
class TestMaliciousInputs:
    async def test_sql_injection_in_path(self, client):
        response = await client.get("/rest/v1/metrics/'; DROP TABLE metrics;--")
        assert response.status_code == 422

    async def test_uuid_invalid_format(self, client):
        response = await client.get("/rest/v1/metrics/not-a-uuid")
        assert response.status_code == 422

    async def test_uuid_valid_but_nonexistent(self, client):
        fake_uuid = "00000000-0000-0000-0000-000000000000"
        response = await client.get(f"/rest/v1/metrics/{fake_uuid}")
        assert response.status_code == 404

    async def test_extremely_long_string(self, client):
        response = await client.post("/rest/v1/runs", json={"query": "a" * 100_000})
        assert response.status_code == 422

    async def test_empty_body(self, client):
        response = await client.post("/rest/v1/runs", json={})
        assert response.status_code == 422
```

#### 4e. Abusive pagination and filters

```python
class TestPaginationAbuse:
    async def test_page_negative(self, client):
        response = await client.get("/rest/v1/metrics?page=-1")
        assert response.status_code == 422

    async def test_page_absurdly_high(self, client):
        response = await client.get("/rest/v1/metrics?page=999999")
        assert response.status_code == 200
        assert response.json()["items"] == []

    async def test_limit_million(self, client):
        response = await client.get("/rest/v1/metrics?limit=1000000")
        assert response.status_code == 422
```

#### 4f. Concurrency and double submission

```python
class TestConcurrency:
    async def test_double_run_creation(self, client, sample_data):
        r1 = await client.post("/rest/v1/runs", json=sample_data)
        r2 = await client.post("/rest/v1/runs", json=sample_data)
        assert r1.status_code == 201
        assert r2.status_code in (201, 409)  # Not 500
```

#### 4g. Corrupted data in DB

```python
class TestCorruptedData:
    async def test_metric_with_null_score_in_composite(self, db, run_with_null_scores):
        score = await compute_run_composite(db, run_with_null_scores.id)
        assert score == 0.0

    async def test_orphan_metric_result(self, db, orphan_result):
        results = await list_all_results(db)
        assert orphan_result.id not in [r.id for r in results]
```

#### 4h. Auth and security

```python
class TestAuthEdgeCases:
    async def test_expired_token(self, client_with_expired_token):
        response = await client_with_expired_token.get("/rest/v1/metrics")
        assert response.status_code in (401, 403)

    async def test_malformed_token(self, client):
        response = await client.get("/rest/v1/metrics",
                                     headers={"Authorization": "Bearer not.a.jwt"})
        assert response.status_code in (401, 403)

    async def test_no_auth_on_protected_endpoint(self, unauthenticated_client):
        response = await unauthenticated_client.get("/rest/v1/metrics")
        assert response.status_code in (401, 403)

    async def test_health_needs_no_auth(self, unauthenticated_client):
        response = await unauthenticated_client.get("/health")
        assert response.status_code == 200
```

#### 4j. Property-based testing

Use Hypothesis (Python) or fast-check (TS) to generate random inputs and find unexpected edge cases.

```python
from hypothesis import given, strategies as st

@given(score=st.floats(allow_nan=True, allow_infinity=True))
def test_composite_score_never_crashes(score):
    result = compute_composite_score({"metric": score})
    assert isinstance(result, float)
    assert math.isfinite(result)
```

#### 4k. Snapshot testing

Verify the stability of the API schemas (response shapes) with snapshots.

```python
def test_dashboard_response_shape(client, snapshot):
    response = client.get("/rest/v1/dashboard")
    assert response.json() == snapshot
```

#### 4l. Contract testing

Verify the frontend/backend compatibility (shared schemas, generated types).

```python
def test_metric_response_matches_typescript_type(sample_metric_response):
    """Validate that the API response matches the shared schema."""
    MetricResponse.model_validate(sample_metric_response)
```

#### 4i. External dependencies (LLM, ALPHA10X API)

```python
class TestExternalDependencyFailures:
    async def test_llm_returns_malformed_json(self, mock_llm_malformed):
        result = await evaluate_single_metric(metric, judge=mock_llm_malformed)
        assert result.status == "error"
        assert result.score is None

    async def test_llm_timeout(self, mock_llm_timeout):
        result = await evaluate_single_metric(metric, judge=mock_llm_timeout)
        assert result.status in ("error", "timeout")

    async def test_alpha10x_api_rate_limited(self, mock_api_429):
        with pytest.raises(RateLimitError):
            await fetch_companies(query="medtech europe")
```

### Step 5: Run and verify

```bash
# API
uv run pytest tests/unit/ -v --tb=short --cov=app --cov-report=term-missing
uv run pytest tests/narrow-int/ -v --tb=short  # if Postgres available

# Front
npx vitest run --coverage
```

### Step 6: Report

```markdown
## Test Results

### Results

- Total: XX tests — Passed: XX ✓ — Failed: XX ✗

### Critical cases covered

- [ ] Happy path all endpoints
- [ ] Validation errors (422)
- [ ] Resource not found (404)
- [ ] Auth required (401)
- [ ] Business edge cases
```

---

## Troubleshooting

### Flaky tests (pass 1 time out of 2)

1. Execution order → each test creates its own data (isolated fixtures)
2. Timestamps → freezegun or mock of the clock
3. Async race condition → verify that all DB calls are awaited
4. DB state leaking → transaction rollback in the fixture

### Fixtures that don't work

1. Scope mismatch: "session" fixture used in a "function" test
2. Missing import in conftest.py
3. Async fixture without `@pytest_asyncio.fixture`

### Tests too slow (> 30 seconds)

1. `pytest --durations=10` to identify the slowest ones
2. Unit tests MUST NOT touch the DB → mock
3. Parallelize: `pytest -n auto` (pytest-xdist)

---

## Usage

```bash
/qa-tests                          # Full tests
/qa-tests --feature [slug]         # Tests for one feature
/qa-tests --unit-only              # Only the unit tests
/qa-tests --coverage               # With coverage report
```

## Next step

→ `/security-audit --feature [slug]` to audit the vulnerabilities.
