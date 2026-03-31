# Phase 12: Security Hardening - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix all security issues identified in the 2026-03-29 audit: rotate exposed credentials, remove leaked env files from repo and git history, patch npm vulnerabilities, add Content-Security-Policy, sanitize error responses, upgrade Helmet, and tighten CORS/rate limiting against abuse.

</domain>

<decisions>
## Implementation Decisions

### Credential rotation
- Rotate Supabase database password (production credentials exposed in `.env.supabase.bak`)
- Rotate Resend API key (`re_jfmE3V9S_...` exposed in `.env`)
- ACLED credentials are commented out and blocked anyway — rotate when access is granted
- Remove `.env.supabase.bak` from repository
- Scrub git history using `git filter-repo` to remove all credential traces — force push to origin/master (accepted: collaborators need to re-clone)

### Error response policy
- Claude's discretion on implementation
- Must not expose raw `err.message` to clients (currently leaks DB table names, connection details)
- Return generic error messages to clients, log full details server-side

### CORS & access restrictions
- CORS open for GET requests only — block POST/PUT/DELETE from cross-origin
- Tighten rate limiting to prevent read endpoint flooding (current 200 req/15min may be too generous)
- Protect `/data/ingestion-health` endpoint more aggressively (exposes infrastructure details)

### npm vulnerabilities
- Run `npm audit fix` to patch 6 of 7 vulnerabilities
- Document the remaining xlsx HIGH vulnerability (no fix available)

### Security headers
- Upgrade Helmet from v3 to v7
- Add Content-Security-Policy with tight directives for the app's known external resources (MapLibre, CartoCDN, Google Fonts)

### Claude's Discretion
- Exact rate limit numbers (per-endpoint or global, threshold values)
- CSP directive details (which external sources to whitelist)
- Whether to add a pre-commit hook for secret scanning
- Error response format (error codes, generic messages, or structured)
- How to handle the multer dependency (installed but unused)
- Whether to remove the ingestion-health endpoint from public access entirely or just rate-limit it harder

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Server security
- `server/server.ts` — CORS config (line 21), Helmet (line 19), rate limiter (lines 26-36), static serving
- `server/routes/dataRoute.ts` — All data endpoints with error handling patterns
- `server/controllers/api/data/dataController.ts` — Route whitelist (lines 120-125), error responses
- `server/controllers/api/data/ingestionHealthController.ts` — Health endpoint exposing error messages

### Credentials
- `.env` — Current env vars (DB connection, Resend key, ACLED creds)
- `.env.example` — Template showing expected vars
- `.env.supabase.bak` — MUST BE REMOVED (contains production credentials)
- `server/database/connection.ts` — DB connection config, SSL settings

### Dependencies
- `package.json` — helmet v3.18.0, multer (unused), xlsx (has HIGH vuln)

</canonical_refs>

<code_context>
## Existing Code Insights

### Current Security Stack
- `helmet@^3.18.0` — outdated, provides basic headers only
- `cors()` — wide open, no origin or method restrictions
- `express-rate-limit` v8 — 200 req/15min on `/data/*` routes only
- Knex.js — parameterized queries (SQL injection safe)

### Error Handling Pattern
- All routes in dataRoute.ts catch errors and return `res.status(500).json({ error: (err as Error).message })`
- Same pattern in ingestionHealthController.ts

### Integration Points
- `server/server.ts` — all middleware configured here
- `.gitignore` — needs `.env.supabase.bak` and potentially stricter `.env*` patterns

</code_context>

<specifics>
## Specific Ideas

- The force push for git history scrubbing should be coordinated — Will (co-creator) may need to re-clone
- The app serves a museum exhibit — availability matters, so rate limits shouldn't be so aggressive that legitimate high-traffic exhibit usage gets blocked
- ACLED credentials should be handled properly from the start when access is granted (Phase 9)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-security-hardening*
*Context gathered: 2026-03-29*
