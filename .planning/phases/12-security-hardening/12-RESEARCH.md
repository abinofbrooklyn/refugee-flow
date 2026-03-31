# Phase 12: Security Hardening - Research

**Researched:** 2026-03-30
**Domain:** Express.js security hardening — credentials, Helmet v3→v8, CSP, CORS, rate limiting, error sanitization, git history scrub
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Rotate Supabase database password (production credentials exposed in `.env.supabase.bak`)
- Rotate Resend API key (`re_jfmE3V9S_...` exposed in `.env`)
- ACLED credentials are commented out and blocked anyway — rotate when access is granted
- Remove `.env.supabase.bak` from repository
- Scrub git history using `git filter-repo` to remove all credential traces — force push to origin/master (accepted: collaborators need to re-clone)
- CORS open for GET requests only — block POST/PUT/DELETE from cross-origin
- Tighten rate limiting to prevent read endpoint flooding (current 200 req/15min may be too generous)
- Protect `/data/ingestion-health` endpoint more aggressively (exposes infrastructure details)
- Run `npm audit fix` to patch 6 of 7 vulnerabilities
- Document the remaining xlsx HIGH vulnerability (no fix available)
- Upgrade Helmet from v3 to v7
- Add Content-Security-Policy with tight directives for the app's known external resources (MapLibre, CartoCDN, Google Fonts)
- Must not expose raw `err.message` to clients (currently leaks DB table names, connection details)
- Return generic error messages to clients, log full details server-side

### Claude's Discretion
- Exact rate limit numbers (per-endpoint or global, threshold values)
- CSP directive details (which external sources to whitelist)
- Whether to add a pre-commit hook for secret scanning
- Error response format (error codes, generic messages, or structured)
- How to handle the multer dependency (installed but unused)
- Whether to remove the ingestion-health endpoint from public access entirely or just rate-limit it harder

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

## Summary

This phase addresses a credential exposure audit finding and hardens the Express.js security posture across five axes: (1) credentials and git history cleanup, (2) npm vulnerability patching, (3) Helmet upgrade from v3 to v8 with a proper Content-Security-Policy, (4) error response sanitization, and (5) CORS and rate-limit tightening.

The credential situation is less severe than the audit suggested: neither `.env` nor `.env.supabase.bak` were ever committed to git. Both files exist only on disk, where they are correctly gitignored. The `.env.supabase.bak` file still holds live production Supabase and Resend credentials in plaintext alongside the current `.env` file. These must be rotated regardless, and `.env.supabase.bak` must be deleted from disk.

Because no credential files appear in git history, `git filter-repo` has nothing to scrub from the history. The CONTEXT.md decision to scrub and force-push was made before this was confirmed. The planner should document this finding — git history scrub is a no-op, only disk deletion and credential rotation are required.

**Primary recommendation:** Upgrade Helmet to v8, configure CSP for MapLibre/CartoCDN/Google Fonts, sanitize all error responses to generic messages, restrict CORS to GET+HEAD, apply stricter rate limiting to `/data/ingestion-health`, delete `.env.supabase.bak`, and rotate Supabase + Resend credentials.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| helmet | 8.1.0 (latest) | Security headers including CSP, HSTS, X-Frame-Options | Industry standard, 13 headers in one call |
| cors | 2.8.6 (current) | CORS with method/origin options | Already installed, just needs configuration |
| express-rate-limit | 8.3.1 (current, already installed) | Per-route rate limiting | Already installed, needs tighter config |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| git-filter-repo | system install | Git history scrubbing | Only needed if credentials appear in git history — confirmed NOT needed here |
| gitleaks (optional) | v8.22+ | Pre-commit secret scanning | Discretion item — prevents future credential leaks |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| helmet v8 | csp-only package | helmet covers all headers in one dep; csp-only is redundant |
| cors `methods` option | custom middleware | cors package handles preflight correctly; custom is error-prone |

**Installation:**
```bash
npm install helmet@^8.1.0 --legacy-peer-deps
# cors and express-rate-limit already installed, no version change needed
```

**Version verification:**
```bash
npm view helmet version   # confirmed 8.1.0
npm view express-rate-limit version   # confirmed 8.3.1
```

---

## Architecture Patterns

### Recommended Project Structure
No new directories needed. All changes are confined to:
```
server/
├── server.ts                    # helmet, cors, rate limiter — primary change surface
├── routes/dataRoute.ts          # error responses — all 7 catch blocks
├── controllers/api/data/
│   ├── dataController.ts        # no changes — errors bubble to dataRoute.ts
│   └── ingestionHealthController.ts  # error response in getIngestionHealth
.env.example                     # add DATABASE_URL_PRODUCTION, RESEND_API_KEY
```

