# Review Checklist — Pre-merge Analysis

Shared reference between `/security-review` and `/cleanup-push`.
Consult this file for every PR before merge. Inspired by gstack + our own patterns.

---

## Instructions

Analyze the `git diff origin/main` for the issues listed below. Be specific — cite `file:line` and suggest fixes. Only flag real problems.

**Two-pass analysis:**

- **Pass 1 (CRITICAL)**: SQL & Data Safety, Race Conditions, LLM Trust Boundary. Block the merge.
- **Pass 2 (INFORMATIONAL)**: All other categories. Included in the PR but non-blocking.

**Output format:**

```
Pre-Landing Review: N issues (X critical, Y informational)

**CRITICAL** (blocks the merge):
- [file:line] Description of the problem
  Fix: suggested correction

**Issues** (non-blocking):
- [file:line] Description of the problem
  Fix: suggested correction
```

If nothing found: `Pre-Landing Review: No issues found.`

Be concise. For each issue: one line for the problem, one line for the fix. No preamble.

---

## Pass 1 — CRITICAL (blocks the merge)

### SQL & Data Safety

- String interpolation in SQL (even if the values are `.to_i`/`int()` — use bind params or the ORM)
- TOCTOU races: check-then-set patterns that should be an atomic `WHERE` + `UPDATE`
- `update_column`/`update()` that bypass validations on fields with constraints
- N+1 queries: missing `.options(selectinload(...))` or `.includes()` for associations used in loops

### Race Conditions & Concurrency

- Read-check-write without a uniqueness constraint (e.g. `where(hash=x).first()` then `save()` without handling the concurrent insert)
- `get_or_create` / `find_or_create_by` on columns without a unique DB index — concurrent calls create duplicates
- Status transitions without an atomic `WHERE old_status = ? UPDATE SET new_status` — concurrent updates can skip or double transitions
- `html_safe` / `dangerouslySetInnerHTML` / `v-html` on user-controlled data (XSS)

### LLM Output Trust Boundary

- LLM-generated values (emails, URLs, names) written to the DB or passed to mailers without format validation. Add guards (`EMAIL_REGEXP`, `urlparse`, `.strip()`) before persistence.
- Structured tool output (arrays, dicts) accepted without type/shape verification before DB write.
- LLM responses interpolated into SQL, HTML, or shell commands without sanitization.

---

## Pass 2 — INFORMATIONAL (non-blocking)

### Conditional side effects

- Code paths that branch on a condition but forget a side effect on one branch. E.g. item promoted to verified but URL attached only when a secondary condition is true — the other branch promotes without a URL.
- Log messages that say an action took place but the action was conditionally skipped.

### Magic Numbers & String Coupling

- Bare numeric literals used across multiple files — should be named constants
- Error strings used as query filters elsewhere (grep for the string — does something match on it?)

### Dead Code & Consistency

- Variables assigned but never read
- Version mismatch between the PR title and the VERSION/CHANGELOG files
- CHANGELOG entries that describe changes inaccurately
- Comments/docstrings that describe the old behavior after the code was modified

### LLM Prompt Issues

- 0-indexed lists in prompts (LLMs reliably return 1-indexed)
- Prompt text listing tools/capabilities that don't match what's actually wired up
- Word/token limits declared in several places that can diverge

### Test Gaps

- Negative tests that assert the type/status but not the side effects (URL attached? field filled in? callback fired?)
- Assertions on string content without verifying the format (e.g. asserting the title is present but not the URL format)
- Missing `.expects(:something).never` / `assert_not_called()` mock when a code path should NOT call an external service
- Security enforcement features (blocking, rate limiting, auth) without integration tests verifying the enforcement path end-to-end

### Crypto & Entropy

- Data truncation instead of hashing (last N chars instead of SHA-256) — less entropy, easier collisions
- `random.random()` / `Math.random()` for security-sensitive values — use `secrets` / `crypto.randomUUID()`
- Non-constant-time comparisons (`==`) on secrets or tokens — vulnerable to timing attacks

### Time Window Safety

- Date-key lookups that assume "today" covers 24h — an 8am report only sees midnight→8am under the day's key
- Time windows desynchronized between related features — one uses hourly buckets, the other daily keys

### Type Coercion at Boundaries

- Values crossing Python→JSON→JS boundaries or vice versa where the type could change (numeric vs string) — hash/digest inputs must normalize types
- Hash/digest inputs that don't call `str()` / `.toString()` before serialization — `{ cores: 8 }` vs `{ cores: "8" }` produce different hashes

### View / Frontend

- Inline `<style>` blocks in components rendered in a loop (re-parses on each render)
- O(n*m) lookups in views (`Array.find()` in a loop instead of a `Map`/`index_by`)
- Client-side filtering (`.filter()`) on DB results that could be a server-side `WHERE` (unless deliberately intended)

---

## Gate classification

```
CRITICAL (blocks the merge):       INFORMATIONAL (in the PR):
├─ SQL & Data Safety                ├─ Conditional side effects
├─ Race Conditions & Concurrency    ├─ Magic Numbers & String Coupling
└─ LLM Output Trust Boundary        ├─ Dead Code & Consistency
                                     ├─ LLM Prompt Issues
                                     ├─ Test Gaps
                                     ├─ Crypto & Entropy
                                     ├─ Time Window Safety
                                     ├─ Type Coercion at Boundaries
                                     └─ View / Frontend
```

---

## Suppressions — DO NOT flag

- "X is redundant with Y" when the redundancy is harmless and aids readability
- "Add a comment explaining why this threshold/constant" — thresholds change, comments rot
- "This assertion could be stricter" when the assertion already covers the behavior
- Consistency-only changes (wrapping a value in a conditional to match another pattern)
- "The regex doesn't handle edge case X" when the input is constrained and X never happens in practice
- "The test tests several guards simultaneously" — that's OK, tests don't need to isolate each guard
- Evaluation threshold changes — tuned empirically, change constantly
- Harmless no-ops (e.g. `.filter()` on an element that is never in the array)
- **Anything already fixed in the diff being reviewed** — read the FULL DIFF before commenting
