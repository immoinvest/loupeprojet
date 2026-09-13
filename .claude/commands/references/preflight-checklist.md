# Preflight Checklist — Validation before starting

Mandatory verification BEFORE starting any phase of the pipeline.
Referenced by `/implement`, `/qa-tests`, `/new-feature`, `/bug-fix`.

---

## Quick checklist (copy-paste)

```bash
# 1. Git clean?
git status
# Expected: "nothing to commit, working tree clean"
# If dirty: commit or stash before continuing

# 2. Branch up to date?
git pull origin main --dry-run
# If behind: git pull origin main

# 3. Deps installed?
# API
cd evaluation-api && .venv/Scripts/pip list --format=columns | head -5
# Front
cd evaluation-frontend && npm ls --depth=0 2>&1 | tail -5

# 4. Baseline tests (unit mandatory, narrow-int if Postgres available)
cd evaluation-api && uv run pytest tests/unit/ --tb=line -q 2>&1 | tail -3
# Note: X passed, Y failed
# If Y > 0: STOP — fix the existing tests BEFORE starting
# narrow-int (optional, skip if no local Postgres):
# uv run pytest tests/narrow-int/ --tb=line -q 2>&1 | tail -3

# 5. Baseline type check
cd evaluation-api && ruff check app/ 2>&1 | tail -3
cd evaluation-api && mypy app/ --ignore-missing-imports 2>&1 | tail -3
# Note the number of pre-existing mypy errors (do not add any)
```

---

## Decisions based on the results

### Git dirty

```text
Case 1: Files unrelated to the current feature
  → git stash -m "WIP: unrelated changes"
  → Continue the pipeline
  → git stash pop after the feature

Case 2: Files related to a previous unpushed feature
  → STOP — finish and push the previous feature
  → Then start the new one

Case 3: Modified config files (.env, settings)
  → Verify it is not a secret
  → Commit if OK: git commit -m "chore: update local config"
```

### Baseline tests that fail

```text
Case 1: Flaky tests (pass 1 out of 2 times)
  → Re-run 3 times: pytest --count=3 -x tests/unit/test_xxx.py
  → If fail < 3 times: note as flaky, continue with caution
  → If fail 3/3: it's a real bug, fix BEFORE starting

Case 2: Tests broken since the last merge
  → git log --oneline -5 to identify the culprit commit
  → Fix and commit: fix(tests): repair broken test from [commit]
  → Re-verify baseline

Case 3: Tests that depend on infra (DB, Redis)
  → Verify docker compose up
  → Ignore the narrow-int tests if no local DB
  → The unit/ tests MUST pass without infra
```

### Type check with pre-existing errors

```text
Rule: NEVER increase the number of mypy errors.
1. Count the current errors: mypy app/ 2>&1 | grep "Found"
2. Note the number (e.g.: "Found 6 errors")
3. After implementation: same command
4. If errors > baseline: fix before committing
5. If errors == baseline: OK, these are the pre-existing ones
```

---

## Baseline template to copy into pipeline-state.json

```json
{
  "baseline": {
    "tests_passed": 76,
    "tests_failed": 0,
    "mypy_errors": 6,
    "ruff_errors": 0,
    "git_status": "clean",
    "branch": "main",
    "last_commit": "abc1234"
  }
}
```
