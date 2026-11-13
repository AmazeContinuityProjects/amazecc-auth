/**
 * Full OIDC authorization-code + PKCE roundtrip against a running Amaze ID.
 * Proves: sign-up -> session -> authorize (skip consent) -> code -> token -> userinfo.
 * Usage: node scripts/oidc-smoke.mjs [--base-url http://localhost:8787]
 */
import crypto from "node:crypto";

const base = (process.argv.includes("--base-url") ? process.argv[process.argv.indexOf("--base-url") + 1] : "http://localhost:8787").replace(/\/+$/, "");

const jar = [];
const cookieHeader = () => jar.map((c) => c.split(";")[0]).join("; ");
function collect(res) {
  for (const c of res.headers.getSetCookie?.() ?? (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")] : [])) {
    const pair = c.split(";")[0];
    const name = pair.split("=")[0];
    const i = jar.findIndex((j) => j.split("=")[0] === name);
    if (i >= 0) jar[i] = pair; else jar.push(pair);
  }
}

const email = `smoke-${Date.now()}@example.com`;
const password = "smoke-test-password-123";

const signUp = await fetch(`${base}/api/auth/sign-up/email`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: base },
  body: JSON.stringify({ email, password, name: "OIDC Smoke" }),
});
collect(signUp);
console.log("sign-up:", signUp.status);
if (!signUp.ok) { console.error(await signUp.text()); process.exit(1); }

// The smoke client is seeded separately via scripts/register-client.mjs; read it from argv
const clientId = process.argv.includes("--client-id") ? process.argv[process.argv.indexOf("--client-id") + 1] : "amazecc-smoke";
const redirectUri = process.argv.includes("--redirect-uri") ? process.argv[process.argv.indexOf("--redirect-uri") + 1] : "http://localhost:9999/callback";

const verifier = crypto.randomBytes(48).toString("base64url");
const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
const state = crypto.randomBytes(16).toString("hex");

const authz = new URL(`${base}/api/auth/oauth2/authorize`);
authz.searchParams.set("client_id", clientId);
authz.searchParams.set("redirect_uri", redirectUri);
authz.searchParams.set("response_type", "code");
authz.searchParams.set("scope", "openid profile email");
authz.searchParams.set("state", state);
authz.searchParams.set("code_challenge", challenge);
authz.searchParams.set("code_challenge_method", "S256");

const authzRes = await fetch(authz, { headers: { cookie: cookieHeader() }, redirect: "manual" });
collect(authzRes);
console.log("authorize:", authzRes.status, "->", authzRes.headers.get("location")?.slice(0, 60));

let redirectUrl;
if (authzRes.status === 302 || authzRes.status === 303 || authzRes.status === 307) {
  redirectUrl = authzRes.headers.get("location");
} else if (authzRes.status === 200) {
  // Non-navigation requests get the redirect as a JSON envelope instead of a 302.
  const body = await authzRes.json().catch(() => null);
  if (body && body.redirect && body.url) redirectUrl = body.url;
}
if (!redirectUrl) {
  console.error("authorize did not yield a redirect");
  process.exit(1);
}
const loc = new URL(redirectUrl);
const code = loc.searchParams.get("code");
console.log("code received:", Boolean(code), "state ok:", loc.searchParams.get("state") === state);

const tokenRes = await fetch(`${base}/api/auth/oauth2/token`, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  }),
});
const token = await tokenRes.json();
collect(tokenRes);
console.log("token:", tokenRes.status, "access_token:", Boolean(token.access_token), "id_token:", Boolean(token.id_token));
if (!token.access_token) { console.error(token); process.exit(1); }

const userinfo = await fetch(`${base}/api/auth/oauth2/userinfo`, {
  headers: { authorization: `Bearer ${token.access_token}` },
});
console.log("userinfo:", userinfo.status, JSON.stringify(await userinfo.json()));
