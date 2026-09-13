# Quality Gates — Automated verification before commit

Impassable gates: the code does not pass if these checks fail (except Gate 7, which is a warning).
Referenced by `/implement`, `/cleanup-push`, `/bug-fix`, `/new-feature`.

---

## Gate 1: Lint + format (blocking)

```bash
# API — must return 0 errors
uv run ruff check app/
# If it fails: uv run ruff check app/ --fix then re-verify

# Front — must return 0 errors
npx eslint src/ --max-warnings=0
```

**Verdict**: If ruff/eslint fails → DO NOT commit.

---

## Gate 2: Type check (blocking, threshold)

```bash
# API — count the errors
MYPY_ERRORS=$(uv run mypy app/ --ignore-missing-imports 2>&1 | grep "Found" | grep -oP '\d+')
echo "mypy errors: ${MYPY_ERRORS:-0}"

# Compare against the baseline in pipeline-state.json
# Rule: MYPY_ERRORS <= baseline.mypy_errors
# New error = BLOCKING

# Front — must return 0
npx tsc --noEmit
```

**Verdict**: If new mypy errors → fix before committing.

---

## Gate 3: Tests (blocking)

```bash
# API — all must pass
uv run pytest tests/unit/ --tb=short -q
# Expected: "X passed" without "failed"

# Front
npx vitest run
```

**Verdict**: If a test fails → fix it. See `references/recovery-protocol.md`.

---

## Gate 4: File size (blocking)

```bash
# Verify that no source file exceeds 300 lines (excluding tests)
find app/ -name "*.py" -not -path "*/test*" -exec wc -l {} + | sort -rn | head -10
# Any file > 300 lines → split it BEFORE committing

# Front
find src/ -name "*.tsx" -o -name "*.ts" | xargs wc -l | sort -rn | head -10
```

**Verdict**: If a file > 300 lines → refactor (see clean-code-guidelines.md section 2).

---

## Gate 5: Function size (blocking)

Manual but systematic verification:

```text
For each file MODIFIED in this commit:
1. Open the file
2. For each function/method:
   - Count the LOGIC lines (excluding docstring, imports, blank lines)
   - If > 20 lines → break it down into sub-functions
3. For each class:
   - Count the public methods
   - If > 7 public methods → extract into a subclass or separate service
```

**Verdict**: If a God Function is detected → refactor BEFORE committing.

---

## Gate 6: No placeholders (blocking)

```bash
# Search for TODO, FIXME, useless pass, NotImplementedError
grep -rn "TODO\|FIXME\|NotImplementedError\|implement later" app/ --include="*.py" || echo "Clean"
grep -rn "TODO\|FIXME\|NotImplementedError" src/ --include="*.ts" --include="*.tsx" || echo "Clean"

# Check for suspicious "pass" statements (not those of empty except/class)
grep -rn "^\s*pass$" app/ --include="*.py" | grep -v "__init__\|except\|class.*:" || echo "Clean"
```

**Verdict**: If a placeholder is found → implement it or remove it.

---

## Gate 7: No magic strings for statuses (warning, non-blocking)

```bash
# Search for hardcoded string usages for known statuses
grep -rn '"pending"\|"running"\|"completed"\|"failed"' app/services/ app/api/ --include="*.py" || echo "Clean"
grep -rn '"green"\|"yellow"\|"red"\|"critical"\|"warning"' app/services/ app/api/ --include="*.py" || echo "Clean"
# If found → replace with the corresponding enum (RunStatus, MetricStatus, etc.)
```

---

## Gate 8: Basic security (blocking)

```bash
# No secrets in the code
grep -rn "password\|secret\|api_key\|token" app/ --include="*.py" | grep -v "test\|\.env\|settings\|Depends\|verify_token\|_auth" || echo "Clean"

# No print() in production
grep -rn "^\s*print(" app/ --include="*.py" || echo "Clean"
```

**Verdict**: If a hardcoded secret or print() is found → fix it.

---

## Gate 9: Advanced secret detection (blocking)

Regex patterns to detect the most common secrets in the code:

