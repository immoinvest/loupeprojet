---
name: security-audit
allowed-tools: Bash(git diff:*), Bash(git status:*), Bash(git log:*), Bash(git show:*), Bash(git commit:*), Bash(git add:*), Read, Glob, Grep, Edit, Agent
description: >
  Audits codebase for security vulnerabilities across 6 categories:
  Auth & Authorization (25%), Injection (20%), Input Validation (20%),
  Sensitive Data & Logging (15%), Configuration & Dependencies (10%),
  AI/LLM Security (10%). Produces a 0-100 score with grades A-F.
  Auto-fixes critical and high vulnerabilities.
  Includes false-positive filtering with confidence scoring (>80% only).
  Use when user says "security audit", "check for vulnerabilities",
  "OWASP check", or invokes /security-audit.
  Do NOT use for functional testing — use /qa-tests instead.
  Do NOT use for PR-level security review — use /security-review instead.
metadata:
  author: ALPHA10X
  version: 4.0.0
  category: development-pipeline
  tags: [security, audit, owasp, vulnerabilities, false-positives]
---

# Security Audit — Security Audit

Analyze the codebase to detect vulnerabilities. Score 0-100 with grades A-F.

→ Consult `references/security-rules.md` for the secure patterns, the decision tree, the false-positive exclusions, and the ALPHA10X stack precedents.

---

## Audit categories (weighting)

| #   | Category                 | Weight | Key points                                                                               |
| --- | ------------------------ | ------ | ---------------------------------------------------------------------------------------- |
| 1   | Auth & Authorization     | 25%    | JWT RS256 + JWKS, verify_token on each route, no hardcoded secrets, CORS                 |
| 2   | Injection                | 20%    | SQL (ORM only), Command, Path Traversal, Deserialization                                 |
| 3   | Input validation         | 20%    | Strict Pydantic, size limits, UUID, capped pagination, SSRF on external API calls        |
| 4   | Sensitive data & Logging | 15%    | No PII/tokens in logs, structlog, generic error messages                                 |
| 5   | Config & Dependencies    | 10%    | Conditional CORS, headers, pip-audit, non-root Docker, rate limiting on public endpoints |
| 6   | AI/LLM Security          | 10%    | Prompt isolation, untrusted responses, timeouts                                          |

---

## Scoring

| Severity | Points deducted |
| -------- | --------------- |
| Critical | -25             |
| High     | -15             |
| Medium   | -8              |
| Low      | -3              |

| Grade | Score  | Meaning                             |
| ----- | ------ | ----------------------------------- |
| A     | 90-100 | Production ready                    |
| B     | 80-89  | Acceptable (minimum to deploy)      |
| C     | 70-79  | Insufficient — corrections required |
| D     | 60-69  | Corrections required before deploy  |
| F     | <60    | Not deployable                      |

## Confidence scoring

| Score   | Action                          |
| ------- | ------------------------------- |
| 0.9-1.0 | Report — certain exploit        |
| 0.8-0.9 | Report — clear pattern          |
| 0.7-0.8 | Report with caveat              |
| < 0.7   | DO NOT report (too speculative) |

---

## Your Mission

### Step 1: Codebase context

Identify the security frameworks in place (Auth0, SQLAlchemy, Pydantic), spot the existing validation patterns, list the at-risk files.

### Step 2: Scan the codebase

For each category: list the files, verify each point, identify the vulnerabilities, classify by severity, assign a confidence score.

### Step 3: Filter false positives

→ Apply the automatic exclusions and stack precedents from `references/security-rules.md` sections 7 and the ALPHA10X pattern.

→ Apply the false-positive filtering from references/security-rules.md (section 8).

### Step 4: Compute the score

Initial score 100, subtract the points per confirmed vulnerability (confidence >= 0.7).

### Step 5: Report

```markdown
## Security Audit Report

**Date**: YYYY-MM-DD | **Score**: XX/100 (Grade X) | **Feature**: [slug]
**Findings reported**: X (out of Y detected, Z excluded as false positives)

### Summary by category

| Category             | Score | Issues |
| -------------------- | ----- | ------ |
| Auth & Authorization | XX/25 | ...    |
| Injection            | XX/20 | ...    |
| Validation           | XX/20 | ...    |
| Data & Logging       | XX/15 | ...    |
| Config & Deps        | XX/10 | ...    |
| AI/LLM Security      | XX/10 | ...    |

### Confirmed vulnerabilities

#### CRITICAL (confidence >= 0.9)

- **[Category] [Description]** — File: [path:line] — Confidence: X.X
  Impact: [...] — Scenario: [...] — Fix: [...]

#### HIGH / MEDIUM / LOW

[same format]

### Excluded false positives (transparency)

| #   | Detected pattern | Reason for exclusion |
| --- | ---------------- | -------------------- |

### Priority recommendations

1. [Action 1]
```

### Step 6: Fix if critical findings

If critical or high vulnerabilities: fix, commit `fix(security): [description]`, re-audit, verify no regression.

---

## Common false positives — Decision tree

→ See `references/security-rules.md` section 7 for the complete decision tree.

Most frequent cases:

1. CORS wildcard in dev → OK if conditional by env
2. JWT lib "vulnerable" → OK if algorithm fixed to RS256
3. Stack traces in dev → OK if debug conditional
4. SQLAlchemy text() without user input → OK
5. LLM responses in the logs → warning only (not CRITICAL)
6. CSRF with Bearer token auth → not applicable (no cookies = no CSRF)

---

## Usage

```bash
/security-audit                    # Full audit
/security-audit --feature [slug]   # Audit of a feature
/security-audit --quick            # Critical + high only
```

## Next step

→ `/cleanup-push` to finalize, update the docs, and push.
