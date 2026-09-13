---
name: feature-discovery
description: >
  Analyzes a raw feature request into a structured discovery document
  with outcomes, outputs, scope, constraints and risks.
  Use when user says "analyze this feature", "discovery phase",
  "what should we build", or invokes /feature-discovery.
  First step of the /new-feature pipeline. Requires user validation
  before proceeding to /specs.
  Do NOT use for technical design — use /architecture instead.
metadata:
  author: ALPHA10X
  version: 3.0.0
  category: development-pipeline
  tags: [discovery, analysis, requirements]
---

# Feature Discovery — In-Depth Request Analysis

First step of the `/new-feature` pipeline. Transform a raw request into a structured discovery document.

→ Consult references/domain-examples.md for concrete examples of the ALPHA10X domain.

---

## Prerequisites

MANDATORY reading:

- CLAUDE.md (workspace root + repos) — Business context, 25 metrics, 5 health drivers
- .product/ (features-registry, functional-spec, technical-spec) — Do not reimplement an existing feature

---

## Your Mission

### Step 1: Understand the request

- **WHAT**: What does the user concretely want?
- **WHY**: What problem does it solve? What business impact?
- **FOR WHOM**: Who uses this feature? (PE analyst, data team, admin)
- **WHERE**: Which repo? API, Front, or both?

### Step 2: Ask clarifying questions

If the request is ambiguous:

- Backend only or full-stack?
- Which API endpoints are needed?
- What data in the DB? New model or extension?
- Required integrations? (ALPHA10X API, LLM judge, Celery jobs)
- Which dashboard level is impacted? (L1 Health, L2 Metrics, L3 Issues, L4 Deep Dive)

### Step 3: Define Outcomes and Outputs

**Outcomes** (business results): Which KPI are we improving? How will we know it's a success?

**Outputs** (concrete deliverables): API endpoints, frontend pages/components, data models, async jobs

### Step 4: Scope IN / OUT

```
✅ IN SCOPE (what we do now):
- ...

❌ OUT OF SCOPE (for later):
- ...
```

### Step 5: Constraints and Risks

Technical dependencies, known limitations, integration risks, performance concerns.

### Step 6: Definition of Done

List of acceptance criteria that make the feature "complete".

---

## Output

Create the file `.product/features/[slug]-discovery.md`:

```markdown
# Feature Discovery: [Title]

## Original request

[What the user requested]

## Analysis

### What / Why / For whom / Scope

[...]

## Outcomes

1. [Outcome 1]

## Outputs

1. [Endpoint/Page/Component 1]

## Scope

### IN

- ...

### OUT

- ...

## Constraints

- ...

## Risks

- ...

## Definition of Done

- [ ] [Criterion 1]
```

---

## MANDATORY CHECKPOINT

```
"Here is what I understood about the feature [X].
- Scope: [backend/frontend/full-stack]
- X outcomes, Y outputs
- Constraints: [list]

Is this correct? Shall we move on to the specs?"
```

**DO NOT proceed without explicit validation from the user.**

---

## Usage

```bash
/feature-discovery "Feature description"
```
