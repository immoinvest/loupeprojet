---
name: specs
description: >
  Transforms validated discovery into implementable specifications:
  Epics, User Stories with Gherkin acceptance criteria, API contracts,
  data models, and MoSCoW prioritization.
  Use when user says "write specs", "create user stories",
  "define acceptance criteria", or invokes /specs.
  Requires a completed /feature-discovery document as input.
  Do NOT use for architecture or implementation — use /architecture or /implement.
metadata:
  author: ALPHA10X
  version: 3.0.0
  category: development-pipeline
  tags: [specs, user-stories, requirements]
---

# Specs — Technical Specifications and User Stories

Transform the validated discovery into implementable specifications.

→ Consult references/domain-examples.md for concrete examples from the ALPHA10X domain.

---

## Prerequisites

MANDATORY reading:

- `.product/features/[slug]-discovery.md` — Validated discovery
- CLAUDE.md (workspace root + repos) — Data model, endpoints, conventions
- .product/ (functional-spec, technical-spec) — Current spec

---

## Your Mission

### Step 1: Define the Epics (max 3)

Group the discovery outputs into logical epics.

### Step 2: Create the User Stories

For each epic:

```
**US-[N]: [Title]**
As a [persona],
I want [action],
So that [benefit].

Priority: P0 (Must) / P1 (Should) / P2 (Could)
Effort: XS (<2h) / S (2-4h) / M (4-8h) / L (1-2d) / XL (2-5d)
```

### Step 3: Acceptance criteria (Gherkin)

For each user story, at minimum 3 scenarios:

```gherkin
Scenario: Nominal case
  Given [context]
  When [action]
  Then [expected result]

Scenario: Error case
  Given [context]
  When [invalid action]
  Then [expected error]

Scenario: Edge case
  Given [edge case context]
  When [action]
  Then [expected behavior]
```

### Step 4: API contracts (if applicable)

```yaml
POST /rest/v1/runs
  Request:
    use_case: string (required)
    query_set_version: string (required)
  Response 201:
    run_id: uuid
    status: "pending"
  Response 422:
    detail: "Validation failed"
```

### Step 5: Data models (if applicable)

```
Table: [name]
  id: UUID (PK)
  field_1: string (required)
  created_at: timestamp with timezone
  Relations: belongs_to [X], has_many [Y]
```

### Step 6: MoSCoW prioritization

| Story | Priority | Effort | Dependencies |
| ----- | -------- | ------ | ------------ |
| US-1  | Must     | S      | -            |
| US-2  | Must     | M      | US-1         |

---

## Output

Create the file `.product/specs/[slug]-specs.md` with the complete structure.

---

## MANDATORY CHECKPOINT

```
"I generated X user stories split across Y epics.
- P0 (Must): X stories
- P1 (Should): Y stories
- Total estimated effort: [XS-XXL]

Shall we validate these specs before the architecture?"
```

**DO NOT proceed without explicit validation.**

---

## Usage

```bash
/specs --feature [slug]
```
