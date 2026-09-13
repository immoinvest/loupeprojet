---
name: bug-fix
description: >
  TDD-driven bug fix pipeline: Diagnose, Reproduce (failing test), Fix, Verify (test green),
  Security Review, Cleanup & Push. Use when user says "fix bug", "debug this", "there's an error",
  or invokes /bug-fix. Always starts with a failing test that reproduces the bug,
  then fixes the code until the test passes. Includes regression prevention and
  security review of the diff before push.
  Do NOT use for new features — use /new-feature instead.
metadata:
  author: ALPHA10X
  version: 2.0.0
  category: development-pipeline
  tags: [bugfix, tdd, debugging, regression]
---

# Bug Fix — TDD-Driven Bug Resolution

TDD pipeline: Diagnose → Reproduce (RED test) → Fix (GREEN test) → Verify + Security Review → Push.

---

## CRITICAL RULES

### Rule 1: Test FIRST — always

```
❌ FORBIDDEN : Fix the code then write a test afterwards
✅ CORRECT  : Write the RED test → fix → GREEN test
```

The test that reproduces the bug is the most important DELIVERABLE. It prevents regression forever.

### Rule 2: Minimum changes

```
❌ FORBIDDEN : Refactor the code around the bug "while we're at it"
✅ CORRECT  : Change ONLY what is necessary for the fix
```

### Rule 3: NEVER modify the test to make it pass

The test is right, the code is wrong.

### Rule 4: Two commits minimum

```
Commit 1 : test: reproduce [bug description]     ← RED test
Commit 2 : fix: [bug description]                 ← GREEN test
```

---

## Your Mission (Claude)

### Phase 0: Load the context (MANDATORY)

Read the project knowledge files:

- CLAUDE.md (workspace root + repos)

Then run the preflight → see `references/preflight-checklist.md`.
Create a fix branch from main: `git checkout -b fix/[slug]`

---

### Phase 1: DIAGNOSE — Understand the bug

**Objective**: Identify the root cause BEFORE writing any code.

1. **Collect the symptoms**: exact error message, reproduction steps, environment, since when
2. **Locate the code**: which file/function, which data flow, which inputs trigger the bug, why the existing tests did not catch the bug
3. **Formulate the root cause** in ONE sentence:
   "The bug occurs because [component X] does [action Y] instead of [action Z] when [condition C]."

#### CHECKPOINT

```
"## Diagnostic
**Symptom** : [what happens]
**Root cause** : [why]
**Affected files** : [list]
**Planned fix** : [approach]

Shall we continue with reproducing the bug via a test?"
```

**DO NOT proceed without validation.**

---

### Phase 2: REPRODUCE — RED test

**Objective**: Write a test that proves the existence of the bug.

#### Choose the right test level

```
├── Bug in a pure service/computation → UNIT test (tests/unit/)
├── Bug in an API endpoint → INTEGRATION test (tests/narrow-int/)
├── Bug in an external client → UNIT test with mock
├── Bug in a React component → COMPONENT test (src/**/__tests__/)
└── Cross-layer bug → Test at the lowest possible level
```

#### Write the test

The test MUST:

1. Reproduce EXACTLY the conditions of the bug
2. Have a descriptive name: `test_[action]_when_[condition]_[expected_behavior]`
3. Assert the EXPECTED BEHAVIOR (not the broken behavior)
4. Be as small and isolated as possible
5. Use realistic data

#### Verify that the test FAILS then commit

```bash
# API
uv run pytest tests/unit/test_[file].py::[TestClass]::[test_name] -v

# Front
npx vitest run src/[path]/__tests__/[file].test.ts -t "[test name]"
```

**The test MUST fail.** If the test passes, the bug is not correctly reproduced.

```bash
git add tests/[path]
git commit -m "test: reproduce [short description of the bug]"
```

#### CHECKPOINT

```
"RED test confirmed :
- Test : [test name]
- Current result : FAIL ✗ [error message]
- Expected result : PASS ✓ [correct behavior]

Shall we move on to the fix?"
```

**DO NOT proceed without validation.**

---

### Phase 3: FIX — Fix the code

**Objective**: Minimum changes so the test turns GREEN.

→ Consult `references/clean-code-guidelines.md` and `references/security-rules.md` if the fix touches auth, inputs, APIs.

1. Change the MINIMUM amount of code necessary
2. Follow the existing conventions (CLAUDE.md)
3. Verify that the test passes:

