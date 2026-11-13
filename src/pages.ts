/**
 * Worker-rendered pages: sign-in, consent, account.
 *
 * These exist so the OIDC flow works end-to-end without a separate frontend
 * deployment. They are plain HTML + vanilla JS and intentionally avoid CDN
 * dependencies. When `?sig=` is present the browser is mid-OAuth-authorize;
 * forms then submit as full-page POSTs carrying `oauth_query` (a signed copy
 * of the query string) so better-auth can resume the authorization request
 * after the session is created.
 */

const css = `
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
body {
  margin: 0; min-height: 100vh; display: grid; place-items: center;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Inter, Roboto, sans-serif;
  background: radial-gradient(1200px 800px at 70% -10%, #2b2154 0%, transparent 60%),
              radial-gradient(1000px 700px at -10% 110%, #1c2a52 0%, transparent 55%),
              #0d0d14;
  color: #e8e8ef; padding: 24px;
}
.card {
  width: 100%; max-width: 420px; background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.09); border-radius: 18px;
  padding: 32px; backdrop-filter: blur(12px);
  box-shadow: 0 24px 60px rgba(0,0,0,.45);
}
.brand { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
.logo {
  width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center;
  background: linear-gradient(135deg, #f5c451 0%, #e2827a 100%);
  font-weight: 800; font-size: 20px; color: #1a1206;
}
h1 { font-size: 22px; margin: 0; letter-spacing: -.01em; }
.sub { color: #a3a3b6; font-size: 13px; margin: 4px 0 22px; }
label { display: block; font-size: 12px; color: #b9b9cb; margin: 14px 0 6px; }
input[type=email], input[type=password], input[type=text] {
  width: 100%; padding: 11px 13px; border-radius: 10px; font-size: 14px;
  border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.05); color: #fff; outline: none;
}
input:focus { border-color: #f5c451; box-shadow: 0 0 0 3px rgba(245,196,81,.15); }
button {
  width: 100%; margin-top: 18px; padding: 12px; border: 0; border-radius: 10px;
  font-weight: 700; font-size: 14px; cursor: pointer; color: #1a1206;
  background: linear-gradient(135deg, #f5c451 0%, #e2827a 100%);
}
button.secondary { background: rgba(255,255,255,.08); color: #e8e8ef; font-weight: 600; }
button:disabled { opacity: .6; cursor: default; }
.toggle { margin-top: 14px; text-align: center; font-size: 13px; color: #a3a3b6; }
.toggle a { color: #f5c451; text-decoration: none; }
.error { display: none; margin-top: 14px; padding: 10px 12px; border-radius: 10px;
  background: rgba(255,80,80,.12); border: 1px solid rgba(255,80,80,.35); color: #ffb3b3; font-size: 13px; }
.ok { display: none; margin-top: 14px; padding: 10px 12px; border-radius: 10px;
  background: rgba(80,220,140,.10); border: 1px solid rgba(80,220,140,.35); color: #a9f0c6; font-size: 13px; }
.scope { font-family: ui-monospace, monospace; font-size: 12px; background: rgba(255,255,255,.06);
  border-radius: 8px; padding: 8px 10px; margin: 6px 0; }
.row { display: flex; gap: 10px; }
.row button { margin-top: 20px; }
.kv { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,.07); }
.kv span:last-child { color: #fff; font-family: ui-monospace, monospace; }
.footer { margin-top: 20px; font-size: 11px; color: #6f6f84; text-align: center; }
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
<title>${title} · Amaze ID</title>
<style>${css}</style>
</head>
<body>${body}</body>
</html>`;
}

