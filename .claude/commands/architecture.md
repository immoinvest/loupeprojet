---
name: architecture
description: >
  Designs the complete technical blueprint before writing any code:
  file inventory, interfaces, data flow, design patterns, ADRs,
  and implementation order respecting dependencies.
  Use when user says "design the architecture", "technical design",
  "plan the implementation", or invokes /architecture.
  Requires validated /specs as input. Consult references/clean-code-guidelines.md
  for pattern selection.
  Do NOT use for writing code — use /implement after architecture is validated.
metadata:
  author: ALPHA10X
  version: 3.0.0
  category: development-pipeline
  tags: [architecture, design, patterns, adr]
---

# Architecture — Technical Design

Complete technical blueprint BEFORE writing a single line of code.

---

## Prerequisites

MANDATORY reading:

- `.product/specs/[slug]-specs.md` and `.product/features/[slug]-discovery.md`
- CLAUDE.md (workspace root + repos) — Structure, conventions, patterns
- .product/ (architecture-overview, technical-spec)
- `references/clean-code-guidelines.md` — Pattern catalogue (Repository, Strategy, Factory, DI)

Examine the existing patterns in the code: `evaluation-api/app/` (services, models, routes, auth).

---

## Your Mission

### Step 1: Analyze the existing codebase

- Which existing modules can be reused?
- Which patterns are already established? (do not reinvent)
- Are there any conflicts with the existing code?

### Step 2: List the files to create/modify

```
Files to CREATE:
- app/db/models/xxx.py           — SQLAlchemy model
- app/schemas/xxx.py             — Pydantic schemas
- app/services/xxx_service.py    — Business logic
- app/api/rest/v1/xxx.py         — Routes
- tests/unit/test_xxx.py         — Unit tests
- alembic/versions/xxx_*.py      — Migration

Files to MODIFY:
- app/main.py                    — Register router
```

### Step 3: Identify the Design Patterns

→ Consult `references/clean-code-guidelines.md` section 3 for the complete catalogue.
→ See `references/domain-examples.md` for concrete implementations.

For each module:

1. **Which pattern?** Repository (ALWAYS for DB), Strategy (if variants), Factory (if complex objects), DI via Depends (ALWAYS)
2. **SRP breakdown?** 1 function = 1 job, max 20 lines. If "and" in the name → 2 functions. If > 4 params → dataclass/schema
3. **Public interface?** Max 5-7 public methods per service. Internal helpers prefixed `_`. No DB access in the routes.

### Step 4: Data flow

```
Input (HTTP request)
  → Route handler (Pydantic validation)
    → Service layer (business logic)
      → ORM queries (SQLAlchemy async)
      ← Results
    ← Response model
  ← HTTP response (JSON)
```

### Step 5: Architectural decisions (ADR)

If a non-trivial choice is made:

```
ADR-XXX: [Title]
Context: [Why]
Decision: [What we chose]
Consequences: [Impact]
Alternatives considered: [What we did not choose and why]
```

### Step 6: Implementation order

```
1. Models + Migration (foundation)
2. Schemas (depend on the models)
3. Services (depend on the models + schemas)
4. Routes (depend on the services + schemas)
5. Tests (depend on everything)
```

### Step 7: Pre-implementation checklist

- [ ] No conflict with the existing code
- [ ] Patterns consistent with the codebase
- [ ] Reversible migrations (up + down)
- [ ] No breaking change on the existing endpoints
- [ ] Optimized queries (no N+1)
- [ ] Inputs validated, auth applied
- [ ] Design patterns identified for each module
- [ ] Each service max 5-7 public methods
- [ ] No method that does "and" in its name (SRP)
- [ ] No planned file > 300 lines
- [ ] Edge cases listed for each service

---

## Output

Create the file `.product/architecture/[slug].md` with the complete blueprint.

---

## MANDATORY CHECKPOINT

```
"Here is the technical design:
- X files to create, Y files to modify
- Implementation order: [list]
- ADR: [key decisions]
- Identified risks: [list]

Shall we start the implementation?"
```

**DO NOT proceed without explicit validation.**

---

## Usage

```bash
/architecture --feature [slug]
```