### Pattern 1: Helmet v8 with CSP

Helmet v8 requires Node 18+. In v8 the single `helmet()` call accepts all sub-middleware config.
Do NOT call `helmet.referrerPolicy()` separately — that v3 pattern is replaced by the unified options object.

```typescript
// Source: https://helmetjs.github.io/
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://*.basemaps.cartocdn.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      connectSrc: ["'self'", 'https://*.basemaps.cartocdn.com'],
      workerSrc: ["'self'", 'blob:'],
      childSrc: ["'self'", 'blob:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  referrerPolicy: { policy: 'no-referrer' },
  crossOriginEmbedderPolicy: false,  // disabled by default in v7+, explicitly off for map tiles
}));
```

**Key CSP findings (MEDIUM confidence, verified against MapLibre source + official docs):**
- MapLibre GL JS spawns Web Workers via `blob:` URL — requires `worker-src blob:` and `child-src blob:`
- CartoCDN dark-matter tiles: `img-src https://*.basemaps.cartocdn.com`, `connect-src https://*.basemaps.cartocdn.com`
- Google Fonts (if used): `style-src https://fonts.googleapis.com`, `font-src https://fonts.gstatic.com`
- `unsafe-inline` in `style-src` is required by Helmet's own defaults and is acceptable for non-injected content
- `upgrade-insecure-requests` — use empty array `[]` to include directive with no values; use `null` to disable

**Breaking changes from v3 to v8:**
- v3 API: `helmet()` + separate `helmet.referrerPolicy()` calls — use unified `helmet({ referrerPolicy: ... })` in v8
- v8 throws hard errors for unquoted keywords (e.g., `self` must be `'self'` with single quotes)
- v8 HSTS default max-age increased to 365 days (from 180)
- `crossOriginEmbedderPolicy` was disabled by default in v7+
- `@types/helmet` devDependency should be removed — v8 ships its own TypeScript types

### Pattern 2: CORS GET-only

```typescript
// Source: https://expressjs.com/en/resources/middleware/cors.html
import cors from 'cors';

app.use(cors({
  origin: '*',         // public data — all origins permitted for reads
  methods: ['GET', 'HEAD'],
}));
```

CORS `methods` restricts which HTTP methods browsers allow cross-origin. `GET` and `HEAD` cover all legitimate read access. POST/PUT/DELETE will be blocked by preflight. This does not affect server-to-server requests or same-origin requests — only browser cross-origin.

### Pattern 3: Per-endpoint rate limiting

```typescript
// Source: https://github.com/express-rate-limit/express-rate-limit
import rateLimit from 'express-rate-limit';

// General data API — generous for exhibit traffic (kiosk = single IP)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,             // slightly higher: exhibit kiosk + normal browsers
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded. Try again in 15 minutes.' },
});

// Ingestion health — exposes infrastructure, should be tight
const healthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests.' },
});

app.use('/data', apiLimiter);
// healthLimiter applied before the route in dataRoute.ts or server.ts
router.get('/ingestion-health', healthLimiter, getIngestionHealth);
```

**Museum exhibit context:** The exhibit runs on kiosk hardware at a fixed location. All visitors at a single exhibit installation share one IP. 200 req/15min for a single IP is tight if 30 visitors each load the page (6 data endpoints each = 180 requests). Recommended: raise global to 300-500 req/15min and apply 10 req/15min specifically to `/ingestion-health`.

### Pattern 4: Error response sanitization

Replace all occurrences of `res.status(500).json({ error: (err as Error).message })` with:

```typescript
// Apply to every catch block in dataRoute.ts and ingestionHealthController.ts
} catch (err) {
  console.error('[API error]', err);  // full error logged server-side
  res.status(500).json({ error: 'Internal server error' });
}
```

This is a manual find-and-replace across 7 catch blocks in `dataRoute.ts` (6 routes) + 1 in `ingestionHealthController.ts`. The `findRouteDeath` route with unknown-route guard already returns `[]` (not an error), which is correct.

