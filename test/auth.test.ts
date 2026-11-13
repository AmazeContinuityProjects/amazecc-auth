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

  beforeAll(async () => {
    const sqlite = new BetterSqlite3(":memory:");
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
