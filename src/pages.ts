/**
 * Worker-rendered pages: sign-in, sign-up, consent, account.
 *
 * Clean, enterprise-grade SSO pages with a colorful backdrop (Microsoft /
 * Google-style sign-in). Plain HTML + vanilla JS, no CDN dependencies.
 * When `?sig=` is present the browser is mid-OAuth-authorize; forms then
 * submit as full-page POSTs carrying `oauth_query` (a signed copy of
 * the query string) so better-auth can resume the authorization request
 * after the session is created.
 */

const css = `
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
html, body { margin: 0; }

/* Light canvas with a subtle chromatic sweep (like Microsoft/Google). */
body {
  min-height: 100vh; display: grid; place-items: center; padding: 32px 20px;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Inter, Roboto, sans-serif;
  background:
    radial-gradient(1200px 800px at 10% -10%, #c7d2fe 0%, transparent 50%),
    radial-gradient(1000px 700px at 100% 80%, #fde68a 0%, transparent 50%),
    radial-gradient(800px 600px at 50% 120%, #fecaca 0%, transparent 50%),
    #f8fafc;
  color: #1c1917;
}

/* Dark variant — same colorful radial sweep, darker base. */
@media (prefers-color-scheme: dark) {
  body {
    background:
      radial-gradient(1200px 800px at 10% -10%, #1e1b4b 0%, transparent 50%),
      radial-gradient(1000px 700px at 100% 80%, #3b0764 0%, transparent 50%),
      radial-gradient(800px 600px at 50% 120%, #7f1d1d 0%, transparent 50%),
      #09090b;
    color: #e4e4e7;
  }
}

.wrap { width: 100%; max-width: 406px; }

.brand { display: flex; flex-direction: column; align-items: center; gap: 6px; margin-bottom: 22px; }
.logo { width: 56px; height: 56px; border-radius: 13px; box-shadow: 0 6px 18px rgba(0,0,0,.25); }
.brand-name { font-size: 16px; font-weight: 650; letter-spacing: -.01em; color: inherit; }

.card {
  background: #ffffff; border: 1px solid #e7e5e4; border-radius: 14px;
  padding: 36px 36px 28px;
  box-shadow: 0 20px 50px rgba(28, 25, 23, .18), 0 2px 6px rgba(28, 25, 23, .08);
}

@media (prefers-color-scheme: dark) {
  .card {
    background: #18181b; border: 1px solid #27272a;
    box-shadow: 0 20px 50px rgba(0, 0, 0, .55), 0 2px 6px rgba(0, 0, 0, .35);
  }
}

h1 { font-size: 23px; line-height: 1.25; margin: 0; letter-spacing: -.015em; color: #111827; font-weight: 600; }
@media (prefers-color-scheme: dark) { h1 { color: #fafafa; } }
.sub { color: #605e5c; font-size: 14px; margin: 8px 0 22px; line-height: 1.45; }
@media (prefers-color-scheme: dark) { .sub { color: #a1a1aa; } }

label { display: block; font-size: 13px; font-weight: 600; color: #323130; margin: 16px 0 6px; }
@media (prefers-color-scheme: dark) { label { color: #d4d4d8; } }

input[type=email], input[type=password], input[type=text] {
  width: 100%; height: 42px; padding: 0 12px; border-radius: 9px; font-size: 15px;
  border: 1.5px solid #d1d5db; background: #ffffff; color: #111827; outline: none;
  transition: border-color .15s, box-shadow .15s;
}
@media (prefers-color-scheme: dark) {
  input[type=email], input[type=password], input[type=text] {
    background: #27272a; border-color: #3f3f46; color: #fafafa;
  }
  input::placeholder { color: #71717a; }
}
input::placeholder { color: #a3a29e; }
input:focus { border-color: #d97706; box-shadow: 0 0 0 3px rgba(217,119,6,.18); }

button {
  width: 100%; height: 44px; margin-top: 22px; padding: 0 16px; border: 0; border-radius: 9px;
  font-weight: 650; font-size: 15px; cursor: pointer; color: #1a1206;
  background: linear-gradient(135deg, #fcd34d 0%, #fb923c 100%);
  letter-spacing: .005em;
  transition: filter .15s, transform .05s;
}
button:hover { filter: brightness(1.04); }
button:active { transform: translateY(1px); }
button:disabled { opacity: .65; cursor: default; transform: none; }

button.secondary {
  color: #323130; background: #ffffff; border: 1.5px solid #d1d5db; font-weight: 600;
}
@media (prefers-color-scheme: dark) {
  button.secondary { color: #e4e4e7; background: #27272a; border-color: #3f3f46; }
  button.secondary:hover { background: #3f3f46; }
}
button.secondary:hover { background: #f9fafb; }

.error { display: none; margin: 14px 0 0; padding: 12px 14px; border-radius: 9px;
  background: #fdf2f2; border: 1px solid #f3c2c2; color: #b91c1c; font-size: 13.5px; line-height: 1.45; }
@media (prefers-color-scheme: dark) {
  .error { background: #2d0c0c; border-color: #7f1d1d; color: #fca5a5; }
}
.ok { display: none; margin: 14px 0 0; padding: 12px 14px; border-radius: 9px;
  background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; font-size: 13.5px; line-height: 1.45; }
@media (prefers-color-scheme: dark) {
  .ok { background: #0f1f16; border-color: #14532d; color: #86efac; }
}

.toggle { margin-top: 18px; text-align: center; font-size: 13.5px; color: #605e5c; }
@media (prefers-color-scheme: dark) { .toggle { color: #a1a1aa; } }
.toggle a { color: #b45309; text-decoration: none; font-weight: 600; }
@media (prefers-color-scheme: dark) { .toggle a { color: #fbbf24; } }
.toggle a:hover { text-decoration: underline; }

.scope { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 12.5px;
  background: #f5f5f4; border: 1px solid #e7e5e4; border-radius: 8px; padding: 9px 12px; margin: 6px 0; color: #44403c; }
@media (prefers-color-scheme: dark) {
  .scope { background: #27272a; border-color: #3f3f46; color: #a1a1aa; }
}
.row { display: flex; gap: 10px; }
.row button { margin-top: 18px; }

.kv { display: flex; justify-content: space-between; gap: 12px; font-size: 13.5px; padding: 10px 0; border-bottom: 1px solid #e7e5e4; }
@media (prefers-color-scheme: dark) { .kv { border-bottom-color: #27272a; color: #a1a1aa; } }
.kv span:first-child { color: #605e5c; }
@media (prefers-color-scheme: dark) { .kv span:first-child { color: #a1a1aa; } }
.kv span:last-child { color: #111827; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
@media (prefers-color-scheme: dark) { .kv span:last-child { color: #fafafa; } }

.footer { margin-top: 18px; padding-top: 16px; border-top: 1px solid #eceae8; font-size: 11.5px; color: #8a8784; text-align: center; line-height: 1.5; }
@media (prefers-color-scheme: dark) { .footer { border-top-color: #27272a; color: #71717a; } }
.tiny { margin-top: 12px; font-size: 11px; color: #8a8784; text-align: center; }
@media (prefers-color-scheme: dark) { .tiny { color: #71717a; } }
:focus-visible { outline: 2px solid #d97706; outline-offset: 2px; }
`;

