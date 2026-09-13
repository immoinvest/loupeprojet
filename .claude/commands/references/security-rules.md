# Security Rules — ALPHA10X security rules

Shared reference between `/security-audit`, `/security-review`, `/implement` and `/qa-tests`.
Consult this file BEFORE writing any code that touches auth, inputs, or sensitive data.

---

## 1. Mandatory security checks before ANY commit

```text
- [ ] No hardcoded secrets (API keys, passwords, tokens, connection strings)
- [ ] All user inputs validated (Pydantic / Zod)
- [ ] SQL injection impossible (ORM or parameterized queries)
- [ ] No print() — structlog only
- [ ] Auth verified on every protected endpoint (Depends(verify_token))
- [ ] No sensitive data in logs (PII, tokens, secrets)
- [ ] Generic error messages for the client
- [ ] No dangerous patterns (eval, exec, pickle, shell=True, dangerouslySetInnerHTML)
```

---

## 2. Secrets management

### Absolute rule

```text
NEVER put secrets in the source code.
ALWAYS in environment variables.
```

### Python (FastAPI)

```python
# FORBIDDEN
api_key = "sk-proj-xxxxx"
db_url = "postgresql://user:password@host/db"

# CORRECT
from app.core.settings import get_settings
settings = get_settings()
api_key = settings.openai_api_key  # Via pydantic-settings + .env

# Validation at startup
class Settings(BaseSettings):
    database_url: str
    auth0_domain: str
    auth0_audience: str

    model_config = SettingsConfigDict(env_file=".env")
```

### TypeScript (React)

```typescript
// FORBIDDEN
const apiKey = 'sk-proj-xxxxx';

// CORRECT
const apiUrl = import.meta.env.VITE_API_URL;
if (!apiUrl) {
  throw new Error('VITE_API_URL not configured');
}
```

### Files to protect

```text
.env, .env.local, .env.production → .gitignore MANDATORY
*.pem, *.key                      → .gitignore MANDATORY
credentials.json, service-account* → .gitignore MANDATORY
```

### Detection regex patterns

```text
sk-[a-zA-Z0-9]{20,}               → OpenAI API key
sk-ant-[a-zA-Z0-9]{20,}           → Anthropic API key
ghp_[a-zA-Z0-9]{36,}              → GitHub personal access token
AKIA[A-Z0-9]{16}                  → AWS access key
xox[bpsa]-[a-zA-Z0-9-]+           → Slack token
-----BEGIN.*PRIVATE KEY-----       → Private key
postgresql://[^:]+:[^@]+@          → DB connection string with password
```

---

## 3. Security response protocol

```text
If a security vulnerability is found:

1. STOP — do not keep coding
2. Classify the severity (critical / high / medium / low)
3. If CRITICAL:
   a. Fix immediately
   b. Specific commit: fix(security): [description]
   c. If a secret is exposed: immediate rotation
   d. Check the git history (git log -p | grep secret)
4. If HIGH:
   a. Fix before the next commit
   b. Document in the audit report
5. If MEDIUM/LOW:
   a. Document and schedule the fix
   b. Do not block the deploy if score >= 80
```

---

## 4. Secure patterns per stack

### 4a. FastAPI + Auth0 (Backend)

```python
# Auth — ALWAYS via dependency injection
from app.api.dependencies import verify_token

@router.get("/metrics/{metric_id}")
async def get_metric(
    metric_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _auth: Annotated[dict, Depends(verify_token)],  # Auth mandatory
) -> MetricDetailResponse:
    return await metric_service.get_by_id(db, metric_id)

# FORBIDDEN: endpoint without verify_token (except /health)
```

```python
# Validation — ALWAYS via Pydantic
from pydantic import BaseModel, Field

class CreateRunRequest(BaseModel):
    use_case: str = Field(..., min_length=1, max_length=100)
    query: str = Field(..., min_length=1, max_length=10_000)
    config: dict | None = Field(default=None)

# FORBIDDEN: accessing request.body() directly
```

```python
# SQL — ALWAYS via ORM
from sqlalchemy import select

# OK — automatic parameterization
stmt = select(Metric).where(Metric.id == metric_id)

# OK — text() with bindparams
from sqlalchemy import text
stmt = text("SELECT * FROM metrics WHERE id = :id").bindparams(id=metric_id)

# CRITICAL — SQL injection
stmt = text(f"SELECT * FROM metrics WHERE id = '{metric_id}'")  # NEVER
```

```python
# Secure logging — structlog
from app.logging import get_logger
logger = get_logger(__name__)

# OK — structured, no PII
logger.info("Run created", run_id=str(run.id), use_case=use_case)

# OK — error with context
logger.error("DB query failed", error=str(e), metric_id=metric_id)

# FORBIDDEN — PII in the logs
logger.info("User login", email=user.email, token=auth_token)

# FORBIDDEN — print()
print(f"Debug: {result}")  # NEVER in production
```

