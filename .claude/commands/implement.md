---
name: implement
description: >
  Transforms validated specs and architecture into working, tested,
  committed code following clean code principles and design patterns.
  Use when user says "implement", "code this", "build the stories",
  or invokes /implement. Each user story gets its own commit.
  Requires validated /specs and /architecture as input.
  Consult references/clean-code-guidelines.md for code quality rules.
  Do NOT use for test-only work — use /qa-tests instead.
metadata:
  author: ALPHA10X
  version: 3.0.0
  category: development-pipeline
  tags: [implementation, coding, clean-code]
---

# Implement — Specs → Complete and Tested Code

Transform the validated specs and architecture into working, tested, committed code.

---

## Prerequisites

MANDATORY reading:

- `.product/specs/[slug]-specs.md` — Stories to implement
- `.product/architecture/[slug].md` — Technical blueprint
- CLAUDE.md (workspace root + repos) — Conventions
- `references/clean-code-guidelines.md` — SRP, patterns, sizes, anti-patterns, edge cases, logging, validation, security
- `references/domain-examples.md` — Endpoint, composite score, React component, enums, tests

Preflight → see `references/preflight-checklist.md`.

---

## IMPLEMENTATION RULES

### Zero placeholder

```
❌ FORBIDDEN : TODO, FIXME, pass, "implement later", NotImplementedError
✅ CORRECT  : Complete, working, tested code
```

### Follow the existing patterns

BEFORE writing code: look at how a similar module is built in the codebase, copy the pattern, adapt.

### Structured logging (never print)

→ See `references/clean-code-guidelines.md` section 8.

### Error handling

→ See `references/clean-code-guidelines.md` section 6.

---

## Your Mission

### For each User Story in the implementation order:

#### 0. Plan BEFORE writing

```
1. Which functions am I going to create? (names + signatures)
2. Does each function do ONE single thing? (SRP)
3. Is there existing code I can reuse?
4. Which design pattern should I apply? (Repository, Strategy, Factory...)
5. Which edge cases must I handle? (null, empty, NaN, limits)
```

#### 1. Write the code

- Follow the conventions in CLAUDE.md
- Type hints everywhere (Python API) / Strict TypeScript (Front)
- Handle the edge cases FIRST in each function
- Apply SRP: 1 function = 1 responsibility, max 20 lines of logic
- Explicit names, named constants (no magic numbers)

#### 2. Quality gates

→ Run the gates BEFORE testing — see `references/quality-gates.md` for the exact commands and thresholds.

#### 3. Test

```bash
# API — at minimum happy path + error case per endpoint
uv run pytest tests/unit/ --tb=short

# Front
npx vitest run
```

If the tests fail: analyze, fix, re-run. If it persists after 3 attempts → see `references/recovery-protocol.md`.

#### 4. Refactor pass

Before committing, verify:

- **Dead code**: unused imports, orphan functions/variables removed by the change
- **Size**: if the file exceeds 300 lines → split into sub-modules (separate `refactor:` commit)
- **Duplication**: code copy-pasted 3+ times → extract into a reusable function

```bash
uv run ruff check [modified files] --select F401,F811
wc -l [modified files]
```

#### 5. CHECKPOINT BEFORE COMMIT

```
"Final verification for US-N:
- [ ] Tests pass (no regression)
- [ ] Type check OK
- [ ] Quality gates clean code validated
- [ ] Complete code — no TODO/FIXME
- [ ] No dead code (imports, unused functions)
- [ ] No modified file > 300 lines

Ready to commit this story?"
```

**DO NOT commit without explicit validation.**

#### 6. Commit

```bash
git add [files of the story]
git commit -m "feat(eval-api): US-N — [short description]"
```

#### 7. Update pipeline-state.json

---

## API code conventions (Python)

```python
# Imports: stdlib → third-party → local
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_db, verify_token
from app.schemas.metrics import MetricResponse

# Type hints + Annotated dependencies
async def get_metric(
    metric_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _auth: Annotated[dict, Depends(verify_token)],
) -> MetricDetailResponse:
    """Get metric detail."""
    ...
```

## Front code conventions (TypeScript/React)

```tsx
// Props interface above component
interface MetricChartProps {
  metricId: string;
  history: MetricHistoryPoint[];
  greenThreshold: number;
  redThreshold: number;
}

// Named export, functional component
export function MetricChart({ metricId, history, greenThreshold, redThreshold }: MetricChartProps) {
  // Handle 4 states: loading, error, empty, populated
}
```

---

## Troubleshooting

→ See `references/recovery-protocol.md` for recovery cases after interruption or regression.

### Circular import

```
Symptom: ImportError: cannot import name 'X' from partially initialized module
1. Identify the loop: A imports B which imports A
2. Extract the common interface into a separate file
3. Use TYPE_CHECKING for type imports
4. Reorganize: models must never import services
```

### File too large (> 300 lines)

Identify the independent logical blocks, extract each block into its own file, re-export from `__init__.py`.

---

## Usage

```bash
/implement --feature [slug]
/implement --feature [slug] --story US-3
/implement --feature [slug] --mvp-only
```

## Next step

→ `/qa-tests --feature [slug]` to validate with the complete test pyramid.