/** Replicates buildSignedOAuthQuery from @better-auth/oauth-provider/client. */
const signedQuerySnippet = `
function oauthQuery(search) {
  var params = new URLSearchParams(search);
  if (!params.has("sig")) return null;
  var names = params.getAll("ba_param");
  if (!names.length) return null;
  var allowed = new Set(names);
  var out = new URLSearchParams();
  params.forEach(function (v, k) {
    if (k === "sig" || k === "ba_param" || allowed.has(k)) out.append(k, v);
  });
  return out.toString();
}
`;

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<link rel="icon" href="/logo.png" type="image/png" />
<title>${title} — Amaze ID</title>
<style>${css}</style>
</head>
<body>${body}</body>
</html>`;
}

function brand(): string {
  return `<div class="brand">
  <img class="logo" src="/logo.png" alt="AmazeCC" width="56" height="56" />
  <div class="brand-name">Amaze ID</div>
</div>`;
}

export function signInPage(mode: "sign-in" | "sign-up" = "sign-in"): string {
  const isSignUp = mode === "sign-up";
  return page(isSignUp ? "Create account" : "Sign in", `
<main class="wrap">
  <div class="card">
    ${brand()}
    <h1>${isSignUp ? "Create your Amaze ID" : "Sign in"}</h1>
    <p class="sub">${isSignUp
      ? "Your Amaze ID works across every AmazeCC app — one account, one password."
      : "Use your Amaze ID to continue to AmazeContinuityProjects."}</p>

    <form id="form" method="post" action="${isSignUp ? "/api/auth/sign-up/email" : "/api/auth/sign-in/email"}">
      <input type="hidden" name="oauth_query" id="oauth_query" />
      <div id="name-row" style="${isSignUp ? "" : "display:none"}">
        <label for="name">Full name</label>
        <input id="name" name="name" type="text" autocomplete="name" maxlength="80" placeholder="e.g. Sugeeth Kumar" />
      </div>
      <label for="email">Email</label>
      <input id="email" name="email" type="email" required autocomplete="email" autofocus placeholder="you@vit.ac.in" />
      <label for="password">Password</label>
      <input id="password" name="password" type="password" required minlength="8" autocomplete="${isSignUp ? "new-password" : "current-password"}" placeholder="${isSignUp ? "8+ characters" : "••••••••"}" />
      <button type="submit" id="submit">${isSignUp ? "Create Amaze ID" : "Sign in"}</button>
    </form>

    <p class="error" id="error"></p>
    <p class="toggle">${isSignUp
      ? 'Already have an Amaze ID? <a href="/sign-in">Sign in instead</a>'
      : 'Don\'t have an Amaze ID? <a href="/sign-up">Create one</a>'}</p>
  </div>
  <p class="footer">AmazeContinuityProjects</p>