### Anti-Patterns to Avoid
- **Calling `helmet.referrerPolicy()` separately (v3 pattern):** In v8 this is configured via `helmet({ referrerPolicy: ... })`. Calling the separate function is removed.
- **`npm audit fix` without `--legacy-peer-deps`:** This project has the `eslint-config-airbnb` peer conflict — all npm commands that resolve deps must use `--legacy-peer-deps`.
- **`worker-src` without `child-src`:** For broad browser compat, both must be set to `blob:` for MapLibre workers. `worker-src` alone is not supported in all browsers.
- **Removing `@types/helmet` before confirming v8 ships its own types:** Helm v8 ships bundled `.d.ts` files; the separate `@types/helmet` package is outdated and may cause type conflicts.
- **Using `null` to set CSP directives to empty vs. to disable:** `null` = remove directive entirely; `[]` = include directive with no values (e.g. `upgrade-insecure-requests`).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Security headers | Custom header middleware | helmet v8 | Covers 13 headers, CSP defaults, ongoing maintenance |
| CORS method restriction | Manual req.method checks | cors `methods` option | Handles preflight OPTIONS correctly |
| Rate limiting per IP | Custom in-memory counters | express-rate-limit | Already installed, handles window rollover, cluster-safe |
| Secret scanning | Regex grep pre-commit scripts | gitleaks | Covers 160+ secret types, maintained rules |

**Key insight:** CORS method restriction via custom middleware is particularly risky — it's easy to miss the OPTIONS preflight request, which browsers use for pre-checking. The `cors` package handles this correctly.

---

## Common Pitfalls

### Pitfall 1: Git filter-repo on clean history
**What goes wrong:** Running `git filter-repo --invert-paths --path .env.supabase.bak` when the file was never committed rewrites all commit SHAs for no reason, forces all collaborators to re-clone, and provides zero security benefit.
**Why it happens:** Audit finds credential file on disk, assumes it was committed.
**How to avoid:** `git log --all -- '.env.supabase.bak'` returns empty. The file is gitignored and only on disk. Delete from disk only.
**Warning signs:** `git log --all -- <file>` returns zero commits.

