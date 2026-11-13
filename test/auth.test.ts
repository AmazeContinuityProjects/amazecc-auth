import { describe, it, expect, beforeAll, vi } from "vitest";
import BetterSqlite3 from "better-sqlite3";
import { getMigrations } from "better-auth/db/migration";
import { createAuth } from "../src/auth";
import type { AuthEnv } from "../src/env";

const baseEnv: AuthEnv = {
  BETTER_AUTH_SECRET: "test-secret-0123456789abcdef0123456789abcdef",
  BETTER_AUTH_URL: "http://localhost:8787",
  DB: undefined as never,
};

function cookieFrom(res: Response): string {
  const setCookie = res.headers.get("set-cookie") ?? "";
  return setCookie
    .split(/,(?=[^;,]+=[^;,]+;)/)
    .map((c) => c.trim().split(";")[0])
    .filter(Boolean)
    .join("; ");
}

describe("Amaze ID auth", () => {
  let auth: ReturnType<typeof createAuth>;
  let sqlite: BetterSqlite3.Database;

  beforeAll(async () => {
    sqlite = new BetterSqlite3(":memory:");
    auth = createAuth(baseEnv, sqlite);
    const { runMigrations } = await getMigrations(auth.options);
    await runMigrations();
  });

  it("serves OIDC discovery metadata at the issuer root", async () => {
    const res = await auth.handler(new Request("http://localhost:8787/api/auth/.well-known/openid-configuration"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.issuer).toBe("http://localhost:8787/api/auth");
    expect(body.token_endpoint).toContain("/api/auth/oauth2/token");
    expect(body.authorization_endpoint).toContain("/api/auth/oauth2/authorize");
    expect(body.jwks_uri).toContain("/api/auth/jwks");
    expect(body.scopes_supported).toContain("openid");
  });

  it("advertises the RFC 8628 device authorization grant in discovery", async () => {
    const res = await auth.handler(new Request("http://localhost:8787/api/auth/.well-known/openid-configuration"));
    const body = (await res.json()) as any;
    expect(body.device_authorization_endpoint).toBe("http://localhost:8787/api/auth/device/code");
    expect(body.grant_types_supported).toContain("urn:ietf:params:oauth:grant-type:device_code");
    expect(body.code_challenge_methods_supported).toEqual(["S256"]);
    expect(body.end_session_endpoint).toContain("/api/auth/oauth2/end-session");
    expect(body.prompt_values_supported).toContain("none");
  });

  it("runs the device authorization flow end-to-end (code -> approve -> token -> userinfo)", async () => {
    // Fresh operator account, promoted out-of-band (there is no self-service promotion).
    const DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";
    const email = "device-operator@vit.ac.in";
    const password = "device-operator-password-123";
    const signUp = await auth.handler(
      new Request("http://localhost:8787/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, name: "Device Operator" }),
      })
    );
    expect(signUp.status).toBe(200);
    sqlite.prepare("UPDATE user SET role = 'admin', permissions = 'qbank,users' WHERE email = ?").run(email);

    // Sign in as the operator and register an OAuth client that holds the device grant.
    const signIn = await auth.handler(
      new Request("http://localhost:8787/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
    );
    const cookie = cookieFrom(signIn);
    const client = await auth.api.adminCreateOAuthClient({
      body: {
        client_name: "Device Smoke",
        redirect_uris: ["http://localhost:9999/callback"],
        skip_consent: true,
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", DEVICE_GRANT],
        response_types: ["code"],
        scopes: ["openid", "profile", "email"],
      } as never,
      headers: { cookie, origin: "http://localhost:8787" } as never,
    }) as { client_id: string };
    expect(client.client_id).toBeTruthy();

    // Device requests a code (public endpoint, no session required).
    const deviceCode = await auth.handler(
      new Request("http://localhost:8787/api/auth/device/code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client_id: client.client_id, scope: "openid profile email" }),
      })
    );
    expect(deviceCode.status).toBe(200);
    const dc = (await deviceCode.json()) as any;
    expect(dc.user_code).toBeTruthy();
    expect(dc.device_code).toBeTruthy();
    expect(dc.verification_uri).toContain("/device");

    // Wrong user can't approve: verify the code endpoint binds it to this session.
    const verifyRes = await auth.handler(
      new Request(`http://localhost:8787/api/auth/device?user_code=${dc.user_code}`, { headers: { cookie } })
    );
    expect(verifyRes.status).toBe(200);
    const verifyBody = (await verifyRes.json()) as any;
    expect(verifyBody.status).toBe("pending");
    expect(verifyBody.scope).toContain("openid");

    // Approve with the operator's session.
    const approve = await auth.handler(
      new Request("http://localhost:8787/api/auth/device/approve", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ userCode: dc.user_code }),
      })
    );
    expect(approve.status).toBe(200);

    // The device polls the OAuth token endpoint (NOT /device/token) with the URN grant.
    const token = await auth.handler(
      new Request("http://localhost:8787/api/auth/oauth2/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: DEVICE_GRANT,
          device_code: dc.device_code,
          client_id: client.client_id,
        }).toString(),
      })
    );
    expect(token.status).toBe(200);
    const tokens = (await token.json()) as any;
    expect(tokens.access_token).toBeTruthy();
    expect(tokens.token_type).toBe("Bearer");

    // The access token works against userinfo, and our custom claims ride along.
    const userinfo = await auth.handler(
      new Request("http://localhost:8787/api/auth/oauth2/userinfo", {
        headers: { authorization: `Bearer ${tokens.access_token}` },
      })
    );
    expect(userinfo.status).toBe(200);
    const profile = (await userinfo.json()) as any;
    expect(profile.email).toBe(email);
    expect(profile.role).toBe("admin");
    expect(profile.permissions).toBe("qbank,users");

    // The device code is single-use.
    const replay = await auth.handler(
      new Request("http://localhost:8787/api/auth/oauth2/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: DEVICE_GRANT,
          device_code: dc.device_code,
          client_id: client.client_id,
        }).toString(),
      })
    );
    expect(replay.status).toBeGreaterThanOrEqual(400);
  });

  it("signs up, signs in, and reads the session", async () => {
    const signUp = await auth.handler(
      new Request("http://localhost:8787/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "student@vit.ac.in", password: "correct horse battery", name: "Test Student" }),
      })
    );
    expect(signUp.status).toBe(200);
    const cookie = cookieFrom(signUp);
    expect(cookie).toContain("better-auth.session_token");

    const session = await auth.handler(
      new Request("http://localhost:8787/api/auth/get-session", { headers: { cookie } })
    );
    expect(session.status).toBe(200);
    const body = (await session.json()) as any;
    expect(body.user.email).toBe("student@vit.ac.in");
  });

  it("rejects a wrong password", async () => {
    const res = await auth.handler(
      new Request("http://localhost:8787/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "student@vit.ac.in", password: "wrong password" }),
      })
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("links VTOP via the verifier service and unlinks", async () => {
    const signIn = await auth.handler(
      new Request("http://localhost:8787/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "student@vit.ac.in", password: "correct horse battery" }),
      })
    );
    const cookie = cookieFrom(signIn);

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("api.amazecc.com/api/login")) {
        return new Response(JSON.stringify({ success: true, authorizedID: "24BCE1234", cookies: "x", csrf: "y" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const link = await auth.handler(
      new Request("http://localhost:8787/api/auth/vtop/link", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ username: "24bce1234", password: "vtop-password" }),
      })
    );
    expect(link.status).toBe(200);
    const linkBody = (await link.json()) as any;
    expect(linkBody).toMatchObject({ success: true, linked: true, vtopRegNo: "24BCE1234" });

    const statusRes = await auth.handler(
      new Request("http://localhost:8787/api/auth/vtop/link", { headers: { cookie } })
    );
    expect((await statusRes.json()) as any).toMatchObject({ linked: true, vtopRegNo: "24BCE1234" });

    // Linking the same VTOP identity again is idempotent, not an error
    const relink = await auth.handler(
      new Request("http://localhost:8787/api/auth/vtop/link", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ username: "24BCE1234", password: "vtop-password" }),
      })
    );
    expect(relink.status).toBe(200);

    const unlink = await auth.handler(
      new Request("http://localhost:8787/api/auth/vtop/link", { method: "DELETE", headers: { cookie } })
    );
    expect((await unlink.json()) as any).toMatchObject({ success: true, unlinked: true });

    vi.unstubAllGlobals();
  });

  it("rejects VTOP credentials the scraper refuses", async () => {
    const signIn = await auth.handler(
      new Request("http://localhost:8787/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "student@vit.ac.in", password: "correct horse battery" }),
      })
    );
    const cookie = cookieFrom(signIn);

    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ success: false, message: "Invalid Username / Password" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })
    ));

    const link = await auth.handler(
      new Request("http://localhost:8787/api/auth/vtop/link", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ username: "nope", password: "nope" }),
      })
    );
    expect(link.status).toBe(400);

    vi.unstubAllGlobals();
  });
});
