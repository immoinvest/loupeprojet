# Concrete Examples — ALPHA10X Evaluation Domain

Implementation examples for the common patterns of the evaluation platform.
Referenced by `/implement`, `/architecture` and `/qa-tests`.

---

## 1. Adding a metric endpoint (complete pattern)

### Service (responsibility: business logic)

```python
# app/services/metric_service.py

from app.db.models.metric import Metric, MetricResult
from app.schemas.metrics import MetricDetailResponse, MetricHistoryPoint

# Named constants — no magic numbers
GREEN_THRESHOLD = 75.0
YELLOW_THRESHOLD = 50.0
MIN_TREND_POINTS = 2


async def get_metric_detail(
    db: AsyncSession, metric_id: str
) -> MetricDetailResponse:
    """Fetch metric with history and thresholds."""
    metric = await _fetch_metric(db, metric_id)
    history = await _fetch_history(db, metric_id)
    trend = _compute_trend(history)
    return MetricDetailResponse(
        metric=metric,
        history=history,
        trend=trend,
        color=_get_score_label(metric.current_value),
    )


# --- Private helpers (prefix _) ---

async def _fetch_metric(db: AsyncSession, metric_id: str) -> Metric:
    """Fetch single metric or raise ResourceNotFoundError."""
    result = await db.execute(select(Metric).where(Metric.id == metric_id))
    metric = result.scalar_one_or_none()
    if metric is None:
        raise ResourceNotFoundError(f"Metric {metric_id} not found")
    return metric


async def _fetch_history(
    db: AsyncSession, metric_id: str
) -> list[MetricHistoryPoint]:
    """Fetch metric history sorted by date."""
    result = await db.execute(
        select(MetricResult)
        .where(MetricResult.metric_id == metric_id)
        .order_by(MetricResult.evaluated_at.asc())
    )
    return [MetricHistoryPoint.model_validate(r) for r in result.scalars()]


def _compute_trend(history: list[MetricHistoryPoint]) -> float | None:
    """Compute trend from history. None if < 2 points."""
    if len(history) < MIN_TREND_POINTS:
        return None
    recent = history[-1].value
    previous = history[-2].value
    if previous == 0:
        return None
    return round((recent - previous) / previous * 100, 2)


def _get_score_label(score: float | None) -> str:
    """Map score to color label. Handles None/NaN/Infinity."""
    if score is None or not math.isfinite(score):
        return "gray"
    if score >= GREEN_THRESHOLD:
        return "green"
    if score >= YELLOW_THRESHOLD:
        return "yellow"
    return "red"
```

### Route (responsibility: HTTP layer)

```python
# app/api/rest/v1/metrics.py

@router.get("/metrics/{metric_id}", response_model=MetricDetailResponse)
async def get_metric(
    metric_id: Annotated[str, Path(description="UUID of the metric")],
    db: Annotated[AsyncSession, Depends(get_db)],
    _auth: Annotated[dict, Depends(verify_token)],
) -> MetricDetailResponse:
    """Get metric detail with history and trend."""
    return await metric_service.get_metric_detail(db, metric_id)
```

### Schema (responsibility: validation)

```python
# app/schemas/metrics.py

class MetricDetailResponse(BaseModel):
    """Full metric detail with history."""
    metric: MetricSummary
    history: list[MetricHistoryPoint]
    trend: float | None = None
    color: str

    model_config = ConfigDict(from_attributes=True)


class MetricHistoryPoint(BaseModel):
    value: float
    evaluated_at: datetime
    run_id: str
```

---

## 2. Composite Score (pattern: edge cases first)

```python
# app/services/scoring_service.py

import math
from app.constants import P0_METRIC_WEIGHTS


def compute_composite_score(metrics: dict[str, float | None]) -> float:
    """Weighted average of P0 metrics → 0-100 scale.

    Handles gracefully:
    - Empty dict → 0.0
    - All None values → 0.0
    - NaN/Infinity values → filtered out
    - Mix of valid/invalid → computed on valid only
    """
    # 1. Edge case: nothing
    if not metrics:
        return 0.0

    # 2. Filter out invalid values (None, NaN, Infinity)
    valid_metrics = {
        k: v for k, v in metrics.items()
        if v is not None and math.isfinite(v)
    }

    # 3. Edge case: no usable value
    if not valid_metrics:
        return 0.0

    # 4. Happy path: weighted average
    weighted_sum = sum(
        valid_metrics[k] * P0_METRIC_WEIGHTS.get(k, 1.0)
        for k in valid_metrics
    )
    total_weight = sum(
        P0_METRIC_WEIGHTS.get(k, 1.0)
        for k in valid_metrics
    )

    return round(weighted_sum / total_weight, 2)
```

