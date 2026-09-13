---
name: new-feature
description: >
  Master orchestrator for the complete feature development pipeline:
  Discovery, Specs, Architecture, Implement, QA, Security, Cleanup & Push.
  Use when user says "new feature", "build a feature", "implement end-to-end",
  or invokes /new-feature. Coordinates all sub-skills in sequence with
  mandatory user validation checkpoints between phases.
  Do NOT use for single bug fixes or small tweaks — use /implement directly.
metadata:
  author: ALPHA10X
  version: 3.0.0
  category: development-pipeline
  tags: [orchestrator, pipeline, feature]
---

# New Feature — Master Orchestrator

Complete pipeline: Discovery → Specs → Architecture → Implement → Tests → Security → Cleanup → Push → Doc.

---

## Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                     /new-feature Pipeline                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  /feature-discovery  → Understand the request                   │
│       ⚡ CHECKPOINT                                              │
│  /specs              → Break down into user stories             │
│       ⚡ CHECKPOINT                                              │
│  /architecture       → Design the technical solution            │
│       ⚡ CHECKPOINT                                              │
│  /implement          → Code (1 commit per story)                │
│  Refactor pass       → Dead code, SRP, split files > 300L     │
│  /qa-tests           → Complete test pyramid                    │
│  /security-audit     → OWASP audit (score >= 80)                │
│  /cleanup-push       → Lint + build + push + doc                │
│  Auto-merge          → gh pr checks --watch + merge squash      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## CRITICAL RULES

→ See also CLAUDE.md (workspace root) for the complete Development Rules.

### Rule 1: ONE feature per session

```
❌ FORBIDDEN: "Build models + routes + services + front in one go"
✅ CORRECT  : Feature A → commit → new session → Feature B
```

### Rule 2: User validation MANDATORY

After each major phase, ASK for validation before continuing.

```
1. Discovery done     → "Here is what I understood. Shall we continue?"
2. Specs done         → "Here are the X stories. Shall we validate?"
3. Architecture done  → "Here is the design. Shall we implement?"
```

DO NOT chain steps automatically.

### Rule 3: Commit per story/module

```
❌ FORBIDDEN: Implement everything then 1 big commit
✅ CORRECT  : Models → commit → Schemas → commit → Routes → commit
```

### Rule 4: No placeholders

```
❌ FORBIDDEN: TODO, FIXME, pass, "implement later", ...
✅ CORRECT  : Complete, functional, tested code
```

---

## Your Mission (Claude)

### Step 0: Load context and baseline (MANDATORY)

Read the project knowledge files:

- CLAUDE.md (workspace root + repos)
- .product/ (features-registry, functional-spec, technical-spec, architecture-overview)

Then run the preflight → see `references/preflight-checklist.md` for the full details.
Create a feature branch from main: `git checkout -b feat/[slug]`
Record the baseline in `.product/pipeline-state.json`.

### Steps 1-7: Execute the sub-commands in order

Each sub-command has its own detailed instructions:

1. `/feature-discovery` → understand the request → **CHECKPOINT**
2. `/specs` → break down into user stories → **CHECKPOINT**
3. `/architecture` → design the solution → **CHECKPOINT**
4. `/implement` → code each story with incremental commits
5. **Refactor pass** → clean up dead code, apply SRP, files > 300 lines → split
6. `/qa-tests` → validate with the test pyramid
7. `/security-audit` → audit security (score >= 80, grade B minimum)
8. `/cleanup-push` → clean up, push, document

### Step 5b: Refactor pass (MANDATORY after implement)

After implementation, BEFORE the QA tests, perform a cleanup pass:

1. **Dead code**: remove unused imports, functions/variables/classes that are no longer called following the changes
2. **SRP**: if a modified file exceeds 300 lines → identify the responsibilities and split into sub-modules
3. **Re-exports**: if code was moved, maintain re-exports for backward compatibility of existing imports
4. **Verify**: run the tests after each refactor to guarantee zero regression

```bash
# Detect unused imports
uv run ruff check app/ --select F401,F811

# Check the sizes of modified files
wc -l [modified files]
```

If a modified file exceeds 300 lines, commit the refactor separately:

```bash
git commit -m "refactor: split [file] into [sub-modules]"
```

### Step 8: Automatic merge

```bash
gh pr checks [PR_NUMBER] --watch
gh pr merge [PR_NUMBER] --squash --delete-branch
```

If a check fails: diagnose, fix, re-push, and re-verify.

### Step 9: Final report

```markdown
## Feature Complete: [Title]

### Pipeline executed

| Step           | Status | Details                |
| -------------- | ------ | ---------------------- |
| Discovery      | ✓      | Scope validated        |
| Specs          | ✓      | X user stories         |
| Architecture   | ✓      | X files planned        |
| Implementation | ✓      | X commits              |
| Tests          | ✓      | X tests, Y% coverage   |
| Security       | ✓      | Score XX/100 (Grade X) |
| Push           | ✓      | [commit range]         |

### Files created/modified

[list]

### Tests

- Baseline: X tests → Final: Y tests → No regression: ✓

### User impact

[Description of what changes for the end user]

### How to test

1. [Step 1]
2. [Step 2]

### Documentation updated

- functional-spec.md, technical-spec.md, features-registry.md, README.md, CLAUDE.md

### Next steps

[What remains to be done]
```

---

## State management

**File: `.product/pipeline-state.json`** — MANDATORY, update at each step.

```json
{
  "feature_slug": "metric-deep-dive",
  "started_at": "2026-02-26T14:00:00Z",
  "current_step": "implement",
  "scope": "backend_only",
  "baseline": { "tests_passed": 25, "tests_failed": 0 },
  "steps": {
    "discovery": {
      "status": "completed",
      "output": ".product/features/metric-deep-dive-discovery.md"
    },
    "specs": { "status": "completed", "stories_count": 6 },
    "architecture": {
      "status": "completed",
      "output": ".product/architecture/metric-deep-dive.md"
    },
    "implement": {
      "status": "in_progress",
      "stories_completed": 3,
      "stories_total": 6,
      "commits": []
    },
    "qa_tests": { "status": "pending" },
    "security": { "status": "pending" },
    "push": { "status": "pending" }
  }
}
```

---

## Execution modes

```bash
/new-feature $ARGUMENTS                    # Full pipeline
/new-feature --continue                    # Resume (see references/recovery-protocol.md)
/new-feature "Description" --backend-only  # API only
/new-feature "Description" --frontend-only # Front only
/new-feature "Description" --mvp-only      # P0 stories only
```

---

## Checklist before declaring "complete"

→ See `references/quality-gates.md` for the exact commands of each gate.

- [ ] All checkpoints validated by the user
- [ ] Quality gates passed (11 gates)
- [ ] Tests >= baseline (no regression)
- [ ] mypy errors <= baseline
- [ ] At least one commit per module/story
- [ ] Alembic migrations created if DB model modified
- [ ] Security audit score >= 80 (Grade B minimum)
- [ ] pipeline-state.json, features-registry.md, functional-spec.md, technical-spec.md updated
- [ ] README.md and CLAUDE.md updated if applicable
- [ ] Git push + PR created + CI checks passed + PR merged
- [ ] Test instructions provided