</main>
<script>
${signedQuerySnippet}
(function () {
  var search = window.location.search;
  var q = oauthQuery(search);
  var isOAuth = Boolean(q);
  var form = document.getElementById("form");
  var oauthInput = document.getElementById("oauth_query");
  var submit = document.getElementById("submit");
  var err = document.getElementById("error");

  if (isOAuth) {
    oauthInput.value = q;
    // keep the toggle link in this OAuth flow so "Create one" resumes correctly
    var t = document.querySelector(".toggle a");
    if (t) t.href = t.getAttribute("href").split("?")[0] + "?" + window.location.search.slice(1);
    return; // full-page POST; the server resumes the OAuth flow on success
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    err.style.display = "none";
    submit.disabled = true;
    try {
      var payload = { email: document.getElementById("email").value, password: document.getElementById("password").value };
      var nameRow = document.getElementById("name-row");
      var isSignUp = nameRow && nameRow.style.display !== "none";
      if (isSignUp) {
        var name = document.getElementById("name").value.trim();
        payload.name = name || payload.email.split("@")[0];
      }
      var res = await fetch(form.action, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "same-origin",
      });
      var body = await res.json().catch(function () { return null; });
      if (!res.ok) {
        err.textContent = (body && (body.message || (body.error && body.error.message))) || "Something went wrong. Please try again.";
        err.style.display = "block";
        submit.disabled = false;
        return;
      }
      var next = new URLSearchParams(search).get("next");
      window.location.assign(next && next.startsWith("/") ? next : "/account");
    } catch (_) {
      err.textContent = "Network error. Please try again.";
      err.style.display = "block";
      submit.disabled = false;
    }
  });
})();
</script>`);
}

export function consentPage(): string {
  return page("Authorize", `
<main class="wrap">
  <div class="card">
    ${brand()}
    <h1>Authorize application</h1>
    <p class="sub">An application wants to sign you in with Amaze ID.</p>
    <p class="sub" style="margin-bottom:6px">Requested access:</p>
    <div id="scopes"></div>
    <form id="consent-form">
      <input type="hidden" id="scope" />
      <div class="row">
        <button type="submit" name="accept" value="false" class="secondary">Deny</button>
        <button type="submit" name="accept" value="true">Allow</button>
      </div>
    </form>
    <p class="error" id="error"></p>
  </div>
  <p class="footer">AmazeContinuityProjects — you can revoke access later, per app, in each app's settings.</p>
</main>
<script>
${signedQuerySnippet}
(function () {
  var search = window.location.search;
  var params = new URLSearchParams(search);
  var scope = params.get("scope") || "openid profile email";
  document.getElementById("scope").value = scope;
  document.getElementById("scopes").innerHTML = scope.split(/\\s+/).filter(Boolean).map(function (s) {
    return '<div class="scope">' + s.replace(/[<>&]/g, "") + '</div>';
  }).join("");

  var q = oauthQuery(search);
  var form = document.getElementById("consent-form");
  var err = document.getElementById("error");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    err.style.display = "none";
    var accept = e.submitter && e.submitter.value === "true";
    var res = await fetch("/api/auth/oauth2/consent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(Object.assign({ accept: accept, scope: scope }, q ? { oauth_query: q } : {})),
    }).catch(function () { return null; });
    var body = res ? await res.json().catch(function () { return null; }) : null;
    if (res && res.ok && body && body.redirect && body.url) {
      window.location.assign(body.url);
      return;
    }
    err.textContent = (body && (body.message || body.error_description)) || "Could not process your decision.";
    err.style.display = "block";
  });
})();
</script>`);
}

export function accountPage(): string {
  return page("Account", `