---

## 3. Dashboard use case card (pattern: 4 UI states)

```tsx
// src/components/UseCaseCard.tsx

interface UseCaseCardProps {
  useCase: UseCase;
  healthDrivers: HealthDriver[];
  compositeScore: number | null;
}

export function UseCaseCard({ useCase, healthDrivers, compositeScore }: UseCaseCardProps) {
  // Handle 4 states: loading, error, empty, populated
  if (useCase.status === 'loading') {
    return <UseCaseCardSkeleton />;
  }

  if (useCase.status === 'error') {
    return <UseCaseCardError message={useCase.errorMessage} />;
  }

  if (compositeScore === null) {
    return <UseCaseCardEmpty useCase={useCase} />;
  }

  // Populated state
  const color = getScoreColor(compositeScore);

  return (
    <Card className={`border-l-4 border-l-${color}`}>
      <CardHeader>
        <h3>{useCase.name}</h3>
        <ScoreBadge score={compositeScore} color={color} />
      </CardHeader>
      <CardBody>
        <HealthDriverDots drivers={healthDrivers} />
      </CardBody>
    </Card>
  );
}

// Extracted helper — not inline in the component
function getScoreColor(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 75) return 'green';
  if (score >= 50) return 'yellow';
  return 'red';
}
```

---

## 4. Enum for statuses (no magic strings)

```python
# app/db/models/enums.py

from enum import Enum


class RunStatus(str, Enum):
    """Status lifecycle: pending → running → completed/failed."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class MetricPriority(str, Enum):
    """P0 = must-have for launch, P1 = important, P2 = nice-to-have."""
    P0 = "P0"
    P1 = "P1"
    P2 = "P2"


class HealthDriver(str, Enum):
    TRUST = "trust"
    COVERAGE = "coverage"
    SPEED = "speed"
    ACCURACY = "accuracy"
    CONSISTENCY = "consistency"


class ScoreColor(str, Enum):
    GREEN = "green"    # >= 75
    YELLOW = "yellow"  # >= 50
    RED = "red"        # < 50
    GRAY = "gray"      # no data
```

---

## 5. Complete test of an endpoint (recommended pattern)

```python
# tests/narrow-int/test_metric_endpoint.py

import pytest
from httpx import AsyncClient


class TestGetMetricDetail:
    """Tests for GET /rest/v1/metrics/{metric_id}."""

    # --- Happy path ---

    async def test_returns_metric_with_history(self, client: AsyncClient, seeded_metric):
        response = await client.get(f"/rest/v1/metrics/{seeded_metric.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["metric"]["id"] == str(seeded_metric.id)
        assert isinstance(data["history"], list)
        assert data["color"] in ("green", "yellow", "red", "gray")

    # --- Error cases ---

    async def test_not_found(self, client: AsyncClient):
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = await client.get(f"/rest/v1/metrics/{fake_id}")
        assert response.status_code == 404

    async def test_invalid_uuid(self, client: AsyncClient):
        response = await client.get("/rest/v1/metrics/not-a-uuid")
        assert response.status_code == 422

    async def test_requires_auth(self, unauthenticated_client: AsyncClient):
        response = await unauthenticated_client.get("/rest/v1/metrics/any-id")
        assert response.status_code in (401, 403)

    # --- Edge cases ---

    async def test_metric_with_no_history(self, client: AsyncClient, metric_no_history):
        response = await client.get(f"/rest/v1/metrics/{metric_no_history.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["history"] == []
        assert data["trend"] is None

    async def test_metric_with_single_history_point(self, client: AsyncClient, metric_one_point):
        response = await client.get(f"/rest/v1/metrics/{metric_one_point.id}")
        data = response.json()
        assert len(data["history"]) == 1
        assert data["trend"] is None  # Not enough points for a trend

    async def test_metric_with_null_score(self, client: AsyncClient, metric_null_score):
        response = await client.get(f"/rest/v1/metrics/{metric_null_score.id}")
        assert response.status_code == 200
        assert response.json()["color"] == "gray"

    # --- SQL injection attempt ---

    async def test_sql_injection_in_path(self, client: AsyncClient):
        response = await client.get("/rest/v1/metrics/'; DROP TABLE--")
        assert response.status_code == 422
```