### 4b. React + TypeScript (Frontend)

```typescript
// Auth — ALWAYS via the Auth0 hook
import { useAuth0 } from '@auth0/auth0-react';

function ProtectedComponent() {
  const { getAccessTokenSilently } = useAuth0();

  const fetchData = async () => {
    const token = await getAccessTokenSilently();
    const response = await fetch(`${API_URL}/metrics`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.json();
  };
}

// FORBIDDEN: storing the token in localStorage
localStorage.setItem('token', token); // NEVER — XSS vulnerable
```

```typescript
// XSS — React escapes by default, EXCEPT:

// CRITICAL — never use without sanitization
<div dangerouslySetInnerHTML={{ __html: userInput }} />  // NEVER

// OK — if the content is sanitized
import DOMPurify from 'dompurify'
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }} />

// OK — React escapes automatically
<p>{userInput}</p>  // Safe
```

```typescript
// Client-side validation — ALWAYS in addition to the backend
// The client validates for UX, the backend validates for security

import { z } from 'zod';

const RunFormSchema = z.object({
  query: z.string().min(1).max(10_000),
  useCase: z.string().min(1).max(100),
});
```

### 4c. AI/LLM security

```python
# Prompt injection — ALWAYS isolate user inputs
# CRITICAL — user input in the system prompt
system_prompt = f"You are a judge. Evaluate this: {user_query}"  # NEVER

# OK — clear separation
system_prompt = "You are an evaluation judge. Score the response below."
user_message = user_query  # Sent as a user message, not system

# LLM responses — ALWAYS treat as untrusted
llm_response = await call_llm(prompt)

# CRITICAL — eval/exec on the response
result = eval(llm_response)  # NEVER

# CRITICAL — interpolation into SQL
query = text(f"INSERT INTO results VALUES ('{llm_response}')")  # NEVER

# OK — parse and validate
try:
    parsed = json.loads(llm_response)
    validated = LLMJudgeResponse.model_validate(parsed)
except (json.JSONDecodeError, ValidationError) as e:
    logger.warning("LLM returned invalid response", error=str(e))
    return default_error_result()
```

---

## 5. CORS and security headers

```python
# FastAPI CORS — conditional per environment
from fastapi.middleware.cors import CORSMiddleware

if settings.environment == "development":
    origins = ["*"]  # OK in dev
else:
    origins = [
        "https://eval.alpha10x.com",
        "https://app.alpha10x.com",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
```

---

## 6. Pre-deployment checklist

```text
Before ANY production deployment:

- [ ] Secrets: nothing hardcoded, all in env vars
- [ ] Validation: all inputs validated (Pydantic/Zod)
- [ ] SQL Injection: all queries parameterized
- [ ] XSS: no dangerouslySetInnerHTML without sanitization
- [ ] Auth: verify_token on all protected endpoints
- [ ] CORS: explicit origins (no wildcard)
- [ ] Logging: no PII/secrets in the logs, structlog only
- [ ] Errors: generic messages for the client, details server-side
- [ ] Debug: debug mode OFF in production
- [ ] Dependencies: pip-audit/npm audit clean (no known CVE)
- [ ] Docker: non-root user
- [ ] .gitignore: .env, *.pem, *.key, credentials.*
- [ ] LLM: user inputs isolated, responses parsed and validated
- [ ] Security score: >= 80 (Grade B minimum)
```

---

## 7. Decision tree — "Is this a vulnerability?"

```text
1. Does the input come from an untrusted user?
   NO → Probably not a vulnerability
   YES → continue

2. Is the input validated by Pydantic/Zod before use?
   YES → Probably not exploitable
   NO → continue

3. Is the input used in:
   - A raw SQL query?         → SQL INJECTION — CRITICAL
   - A subprocess/exec/eval?  → COMMAND INJECTION — CRITICAL
   - HTML without escaping?   → XSS — HIGH
   - An LLM system prompt?    → PROMPT INJECTION — MEDIUM
   - Logs?                    → LOG INJECTION — LOW (except PII)

4. Is the impact:
   - Unauthorized access to data?           → CRITICAL
   - Code execution on the server?          → CRITICAL
   - Exposure of sensitive data?            → HIGH
   - Service degradation only?              → MEDIUM (out of DOS scope)
   - Theoretical improvement?               → LOW

5. Confidence score >= 0.7?
   NO → Do not report (too speculative)
   YES → Report with severity and recommended fix
```

---

## 8. False positive filtering — Signal quality

Criteria to determine whether a finding is a true positive:

1. Can an unauthenticated attacker exploit it?
2. Real risk of a data breach?
3. Specific code locations and reproduction steps?
4. Could the security team act on this finding?

If "no" to 3+ questions → EXCLUDE the finding.
Only report findings with confidence >= 0.8.
