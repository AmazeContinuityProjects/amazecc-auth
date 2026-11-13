# amazecc-auth — Amaze ID

The identity provider for AmazeContinuityProjects. One account (**Amaze ID**) that
works across every AmazeCP app, with an optional link to the student's VTOP account.
Failed logins never touch VTOP — VTOP is proven once, at link time, server-to-server.

- **Production:** https://auth.amazecc.com
- **Issuer:** `https://auth.amazecc.com/api/auth`
- **Discovery:** `https://auth.amazecc.com/api/auth/.well-known/openid-configuration`
- **Stack:** Hono + [better-auth](https://better-auth.com) 1.7 on Cloudflare Workers, Cloudflare D1
- **Repo role:** this worker is the ONLY thing on the OIDC path. `api.amazecc.com` (AmazeCC-API, Next.js) keeps the VTOP scraper and nothing else; non-VTOP routes move to `amazecc-api-hono`.

## What works today

- Email + password sign-up/sign-in (internal UUID subject, `vtopRegNo` optional extra field)
- Worker-rendered `/sign-in`, `/sign-up`, `/consent`, `/account` pages (Microsoft/Google-grade SSO look; `logo.png` served from the worker)
- Full OIDC / OAuth 2.1 provider (authorization code + PKCE, refresh tokens, JWKS, userinfo, introspection, revocation, back-channel logout, client credentials grant, DPoP-ready)
- Optional VTOP linking: `POST /api/vtop/link` → server calls `VTOP_LOGIN_URL` (default `https://api.amazecc.com/api/login`) with the presented credentials, stores only the reg number (`authorizedID`) as `account { providerId: "vtop" }` and mirrors it onto `user.vtopRegNo`. The VTOP password is never stored, logged, or returned.
- Admin primitives (`user.role`, default `user`; `admin` for operators) — the future home of the admin/club claim migration
- Sessions in D1 (30-day rolling), rate limits in D1

## Develop

```sh
pnpm install
pnpm exec wrangler d1 migrations apply amazecc-auth --local   # create local D1 tables
pnpm dev                                                       # wrangler dev on :8787
```

`BETTER_AUTH_SECRET` for local dev goes in `.dev.vars` (see `.dev.vars.example`).
D1 is emulated locally by miniflare under `.wrangler/`.

```sh
pnpm test          # vitest — sign-up/sign-in/session/vtop-link/OIDC discovery roundtrip
pnpm typecheck     # tsc --noEmit
pnpm generate-migration   # regenerate migrations/0001_init.sql from the better-auth config
```

## Deploy

Already done once (2026-11-13): D1 `amazecc-auth` created + migrated, `BETTER_AUTH_SECRET`
set, custom domain `auth.amazecc.com` attached (zone is on the "Sugeethjayaraj2007@outlook.com's
Account" account — pinned via `account_id` in `wrangler.toml`).

```sh
pnpm exec wrangler d1 migrations apply amazecc-auth --remote   # apply schema changes
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))" | pnpm exec wrangler secret put BETTER_AUTH_SECRET
pnpm exec wrangler deploy
```

## Setting an admin (bootstrap)

There is deliberately no self-service role assignment. After a user signs up:

```sh
pnpm exec wrangler d1 execute amazecc-auth --remote --command \
  "UPDATE user SET role='admin' WHERE email='you@example.com'"
```

## Registering an app as an OIDC client

First-party clients should use `skip_consent: 1` so the SSO hop is seamless.
Only `user.role = "admin"` accounts may register clients (`clientPrivileges`).
The registration endpoint is `SERVER_ONLY` — it is never exposed over HTTP — so
registration is a server-side operation:

**Local rehearsal** (writes only to the local D1 state):

```sh
pnpm exec wrangler d1 migrations apply amazecc-auth --local   # once
# create + promote an operator account, see "Setting an admin"
DB=$(find .wrangler/state/v3/d1 -name '*.sqlite' | head -1)
pnpm exec vite-node scripts/register-client.mjs --base-url http://127.0.0.1:8791 \
  --email admin@amaze.local --password '...' \
  --name "AmazeCC Web" --type public \
  --redirect-uris "http://127.0.0.1:3000/auth/callback" \
  --skip-consent true --local-db "$DB"
```

Then verify the whole flow with `scripts/oidc-smoke.mjs --base-url http://127.0.0.1:8791 --client-id <id> --redirect-uri <uri>` (full authorization-code + PKCE + token + userinfo roundtrip).

**Production** is an operator procedure — see the migration plan
(`docs/01-authentication/amaze-id-migration.md` in AmazeCC-API). Public clients
(e.g. amazecc-web, Kotlin/Flutter) are plain `INSERT`s; confidential clients
need a scrypt hash of the client secret.

Notes:
- **Web clients require https redirect URIs** outside loopback. Plain HTTP is
  allowed only on literal loopback hosts (`localhost`, `127.0.0.1`, `[::1]`) —
  see `allowInsecureRedirectUri` in `src/auth.ts`.
- `localhost` is accepted by the validator for native clients; for web clients
  use `http://127.0.0.1:<port>/...` or `https://` URLs.
- On this dev machine, a network filter rewrites the `Origin` header of
  requests whose origin is `localhost:<same-port>` — sign-in from local tools
  returns `Invalid origin`. Workaround: use `127.0.0.1`, and for browser-based
  local testing only, `DISABLE_ORIGIN_CHECK=true` in `.dev.vars` (dev-only;
  never set in prod).

OIDC endpoints are under `/api/auth`:

| Endpoint | URL |
|---|---|
| Discovery | `/api/auth/.well-known/openid-configuration` |
| Authorize | `/api/auth/oauth2/authorize` |
| Token | `/api/auth/oauth2/token` |
| JWKS | `/api/auth/jwks` |
| Userinfo | `/api/auth/oauth2/userinfo` |
| End session | `/api/auth/oauth2/end-session` |

The host root exposes `/health`, `/.well-known/*` (308 redirects), `/sign-in`, `/consent`, `/account`.

## Environment

| Variable | Where | Purpose |
|---|---|---|
| `BETTER_AUTH_SECRET` | secret | Session/JWKS signing root (48 random bytes, base64) |
| `BETTER_AUTH_URL` | var | `https://auth.amazecc.com` |
| `VTOP_LOGIN_URL` | var | Server-to-server VTOP verifier |
| `VTOP_SERVICE_SECRET` | secret (optional) | `x-service-secret` header for the VTOP verifier |
| `TRUSTED_ORIGINS` | var (optional) | Extra origins beyond `BETTER_AUTH_URL` |

## Known gaps / next

- **Email delivery** is not wired up, so `requireEmailVerification` is `false`. Add a mail provider and flip it before public sign-ups open.
- **Production OAuth client registration** is an operator procedure (see migration plan); there is intentionally no public self-registration (`allowDynamicClientRegistration: false`).
- **FFCS accounts** federate in Phase 3 — see the migration plan.