```bash
# Known API keys (OpenAI, Anthropic, AWS, GitHub, Slack, Auth0)
grep -rn -E "sk-[a-zA-Z0-9]{20,}" app/ src/ --include="*.py" --include="*.ts" --include="*.tsx" || echo "Clean"
grep -rn -E "sk-ant-[a-zA-Z0-9]{20,}" app/ src/ --include="*.py" --include="*.ts" --include="*.tsx" || echo "Clean"
grep -rn -E "ghp_[a-zA-Z0-9]{36,}" app/ src/ --include="*.py" --include="*.ts" --include="*.tsx" || echo "Clean"
grep -rn -E "AKIA[A-Z0-9]{16}" app/ src/ --include="*.py" --include="*.ts" --include="*.tsx" || echo "Clean"
grep -rn -E "xox[bpsa]-[a-zA-Z0-9-]+" app/ src/ --include="*.py" --include="*.ts" --include="*.tsx" || echo "Clean"

# Private keys
grep -rn "BEGIN.*PRIVATE KEY" app/ src/ --include="*.py" --include="*.ts" --include="*.tsx" || echo "Clean"

# Connection strings with credentials
grep -rn -E "postgresql://[^:]+:[^@]+@" app/ src/ --include="*.py" --include="*.ts" | grep -v "\.env\|settings\|example\|test" || echo "Clean"
```

**Verdict**: If a secret is detected → remove it immediately, store it in .env, add it to .gitignore.

---

## Gate 10: Sensitive files (blocking)

```bash
# Verify that .env is not tracked by git
git ls-files --cached | grep -E "\.env$|\.env\.local$|\.env\.production$" || echo "Clean"

# Verify that credential files are not tracked
git ls-files --cached | grep -E "\.pem$|\.key$|credentials\.json$|service-account" || echo "Clean"

# Verify that .gitignore contains the sensitive patterns
grep -c "\.env" .gitignore > /dev/null 2>&1 && echo "OK: .env in gitignore" || echo "WARN: .env NOT in gitignore"
```

**Verdict**: If a sensitive file is tracked by git → git rm --cached, add it to .gitignore.

---

## Gate 11: Dangerous patterns (blocking)

```bash
# eval/exec with variables (Python)
grep -rn -E "eval\(|exec\(" app/ --include="*.py" | grep -v "test\|#.*eval" || echo "Clean"

# subprocess with shell=True (Python)
grep -rn "shell=True" app/ --include="*.py" || echo "Clean"

# dangerouslySetInnerHTML (React)
grep -rn "dangerouslySetInnerHTML" src/ --include="*.tsx" --include="*.ts" || echo "Clean"

# Raw SQL with f-strings (Python)
grep -rn -E 'text\(f"|text\(f'"'"'' app/ --include="*.py" || echo "Clean"

# pickle.load with untrusted input (Python)
grep -rn "pickle\.load\|pickle\.loads" app/ --include="*.py" | grep -v "test" || echo "Clean"

# yaml.load without SafeLoader (Python)
grep -rn "yaml\.load(" app/ --include="*.py" | grep -v "SafeLoader\|safe_load\|test" || echo "Clean"
```

**Verdict**: If a dangerous pattern is found → refactor with the secure alternative.

---

## Complete sequence before commit

```text
For each story before git commit:

1.  ruff check app/                          → 0 errors
2.  mypy app/ --ignore-missing-imports       → <= baseline errors
3.  pytest tests/unit/ --tb=short -q         → 0 failed
4.  Modified files < 300 lines               → verified
5.  Modified functions < 20 logic lines      → verified
6.  grep TODO/FIXME                          → 0 results
7.  grep secrets/print                       → 0 results
8.  Advanced secret detection (Gate 9)       → 0 results
9.  Untracked sensitive files (Gate 10)      → 0 results
10. Dangerous patterns (Gate 11)             → 0 results

If a gate fails: FIX it, then re-verify ALL the gates.
Do not fix one gate and break another.
```

---

## Coverage by file type (for /qa-tests)

| File type                 | Minimum coverage | Target coverage |
| ------------------------- | ---------------- | --------------- |
| Services (business logic) | 90%              | 100%            |
| Composite score / scoring | 100%             | 100%            |
| Routes (HTTP layer)       | 75%              | 85%             |
| Schemas (validation)      | 60%              | 75%             |
| Auth (security)           | 100%             | 100%            |
| Models (DB)               | 50%              | 70%             |
| Utils / helpers           | 80%              | 90%             |

### Test quality (not just quantity)

```text
Each test MUST have:
- At least 1 explicit assertion (not just "it doesn't crash")
- A name that describes the behavior tested (test_returns_404_when_metric_not_found)
- Realistic test data (not "test", "abc", 123)

Minimum ratio per endpoint:
- 1 happy path
- 2 error cases (not found + validation)
- 2 edge cases (boundaries, degenerate cases)
= Minimum 5 tests per endpoint
```