<main class="wrap">
  <div class="card">
    ${brand()}
    <h1>Your Amaze ID</h1>
    <p class="sub">One account for every AmazeContinuityProjects app — AmazeCC, Club Hub, GoRoBo, FFCS, and more.</p>
    <div class="kv"><span>Email</span><span id="email">…</span></div>
    <div class="kv"><span>Name</span><span id="name">…</span></div>
    <div class="kv"><span>VTOP</span><span id="vtop">…</span></div>

    <form id="vtop-form">
      <label for="vtop-user" style="margin-top:18px">Link VTOP account <span style="color:#a3a29e;font-weight:500">(optional)</span></label>
      <input id="vtop-user" type="text" placeholder="VTOP username" autocomplete="off" required />
      <label for="vtop-pass" style="margin-top:12px">VTOP password</label>
      <input id="vtop-pass" type="password" placeholder="VTOP password" autocomplete="off" required />
      <button type="submit" id="vtop-submit">Link VTOP account</button>
    </form>
    <button id="vtop-unlink" class="secondary" style="display:none;margin-top:12px">Unlink VTOP account</button>
    <p class="error" id="error"></p>
    <p class="ok" id="ok"></p>

    <button id="signout" class="secondary">Sign out</button>
  </div>
  <p class="footer">AmazeContinuityProjects</p>
</main>
<script>
(function () {
  var err = document.getElementById("error");
  var ok = document.getElementById("ok");
  function showErr(msg) { err.textContent = msg; err.style.display = "block"; ok.style.display = "none"; }
  function showOk(msg) { ok.textContent = msg; ok.style.display = "block"; err.style.display = "none"; }

  async function refresh() {
    var s = await fetch("/api/auth/get-session", { credentials: "same-origin" });
    if (!s.ok) { window.location.assign("/sign-in?next=/account"); return; }
    var session = await s.json();
    if (!session || !session.user) { window.location.assign("/sign-in?next=/account"); return; }
    document.getElementById("email").textContent = session.user.email;
    document.getElementById("name").textContent = session.user.name;
    var v = await fetch("/api/vtop/link", { credentials: "same-origin" });
    var state = await v.json().catch(function () { return {}; });
    document.getElementById("vtop").textContent = state.linked ? state.vtopRegNo : "not linked";
    document.getElementById("vtop-unlink").style.display = state.linked ? "block" : "none";
    document.getElementById("vtop-form").style.display = state.linked ? "none" : "block";
  }

  document.getElementById("vtop-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var btn = document.getElementById("vtop-submit");
    btn.disabled = true;
    var res = await fetch("/api/vtop/link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        username: document.getElementById("vtop-user").value,
        password: document.getElementById("vtop-pass").value,
      }),
    }).catch(function () { return null; });
    btn.disabled = false;
    if (!res) return showErr("Network error. Please try again.");
    var body = await res.json().catch(function () { return {}; });
    if (!res.ok) return showErr(body.message || "Could not verify your VTOP credentials.");
    document.getElementById("vtop-pass").value = "";
    showOk("VTOP linked: " + body.vtopRegNo);
    refresh();
  });

  document.getElementById("vtop-unlink").addEventListener("click", async function () {
    var res = await fetch("/api/vtop/link", { method: "DELETE", credentials: "same-origin" });
    if (res.ok) { showOk("VTOP unlinked."); refresh(); } else showErr("Could not unlink VTOP.");
  });

  document.getElementById("signout").addEventListener("click", async function () {
    await fetch("/api/auth/sign-out", { method: "POST", credentials: "same-origin" });
    window.location.assign("/sign-in");
  });

  refresh();
})();
</script>`);
}

export function devicePage(): string {
  return page("Authorize device", `
<main class="wrap">
  <div class="card">
    ${brand()}
    <h1>Authorize a device</h1>
    <p class="sub">A device or app wants to sign you in with Amaze ID. Enter the code shown on it to continue.</p>

    <div id="step-code">
      <label for="user-code">One-time code</label>
      <input id="user-code" type="text" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" maxlength="16" placeholder="e.g. ABCD-EFGH" style="font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;letter-spacing:.08em;text-transform:uppercase" />
      <button id="continue" type="button">Continue</button>
      <p class="error" id="error"></p>
    </div>

    <div id="step-review" style="display:none">
      <p class="sub" style="margin-bottom:6px">This request will get access to:</p>
      <div id="device-info"></div>
      <div id="device-scopes"></div>
      <div class="row">
        <button id="deny" type="button" class="secondary">Deny</button>
        <button id="approve" type="button">Allow</button>
      </div>
      <p class="error" id="error2"></p>
    </div>

    <div id="step-done" style="display:none">
      <p class="ok" id="done-ok" style="display:block"></p>
      <p class="sub" style="margin-top:12px">You can close this page and return to your device.</p>
    </div>
  </div>
  <p class="footer">AmazeContinuityProjects — device access is revocable per device in each app's settings.</p>
