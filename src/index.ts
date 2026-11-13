import { Hono } from "hono";
import { createAuth } from "./auth";
import type { AuthEnv } from "./env";
import { accountPage, consentPage, signInPage } from "./pages";

const app = new Hono<{ Bindings: AuthEnv }>();

// Liveness/readiness for Cloudflare + uptime monitors.
app.get("/health", (c) => c.json({ ok: true, service: "amazecc-auth" }));

// better-auth handles /api/auth/* (email+password, OAuth/OIDC provider, vtop link).
app.on(["GET", "POST"], "/api/auth/*", (c) => createAuth(c.env).handler(c.req.raw));

// Issuer metadata is served by better-auth under its base path
// (/api/auth/.well-known/*). Redirect the RFC 8414 root-level locations there
// so naive clients that probe the host root still discover correctly.
app.get("/.well-known/openid-configuration", (c) =>
  c.redirect("/api/auth/.well-known/openid-configuration", 308)
);
app.get("/.well-known/oauth-authorization-server", (c) =>
  c.redirect("/api/auth/.well-known/oauth-authorization-server", 308)
);

// vtop-link endpoints also live at the friendlier /api/vtop/link path.
app.on(["GET", "POST", "DELETE"], "/api/vtop/link", (c) => {
  const url = new URL(c.req.url);
  url.pathname = "/api/auth/vtop/link";
  return createAuth(c.env).handler(new Request(url.toString(), c.req.raw));
});

const page = (c: { header: (k: string, v: string) => void }, body: string) => {
  c.header("cache-control", "no-store");
  c.header("content-type", "text/html; charset=utf-8");
  return body;
};

app.get("/", (c) => c.redirect("/sign-in", 302));
app.get("/sign-in", (c) => c.html(page(c, signInPage())));
app.get("/consent", (c) => c.html(page(c, consentPage())));
app.get("/account", (c) => c.html(page(c, accountPage())));

export default app;