```bash
uv run pytest tests/unit/test_[file].py::[TestClass]::[test_name] -v
```

4. Commit the fix:

```bash
git add [modified files — NOT the tests]
git commit -m "fix: [short description]

Root cause: [1-line explanation]
Reproduced by: [test name]"
```

---

### Phase 3b: REFACTOR — Clean up dead code

After the fix, check whether the change left dead code or made a file too large:

1. **Dead code**: unused imports, orphan functions/variables resulting from the fix
2. **Size**: if the fixed file exceeds 300 lines → consider a split (separate commit)
3. **Duplication**: if the fix introduced duplicated code → extract into a shared function

```bash
# Detect unused imports in the modified files
uv run ruff check [modified files] --select F401,F811
```

If refactoring is done, commit separately:

```bash
git commit -m "refactor: clean up dead code after [bug description]"
```

> Note: this step is lightweight for a bug fix. Do not refactor beyond the scope of the fix.
> If a major refactoring is needed, note it and do it in a dedicated session.

---

### Phase 4: VERIFY — No regression

→ Run the relevant quality gates — see `references/quality-gates.md`.

Minimum for a bug fix:

```bash
# Full test suite
uv run pytest tests/unit/ --tb=short -q          # >= baseline

# Type check + lint
uv run ruff check app/
uv run mypy app/ --ignore-missing-imports

# Front (if applicable)
npx vitest run
npx tsc --noEmit
```

If a gate fails: fix and re-verify.

#### Security review of the diff

Run `/security-review` to verify that the fix does not introduce a vulnerability.
This launches a targeted review on the diff (not a full audit) — fast and focused.

If HIGH vulnerabilities are detected: fix before pushing.

---

### Phase 5: PUSH — Finalize

```bash
git push -u origin fix/[slug]
gh pr create --title "fix: [description]" --body "$(cat <<'EOF'
## Bug
**Symptom** : [what was happening]
**Root cause** : [why]
**Impact** : [who was affected]

## Fix
[Description of the fix in 2-3 sentences]

## Reproduction test
- `test_[name]` in `tests/[path]` — reproduces the exact bug

## Verification
- [x] RED test before fix
- [x] GREEN test after fix
- [x] Full suite: no regression
- [x] Type check + Lint: OK

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"

gh pr checks [PR_NUMBER] --watch
gh pr merge [PR_NUMBER] --squash --delete-branch
```

---

### Phase 6: Final report

```markdown
## Bug Fix Complete : [Title]

| Phase           | Status | Details                                    |
| --------------- | ------ | ------------------------------------------ |
| Diagnose        | ✓      | Root cause identified                      |
| Reproduce       | ✓      | RED test : [test name]                     |
| Fix             | ✓      | GREEN test, [N] files modified             |
| Refactor        | ✓/⊘    | Dead code cleaned up / Nothing to clean up |
| Verify          | ✓      | [N] tests, no regression                   |
| Security Review | ✓      | /security-review — no vulnerability        |
| Push            | ✓      | PR: [url] — merged                         |

### Commits

1. `test: reproduce [bug]`
2. `fix: [bug]`

### Tests

- Baseline : X tests → Final : X+1 tests → No regression : ✓
```

Update `.product/pipeline-state.json` with the result.

---

## Troubleshooting

### The reproduction test already passes

1. Verify that the conditions are EXACTLY those of the bug (same input, same state)
2. Verify that the mock correctly simulates the failing behavior
3. If environment-specific: simulate the conditions (timeout, rate limit, missing data)
4. If the test really passes: check git log for a recent fix

### The fix breaks other tests

1. If the tests test an INCORRECT behavior (pre-bug) → update the tests
2. If the tests test a CORRECT behavior that is incompatible → reduce the scope of the fix
3. NEVER delete a test without understanding why it fails

### Bug impossible to reproduce in a unit test

1. Go up one level: integration test (narrow-int)
2. If external dependency: finer mock
3. If race condition: use asyncio.gather() in the test
4. As a last resort: regression test at the endpoint level

### Fix too complex (> 50 lines modified)

If the fix exceeds 100 lines → STOP → ask for user validation.
Possible causes: bad diagnostic, deeper bug, several intertwined bugs.

→ See also `references/recovery-protocol.md` for resuming after an interruption.

---

## Usage

```bash
/bug-fix "Description of the bug or link to the logs"
/bug-fix --continue
/bug-fix "Description" --diagnose-only
/bug-fix "Description" --no-push
```