</main>
<script>
(function () {
  var err = document.getElementById("error");
  var err2 = document.getElementById("error2");
  var codeInput = document.getElementById("user-code");
  var continueBtn = document.getElementById("continue");
  var stepCode = document.getElementById("step-code");
  var stepReview = document.getElementById("step-review");
  var stepDone = document.getElementById("step-done");
  var approveBtn = document.getElementById("approve");
  var denyBtn = document.getElementById("deny");
  var doneOk = document.getElementById("done-ok");

  var prefill = new URLSearchParams(window.location.search).get("user_code");
  if (prefill) codeInput.value = prefill;

  function show(el) { el.style.display = "block"; }
  function hide(el) { el.style.display = "none"; }
  function showErr(target, msg) { target.textContent = msg; target.style.display = "block"; }

  // The approval endpoints require an active Amaze ID session. If there is
  // none, send the user through sign-in first and come straight back here.
  fetch("/api/auth/get-session", { credentials: "same-origin" }).then(function (res) {
    if (res.ok) {
      var code = codeInput.value.trim();
      if (code) verify(code);
      return;
    }
    var next = "/device" + (codeInput.value.trim() ? "?user_code=" + encodeURIComponent(codeInput.value.trim()) : "");
    window.location.assign("/sign-in?next=" + encodeURIComponent(next));
  }).catch(function () {
    window.location.assign("/sign-in?next=" + encodeURIComponent("/device"));
  });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function verify(code) {
    err.style.display = "none";
    continueBtn.disabled = true;
    fetch("/api/auth/device?user_code=" + encodeURIComponent(code), { credentials: "same-origin" })
      .then(async function (res) {
        continueBtn.disabled = false;
        var body = await res.json().catch(function () { return null; });
        if (!res.ok || !body) {
          showErr(err, (body && body.error_description) || "That code is invalid or has expired.");
          return;
        }
        if (body.status !== "pending") {
          hide(stepCode);
          show(stepDone);
          doneOk.textContent = body.status === "approved"
            ? "This device was already authorized. You can return to it."
            : "This device request was already handled.";
          return;
        }
        var info = document.getElementById("device-info");
        var rows = [];
        rows.push('<div class="kv"><span>Application</span><span>' + escapeHtml(body.client_id || "First-party app") + "</span></div>");
        if (body.resource) rows.push('<div class="kv"><span>Access to</span><span>' + escapeHtml(String(body.resource)) + "</span></div>");
        info.innerHTML = rows.join("");
        var scopeBox = document.getElementById("device-scopes");
        var scope = body.scope || "openid profile email";
        scopeBox.innerHTML = String(scope).split(/\s+/).filter(Boolean).map(function (s) {
          return '<div class="scope">' + escapeHtml(s) + "</div>";
        }).join("");
        hide(stepCode);
        show(stepReview);
      })
      .catch(function () {
        continueBtn.disabled = false;
        showErr(err, "Network error. Check your connection and try again.");
      });
  }

  continueBtn.addEventListener("click", function () {
    var code = codeInput.value.trim().toUpperCase();
    if (!code) { showErr(err, "Enter the code shown on your device."); return; }
    verify(code);
  });
  codeInput.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); continueBtn.click(); } });

  function decide(accept) {
    err2.style.display = "none";
    approveBtn.disabled = true;
    denyBtn.disabled = true;
    fetch(accept ? "/api/auth/device/approve" : "/api/auth/device/deny", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ userCode: codeInput.value.trim().toUpperCase() }),
    })
      .then(async function (res) {
        var body = await res.json().catch(function () { return null; });
        if (!res.ok) {
          approveBtn.disabled = false;
          denyBtn.disabled = false;
          showErr(err2, (body && body.error_description) || "Could not process your decision.");
          return;
        }
        hide(stepReview);
        show(stepDone);
        doneOk.textContent = accept ? "Device authorized. You can return to it." : "Device denied.";
      })
      .catch(function () {
        approveBtn.disabled = false;
        denyBtn.disabled = false;
        showErr(err2, "Network error. Please try again.");
      });
  }

  approveBtn.addEventListener("click", function () { decide(true); });
  denyBtn.addEventListener("click", function () { decide(false); });
})();
</script>`);
}

