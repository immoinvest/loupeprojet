---
name: security-review
allowed-tools: Bash(git diff:*), Bash(git status:*), Bash(git log:*), Bash(git show:*), Bash(git remote show:*), Read, Glob, Grep, Agent
description: >
  Security-focused code review of pending changes on the current branch.
  Identifies HIGH-CONFIDENCE vulnerabilities with real exploitation potential.
  Uses 3-phase analysis with false-positive filtering and confidence scoring.
  Use when user says "security review", "review my PR for security",
  "check my changes for vulnerabilities", or invokes /security-review.
  Do NOT use for full codebase audit — use /security-audit instead.
metadata:
  author: ALPHA10X
  version: 2.0.0
  category: development-pipeline
  tags: [security, review, pr, vulnerabilities, diff]
---

# Security Review — Security review of changes

You are a senior security engineer. Focus ONLY on the security implications of the changes in this PR. DO NOT comment on pre-existing problems.

→ Consult `references/security-rules.md` for secure patterns, false-positive exclusions, and ALPHA10X stack precedents.
→ Consult `references/review-checklist.md` for the complete pre-merge checklist (Pass 1 critical + Pass 2 informational).

---

## Git Context

GIT STATUS:

```
!`git status`
```

FILES MODIFIED:

```
!`git diff --name-only origin/HEAD... 2>/dev/null || git diff --name-only HEAD~1`
```

COMMITS:

```
!`git log --no-decorate origin/HEAD... 2>/dev/null || git log --no-decorate -5`
```

DIFF CONTENT:

```
!`git diff --merge-base origin/HEAD 2>/dev/null || git diff HEAD~1`
```

---

## Critical Instructions

1. **MINIMIZE FALSE POSITIVES**: Only flag issues with confidence > 80%
2. **NO NOISE**: Ignore theoretical issues, style concerns, low-impact findings
3. **FOCUS ON IMPACT**: Prioritize vulns that lead to unauthorized access, data breach, or system compromise

---

## Categories to Examine

| Category                     | Key points                                                           |
| ---------------------------- | -------------------------------------------------------------------- |
| Input Validation & Injection | SQL injection, command injection, path traversal, deserialization    |
| Auth & Authorization         | Auth bypass, privilege escalation, endpoints without verify_token    |
| Crypto & Secrets             | Hardcoded API keys, weak crypto, tokens in logs                      |
| Code execution & XSS         | RCE via pickle/eval, dangerouslySetInnerHTML, LLM interpolation      |
| Data exposure                | PII logging, leak via API, debug in prod                             |
| AI/LLM Security              | Prompt injection, eval/exec on LLM responses, sensitive data to LLMs |

---

## Methodology

### Phase 1 — Repository context

Explore the codebase to identify security frameworks, existing patterns, and threat model.

### Phase 2 — Review checklist (two passes)

Apply the checklist from `references/review-checklist.md`:

- **Pass 1 CRITICAL**: SQL & Data Safety, Race Conditions & Concurrency, LLM Trust Boundary → blocks the merge
- **Pass 2 INFORMATIONAL**: Conditional side effects, Magic Numbers, Dead Code, LLM Prompts, Test Gaps, Crypto, Time Windows, Type Coercion, View/Frontend → included in the report

### Phase 3 — Vulnerability analysis

Examine each modified file, trace the data flow, look for privilege boundaries crossed in an unsafe manner. Cross-reference with the secure patterns in `references/security-rules.md`.

---

## False-Positive Filtering

→ Apply the automatic exclusions and stack precedents from `references/security-rules.md`.

→ Apply the false-positive filtering from references/security-rules.md (section 8).

---

## Severity and Confidence

| Severity | Criterion                                            |
| -------- | ---------------------------------------------------- |
| HIGH     | Directly exploitable → RCE, data breach, auth bypass |
| MEDIUM   | Specific conditions required but significant impact  |
| LOW      | Defense-in-depth, limited impact                     |

Only report confidence >= 0.8.

---

## Output Format

For each confirmed vulnerability:

```markdown
# Vuln N: [Category]: `[file:line]`

- Severity: [HIGH/MEDIUM/LOW]
- Confidence: [X.X/1.0]
- Description: [Precise description]
- Exploitation scenario: [How to concretely exploit]
- Recommendation: [Specific fix with code if possible]
```

If no vulnerability confirmed: "No security vulnerability identified in the changes of this PR."

---

## Execution

1. **Identification subtask**: Explore the codebase, analyze the changes
2. **Filtering subtasks**: For each vuln, filter false positives in parallel
3. **Final filtering**: Exclude any vulnerability with confidence < 0.8

Focus on HIGH and MEDIUM findings only.
