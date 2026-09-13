---
name: cleanup-push
description: >
  Final pipeline step: lint, format, type check, full test suite,
  build verification, git push, and spec documentation updates.
  Use when user says "cleanup", "finalize", "push", "ship it",
  or invokes /cleanup-push. Updates functional-spec.md, technical-spec.md,
  features-registry.md, architecture-overview.md, README.md, and CLAUDE.md.
  Do NOT use mid-implementation — finish /implement and /qa-tests first.
metadata:
  author: ALPHA10X
  version: 3.0.0
  category: development-pipeline
  tags: [cleanup, push, finalization, documentation]
---

# Cleanup & Push — Finalization

Final step of the pipeline: lint, build, final tests, push, documentation.

---

## Your Mission

### Step 1: Quality gates

→ Run ALL gates — see `references/quality-gates.md` for the exact commands.

```bash
# API
cd evaluation-api
uv run ruff check app/ --fix
uv run ruff format app/
uv run mypy app/ --ignore-missing-imports

# Front (if applicable)
cd evaluation-frontend
npx eslint src/ --fix
npx tsc --noEmit
```

### Step 2: Final tests

```bash
cd evaluation-api && uv run pytest tests/unit/ -v --tb=short
cd evaluation-frontend && npx vitest run  # if applicable
```

Compare with the baseline. If regressions: STOP, fix.

### Step 3: Build check

```bash
cd evaluation-api && docker compose build
cd evaluation-frontend && npm run build
```

### Step 4: Git push and PR

```bash
git status
git add [forgotten files]
git commit -m "chore: cleanup before push"

git push -u origin [branch]
gh pr create --title "[type]: [short description]" --body "$(cat <<'EOF'
## Summary
- [main changes]

## Test plan
- [ ] Unit tests pass
- [ ] Type check OK
- [ ] Build OK
EOF
)"
```

**IMPORTANT**: Deployment to dev happens automatically on push, no need to wait for the merge.

### Step 5: Update the documentation

**MANDATORY** after each completed feature:

#### functional-spec.md

Description of the feature from the user's point of view, impact, endpoints, screens.

#### technical-spec.md

Data models, architecture, technical decisions, tests.

#### features-registry.md

```markdown
- [x] [slug] — [title] — [date] — [scope: backend/frontend/full-stack]
```

#### architecture-overview.md

Update if new modules/tables/routes.

#### README.md (of the impacted repos)

Check each section:

- Tech Stack, Project Structure, API Endpoints, CI Pipeline, Docker, K8s, Environment Vars, Production

If NO section is impacted: touch nothing. If AT LEAST ONE: update.

#### CLAUDE.md (of the impacted repos)

If new conventions, patterns, or rules → add to the appropriate section.

### Step 6: Test instructions

```markdown
## How to test

### Prerequisites

- Docker running: `docker compose up -d`

### Steps

1. [Action 1] — Expected result: [xxx]
2. [Action 2] — Expected result: [xxx]
```

### Step 7: Automatic post-mortem

Add to `.product/pipeline-state.json`:

```json
{
  "post_mortem": {
    "blockers_encountered": ["..."],
    "retries": { "US-3": "Circular import — resolved with TYPE_CHECKING" },
    "patterns_discovered": ["..."],
    "improvements_for_next_time": ["..."]
  }
}
```

---

## Final checklist

- [ ] Lint + type check pass
- [ ] Tests >= baseline (zero regression)
- [ ] Build passes
- [ ] Quality gates pass (see `references/quality-gates.md`)
- [ ] Git clean (no forgotten files)
- [ ] Git push done + PR created
- [ ] functional-spec.md, technical-spec.md, features-registry.md updated
- [ ] architecture-overview.md updated
- [ ] README.md updated (if sections impacted)
- [ ] CLAUDE.md updated (if new conventions)
- [ ] Test instructions provided
- [ ] Post-mortem filled in pipeline-state.json
- [ ] pipeline-state.json status: completed

---

## Usage

```bash
/cleanup-push
```