### Pitfall 2: Helmet CSP breaking the map
**What goes wrong:** CSP blocks blob: worker URLs causing MapLibre GL to fail silently (the map renders blank or tiles don't load).
**Why it happens:** MapLibre spawns Web Workers via `URL.createObjectURL(blob)` — blocked by default CSP `worker-src 'self'`.
**How to avoid:** Set `workerSrc: ["'self'", 'blob:']` and `childSrc: ["'self'", 'blob:']`.
**Warning signs:** Browser console shows `Content Security Policy: The page's settings blocked an inline script` or worker errors.

### Pitfall 3: CSP breaking CartoCDN tiles
**What goes wrong:** Map tiles fail to load because `img-src` and `connect-src` don't whitelist CartoCDN domains.
**Why it happens:** Helmet's default `img-src 'self' data:'` doesn't include external CDN.
**How to avoid:** Add `https://*.basemaps.cartocdn.com` to both `imgSrc` and `connectSrc`.
**Warning signs:** Map shows no tile imagery; network tab shows blocked requests to basemaps.cartocdn.com.

### Pitfall 4: npm audit fix peer conflict
**What goes wrong:** `npm audit fix` fails with eslint-config-airbnb peer conflict.
**Why it happens:** This project has a pre-existing peer conflict documented in STATE.md (`[Phase 02]: Use npm --legacy-peer-deps for uninstalls`).
**How to avoid:** Always run `npm audit fix --legacy-peer-deps`.
**Warning signs:** `Could not resolve dependency: peer eslint@"^7.32.0..."` error.

### Pitfall 5: Helmet v3 two-call pattern
**What goes wrong:** TypeScript types fail or headers are set twice/incorrectly.
**Why it happens:** Current `server.ts` has both `app.use(helmet())` AND `app.use(helmet.referrerPolicy({...}))` — valid in v3 but the separate call pattern changed in v5+.
**How to avoid:** Consolidate to single `app.use(helmet({ referrerPolicy: ..., contentSecurityPolicy: ... }))`.
**Warning signs:** TypeScript compiler error on `helmet.referrerPolicy` not being a function.

### Pitfall 6: Rate limit too aggressive for exhibit kiosk
**What goes wrong:** Exhibit visitors get 429 errors because a kiosk is a single IP with many sequential users.
**Why it happens:** A museum kiosk appears as one IP for all visitors. 6 data endpoints × 33 visitors = 198 requests — hits the current 200 limit.
**How to avoid:** Set global data limit to 300-500 req/15min for normal routes; apply 10 req/15min only to `/ingestion-health`.
**Warning signs:** Exhibit visitors see errors after busy periods.

### Pitfall 7: `@types/helmet` conflict with v8
**What goes wrong:** TypeScript compilation errors like "Duplicate identifier" or type conflicts.
**Why it happens:** Helmet v8 ships bundled TypeScript types; `@types/helmet@^0.0.48` in devDependencies is for v3 and conflicts.
**How to avoid:** Remove `@types/helmet` from `devDependencies` when upgrading to v8.

---

## Code Examples

### Full Helmet v8 configuration with CSP for this app

```typescript
// Source: https://helmetjs.github.io/
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,  // specify all directives explicitly for predictability
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
      imgSrc: [
        "'self'",
        'data:',
        'blob:',
        'https://*.basemaps.cartocdn.com',
        'https://*.cartocdn.com',
      ],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      connectSrc: [
        "'self'",
        'https://*.basemaps.cartocdn.com',
        'https://*.cartocdn.com',
      ],
      workerSrc: ["'self'", 'blob:'],
      childSrc: ["'self'", 'blob:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  referrerPolicy: { policy: 'no-referrer' },
  crossOriginEmbedderPolicy: false,
}));
```

### CORS GET-only configuration

```typescript
// Source: https://expressjs.com/en/resources/middleware/cors.html
import cors from 'cors';

app.use(cors({
  origin: '*',
  methods: ['GET', 'HEAD'],
}));
```

### Error sanitization pattern (replaces all 7 catch blocks)

```typescript
// Before (leaks DB internals):
} catch (err) {
  res.status(500).json({ error: (err as Error).message });
}

// After (safe):
} catch (err) {
  console.error('[API error]', err);
  res.status(500).json({ error: 'Internal server error' });
}
```

### npm audit fix command for this project

```bash
npm audit fix --legacy-peer-deps
```

### Helmet upgrade command

```bash
npm install helmet@^8.1.0 --legacy-peer-deps
# Also remove the outdated types package:
npm uninstall @types/helmet --legacy-peer-deps
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `helmet()` + separate `helmet.referrerPolicy()` calls | Single `helmet({ referrerPolicy: ... })` | Helmet v4 | Two calls must become one |
| `helmet.contentSecurityPolicy()` separate package | Built-in via `helmet({ contentSecurityPolicy: ... })` | Helmet v4 | No separate dep needed |
| `@types/helmet` devDependency | Bundled types in helmet v8 | Helmet v7 | Remove `@types/helmet` |
| `worker-src` only for blob workers | `worker-src blob:` + `child-src blob:` | Browser compat | Both required for Safari |

**Deprecated/outdated:**
- `helmet.referrerPolicy()` as standalone call: removed after v3, use option object
- `helmet.contentSecurityPolicy()` as standalone import: merged into main package
- `@types/helmet`: stale, conflicts with v8 bundled types — remove it

---

## Credential Rotation Findings

**CRITICAL FINDING (HIGH confidence):** `.env` and `.env.supabase.bak` are NOT in git history.

Verification:
```bash
git log --all -- '.env'            # returns zero commits
git log --all -- '.env.supabase.bak'  # returns zero commits
```

Both files are gitignored and only exist on disk. The `git filter-repo` scrub planned in CONTEXT.md is **not needed**. The security action required is:

1. Delete `.env.supabase.bak` from disk (the credential file that should not exist)
2. Rotate Supabase database password at supabase.com dashboard
3. Rotate Resend API key at resend.com dashboard
4. Update `.env` with new values
5. Update `.env.example` to document `DATABASE_URL_PRODUCTION` and `RESEND_API_KEY` as expected vars

The ACLED credentials (`ACLED_EMAIL`, `ACLED_PASSWORD`) are commented out in `.env` — no rotation needed now, handle when access is granted.

---

## npm Vulnerability Status

| Package | Severity | Fix Available | Notes |
|---------|----------|---------------|-------|
| handlebars | critical | Yes — `npm audit fix --legacy-peer-deps` | Transitive dep only |
| flatted | high | Yes | Transitive dep |
| path-to-regexp | high | Yes | Transitive dep |
| picomatch | high | Yes | Transitive dep |
| fast-xml-parser | moderate | Yes | Direct dep — will upgrade |
| brace-expansion | moderate | Yes | Transitive dep |
| xlsx | high | **No fix available** | Direct dep; used for CSV parsing in admin upload |

**xlsx situation:** No upstream fix exists. The GHSA advisories are Prototype Pollution and ReDoS. The xlsx package is used only in the admin CSV upload flow. Accepted risk: document in `acceptedRisks` in package.json (consistent with existing `three@0.91.0` precedent in REQUIREMENTS.md STAB-05). The admin route is protected by `ADMIN_SECRET` and is not publicly accessible.

**multer situation (Claude's Discretion):** `multer@^2.1.1` is installed as a direct dependency but unused since the admin upload was removed. Removing it eliminates one dep from the surface area. Recommended: uninstall it.

---

## Open Questions

1. **Google Fonts in CSP**
   - What we know: The app was described as using Google Fonts. No `<link>` to `fonts.googleapis.com` was seen in the server code, but frontend files weren't audited.
   - What's unclear: Whether any component imports Google Fonts via CDN vs. local font files
   - Recommendation: Include `https://fonts.googleapis.com` in `styleSrc` and `https://fonts.gstatic.com` in `fontSrc` as a precaution. If not needed, CSP violation reports will not appear and they are harmless additions.

2. **Ingestion-health: remove vs. rate-limit**
   - What we know: Endpoint exposes source names, staleness status, and error messages
   - What's unclear: Whether `lastError.message` in the health response leaks DB internals (it does — it's from `ingestion_log.error_message`, which stores raw exception messages)
   - Recommendation: Apply tight rate limit (10 req/15min) AND sanitize the `lastError.message` field in `ingestionHealthController.ts` to a generic string, or omit it from the public response. Keep endpoint public for operational convenience but strip sensitive data.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30 with ts-jest + supertest |
