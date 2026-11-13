/**
 * Register an OIDC client with Amaze ID as an admin user.
 *
 * The OAuth-client registration endpoint is SERVER_ONLY — it is never routed
 * over HTTP. Registration happens server-side against the D1 database. For a
 * local rehearsal, point --local-db at the local D1 sqlite file (created by
 * `wrangler d1 migrations apply amazecc-auth --local`):
 *
 *   node scripts/register-client.mjs --base-url http://127.0.0.1:8791 \
 *     --email admin@amaze.local --password '...' \
 *     --name "AmazeCC Web" --type public \
 *     --redirect-uris "https://amazecc.com/auth/callback,http://localhost:3000/auth/callback" \
 *     --local-db .wrangler/state/v3/d1/miniflare-D1DatabaseObject/<id>.sqlite
 *
 * For production, use the operator SQL procedure in
 * docs/01-authentication/amaze-id-migration.md in the AmazeCC-API repo —
 * public clients need no secret and are plain INSERTs; confidential clients
 * need a scrypt-hashed client secret produced with better-auth's own hasher.
 *
 * Requires the signed-in user to have role `admin` (see README bootstrap).
 */
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, [])
);

const base = (args["base-url"] ?? "http://127.0.0.1:8791").replace(/\/+$/, "");
const { email, password, name } = args;
const type = args["type"] ?? "public";
const redirectUris = (args["redirect-uris"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const skipConsent = args["skip-consent"] !== "false";
const localDb = args["local-db"];

if (!email || !password || !name || redirectUris.length === 0 || !localDb) {
  console.error("Required: --email --password --name --redirect-uris <uri,uri> --local-db <path-to-d1-sqlite>. Optional: --base-url --type public|confidential --skip-consent false");
  process.exit(1);
}

// Sign in over HTTP to obtain a session cookie (proves the admin account works
// and gives us a session for the server-side role check).
const signIn = await fetch(`${base}/api/auth/sign-in/email`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: base },
  body: JSON.stringify({ email, password }),
});
if (!signIn.ok) {
  console.error(`Sign-in failed (${signIn.status}):`, await signIn.text());
  process.exit(1);
}
const cookie = (signIn.headers.getSetCookie?.() ?? [signIn.headers.get("set-cookie")])
  .filter(Boolean)
  .map((c) => c.trim().split(";")[0])
  .join("; ");

const clientBody = {
  client_name: name,
  redirect_uris: redirectUris,
  skip_consent: skipConsent,
  ...(type === "public" ? { token_endpoint_auth_method: "none", require_pkce: true } : {}),
};

// SERVER_ONLY endpoint — call it server-side against the local D1 sqlite.
// The session cookie is signed with BETTER_AUTH_SECRET, so reuse the dev value.
const { readFileSync } = await import("node:fs");
const devVars = Object.fromEntries(
  readFileSync(".dev.vars", "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; })
);
const { createAuth } = await import("../src/auth.ts");
const BetterSqlite3 = (await import("better-sqlite3")).default;
const sqlite = new BetterSqlite3(localDb);
const auth = createAuth(
  {
    BETTER_AUTH_SECRET: devVars.BETTER_AUTH_SECRET ?? "local-registration-secret-0123456789abcdef0123456789abcdef",
    BETTER_AUTH_URL: devVars.BETTER_AUTH_URL ?? base,
    DB: undefined,
  },
  sqlite
);
const created = await auth.api.adminCreateOAuthClient({
  body: clientBody,
  headers: { cookie, origin: base },
});
console.log("Client registered (store the secret now — it is hashed at rest and never shown again):\n");
console.log(JSON.stringify(created, null, 2));
sqlite.close();