export function signInPage(): string {
  return page("Sign in", `
<main class="card">
  <div class="brand"><div class="logo">A</div><div><h1>Amaze ID</h1></div></div>
  <p class="sub" id="sub">One account for all of AmazeContinuityProjects.</p>

  <form id="form" method="post" action="/api/auth/sign-in/email">
    <input type="hidden" name="oauth_query" id="oauth_query" />
    <div id="name-row" style="display:none">
      <label for="name">Name</label>
      <input id="name" name="name" type="text" autocomplete="name" maxlength="80" />
    </div>
    <label for="email">Email</label>
    <input id="email" name="email" type="email" required autocomplete="email" autofocus />
    <label for="password">Password</label>
    <input id="password" name="password" type="password" required minlength="8" autocomplete="current-password" />
    <button type="submit" id="submit">Sign in</button>
  </form>

  <p class="error" id="error"></p>
  <p class="toggle"><span id="toggle-text">Don't have an Amaze ID?</span> <a href="#" id="toggle">Create one</a></p>
  <p class="footer">AmazeContinuityProjects · auth.amazecc.com</p>
</main>
<script>
${signedQuerySnippet}
(function () {
  var search = window.location.search;
  var q = oauthQuery(search);
  var isOAuth = Boolean(q);
  var form = document.getElementById("form");
  var oauthInput = document.getElementById("oauth_query");
  var mode = "sign-in";
  var nameRow = document.getElementById("name-row");
  var submit = document.getElementById("submit");
  var toggle = document.getElementById("toggle");
  var toggleText = document.getElementById("toggle-text");
  var sub = document.getElementById("sub");
  var err = document.getElementById("error");

  function setMode(next) {
    mode = next;
    var isSignUp = mode === "sign-up";
    nameRow.style.display = isSignUp ? "block" : "none";
    submit.textContent = isSignUp ? "Create Amaze ID" : "Sign in";
    toggle.textContent = isSignUp ? "Sign in instead" : "Create one";
    toggleText.textContent = isSignUp ? "Already have an Amaze ID?" : "Don't have an Amaze ID?";
    sub.textContent = isSignUp
      ? "Your Amaze ID works everywhere AmazeContinuityProjects does."
      : "One account for all of AmazeContinuityProjects.";
    form.action = isSignUp ? "/api/auth/sign-up/email" : "/api/auth/sign-in/email";
    document.getElementById("password").autocomplete = isSignUp ? "new-password" : "current-password";
    err.style.display = "none";
  }

  toggle.addEventListener("click", function (e) {
    e.preventDefault();
    setMode(mode === "sign-in" ? "sign-up" : "sign-in");
  });

  if (isOAuth) {
    oauthInput.value = q;
    return; // full-page POST; the server resumes the OAuth flow on success
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    err.style.display = "none";
    submit.disabled = true;
    try {
      var payload = { email: document.getElementById("email").value, password: document.getElementById("password").value };
      if (mode === "sign-up") {
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
<main class="card">
  <div class="brand"><div class="logo">A</div><div><h1>Authorize application</h1></div></div>
  <p class="sub">An application is requesting access to your Amaze ID.</p>
  <p class="sub" style="margin-bottom:6px">Requested scopes:</p>
  <div id="scopes"></div>
  <form id="consent-form">
    <input type="hidden" id="scope" />
    <div class="row">
      <button type="submit" name="accept" value="false" class="secondary">Deny</button>
      <button type="submit" name="accept" value="true">Allow</button>
    </div>
  </form>
  <p class="error" id="error"></p>
  <p class="footer">You can revoke access later from each app. Amaze ID never shares your password.</p>
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
<main class="card">
  <div class="brand"><div class="logo">A</div><div><h1>Amaze ID</h1></div></div>
  <p class="sub">Your account across AmazeContinuityProjects.</p>
  <div class="kv"><span>Email</span><span id="email">…</span></div>
  <div class="kv"><span>Name</span><span id="name">…</span></div>
  <div class="kv"><span>VTOP linked</span><span id="vtop">…</span></div>

  <form id="vtop-form">
    <label for="vtop-user" style="margin-top:18px">Link VTOP <span style="color:#6f6f84">(optional)</span></label>
    <input id="vtop-user" type="text" placeholder="VTOP username" autocomplete="off" required />
    <label for="vtop-pass" style="margin-top:10px">VTOP password</label>
    <input id="vtop-pass" type="password" placeholder="VTOP password" autocomplete="off" required />
    <button type="submit" id="vtop-submit">Link VTOP account</button>
  </form>
  <button id="vtop-unlink" class="secondary" style="display:none;margin-top:10px">Unlink VTOP</button>
  <p class="error" id="error"></p>
  <p class="ok" id="ok"></p>

  <button id="signout" class="secondary">Sign out</button>
  <p class="footer">AmazeContinuityProjects · auth.amazecc.com</p>
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