| Config file | `jest.config.js` (root), server project uses `tsconfig.server.json` |
| Quick run command | `npm test -- --testPathPattern=tests/server --passWithNoTests` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | Error responses never expose `err.message` | unit | `npm test -- --testPathPattern=tests/server/endpoints` | Partial — existing tests check status 200, need assertion that error field is generic string |
| SEC-02 | Rate limit returns 429 on `/data/ingestion-health` after 10 req | unit | `npm test -- --testPathPattern=tests/server/rateLimit` | Partial — existing rateLimit.test.ts covers the pattern, needs health-specific test |
| SEC-03 | CORS rejects POST from cross-origin | unit | New test in `tests/server/cors.test.ts` | No — Wave 0 gap |
| SEC-04 | Helmet CSP header present on responses | integration | New test in `tests/server/helmet.test.ts` | No — Wave 0 gap |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern=tests/server/endpoints --testPathPattern=tests/server/rateLimit`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/server/cors.test.ts` — covers SEC-03 (CORS method restriction)
- [ ] `tests/server/helmet.test.ts` — covers SEC-04 (security headers present)

*(Existing `tests/server/endpoints.test.ts` and `tests/server/rateLimit.test.ts` cover adjacent behaviors but need augmentation, not replacement)*

---

## Sources

### Primary (HIGH confidence)
- https://helmetjs.github.io/ — Helmet v8 API, CSP configuration, middleware options
- https://github.com/helmetjs/helmet/blob/main/CHANGELOG.md — Breaking changes v3→v4→v5→v6→v7→v8
- https://github.com/helmetjs/helmet/blob/main/middlewares/content-security-policy/README.md — CSP directive API
- https://expressjs.com/en/resources/middleware/cors.html — cors `methods` option
- `npm audit` output — current vulnerability list (run 2026-03-30)
- `git log --all -- '.env*'` — confirmed no credential files in git history (run 2026-03-30)
- `npm view helmet dist-tags` — confirmed v8.1.0 is latest

### Secondary (MEDIUM confidence)
- https://github.com/maplibre/maplibre-gl-js/discussions/4424 — MapLibre CSP requirements (`worker-src blob:`, `child-src blob:`)
- https://github.com/maplibre/maplibre-gl-js/commit/4cdbf11 — MapLibre static worker bundle for strict CSP
- https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository — git-filter-repo usage
- https://github.com/gitleaks/gitleaks — gitleaks pre-commit secret scanning

### Tertiary (LOW confidence)
- CartoCDN domain patterns (`*.basemaps.cartocdn.com`, `*.cartocdn.com`) — inferred from existing STATE.md decision referencing "CartoCDN dark-matter public style"; specific subdomain patterns not directly verified from CartoCDN docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified via `npm view`, APIs verified against official docs
- Architecture: HIGH — Helmet and cors APIs confirmed from official sources; MapLibre CSP MEDIUM (community sources)
- Pitfalls: HIGH — most derived from actual code inspection + verified breaking changes
- Credential situation: HIGH — confirmed via `git log --all` that no credentials are in history

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable domain; Helmet/cors APIs are stable)
