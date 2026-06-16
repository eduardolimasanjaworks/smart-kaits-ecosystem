"""
Portal de demonstração (“mock Kaits”): dois caminhos que simulam dois clientes distintos.

Cada rota obtém JWT via POST /api/v1/auth/embed-handshake (HMAC no servidor)
e embute o Smart Kaits com #access_token=... — escolas diferentes → JWT com
school_id diferente → na app real, GET /whatsapp/connect usa instâncias Evolution
separadas (sk_<uuid>) e QRs distintos.

O mock envia postMessage com Bearer de exemplo para a API do Kaits (SMART_KAITS_KAITS_HOST_BEARER)
e define iframe com allow fullscreen/microphone + cabeçalho Permissions-Policy no documento
pai, para testar tela cheia e ditado no embed.

Requisitos: backend com EMBED_TRUST_SECRET; duas escolas com os slugs do .env;
front com VITE_EMBED_ALLOWED_ORIGINS incluindo http://127.0.0.1:5055 (ou a origem que usar).
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from typing import Any
from urllib.parse import urlparse

import httpx
from flask import Flask, abort, make_response, render_template_string

app = Flask(__name__)

API = os.environ.get("KAITS_API_URL", "http://127.0.0.1:8000").rstrip("/")
SECRET = (os.environ.get("EMBED_TRUST_SECRET") or "").strip()
FRONT = os.environ.get("KAITS_FRONTEND_URL", "http://127.0.0.1:5173").rstrip("/")
SLUG_A = os.environ.get("SCHOOL_A_SLUG", "escola-demo-a")
SLUG_B = os.environ.get("SCHOOL_B_SLUG", "escola-demo-b")
# Bearer fictício que o mock “repassa” ao iframe (API REST do Kaits, além do JWT Smart Kaits).
MOCK_KAITS_HOST_BEARER = (os.environ.get("MOCK_KAITS_HOST_BEARER") or "mock-kaits-host-bearer-token").strip()


def _front_target_origin(front: str) -> str:
    p = urlparse(front)
    if p.scheme and p.netloc:
        return f"{p.scheme}://{p.netloc}"
    return ""


def _embed_token(school_slug: str) -> str:
    if not SECRET:
        abort(503, "Defina EMBED_TRUST_SECRET (igual ao backend Smart Kaits).")
    ts = int(time.time())
    msg = f"{school_slug}.{ts}".encode("utf-8")
    sig = hmac.new(SECRET.encode("utf-8"), msg, hashlib.sha256).hexdigest()
    url = f"{API}/api/v1/auth/embed-handshake"
    try:
        r = httpx.post(
            url,
            json={"school_slug": school_slug, "ts": ts, "sig": sig},
            timeout=20.0,
        )
    except httpx.RequestError as e:
        abort(502, f"API inacessível: {e}")
    if r.status_code != 200:
        abort(
            r.status_code,
            f"Handshake falhou ({r.status_code}): {r.text[:500]}",
        )
    data: dict[str, Any] = r.json()
    token = data.get("access_token")
    if not isinstance(token, str) or not token:
        abort(502, "Resposta sem access_token.")
    return token


def _with_embed_parent_headers(response, _front: str) -> Any:
    """Mock portal: política permissiva para o iframe poder usar fullscreen/microfone no embed."""
    response.headers["Permissions-Policy"] = (
        "fullscreen=*, microphone=*, display-capture=*, clipboard-read=*, clipboard-write=*"
    )
    return response


INDEX_HTML = """
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <title>Mock Kaits — duas escolas (embed SSO)</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; }
    a { display: inline-block; margin: 0.5rem 1rem 0.5rem 0; padding: 0.6rem 1rem;
       background: #1a5f7a; color: #fff; text-decoration: none; border-radius: 8px; }
    a.secondary { background: #444; }
    code { background: #eee; padding: 0.1rem 0.35rem; border-radius: 4px; }
    p { line-height: 1.5; }
  </style>
</head>
<body>
  <h1>Mock Kaits (demo embed)</h1>
  <p>Cada botão representa um <strong>utilizador/sessão</strong> no portal mãe (host page).
     O servidor assina o handshake e abre o Smart Kaits já autenticado na escola certa.</p>
  <p>O iframe usa <code>allowfullscreen</code> + <code>Permissions-Policy</code> no pai para
     testar <strong>tela cheia</strong> e <strong>microfone</strong> no Smart Kaits embarcado.
     Também é enviado <code>postMessage</code> com Bearer de demo para a API do Kaits
     (<code>SMART_KAITS_KAITS_HOST_BEARER</code>).</p>
  <p><a href="/portal/escola-a">Portal — Escola A</a>
     <a class="secondary" href="/portal/escola-b">Portal — Escola B</a></p>
  <p>Slugs esperados: <code>{{ slug_a }}</code> e <code>{{ slug_b }}</code>.
     API: <code>{{ api }}</code> · Front iframe: <code>{{ front }}</code></p>
  <p>Bearer mock (env <code>MOCK_KAITS_HOST_BEARER</code>): <code>{{ host_bearer_hint }}</code></p>
</body>
</html>
"""

IFRAME_HTML = """
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <title>{{ title }}</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; }
    .mock-bar {
      padding: 0.45rem 0.75rem; background: #222; color: #fff; font-size: 0.8rem; line-height: 1.35;
      display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; justify-content: space-between;
    }
    .mock-bar__text { flex: 1; min-width: 200px; }
    iframe { width: 100%; height: calc(100vh - 36px); border: 0; display: block; }
  </style>
</head>
<body>
  <div class="mock-bar">
    <div class="mock-bar__text">
      <strong>{{ title }}</strong> — JWT no hash; postMessage Bearer.
      Tela cheia: use o botão <strong>⛶ Tela cheia</strong> dentro do Smart Kaits (este mock só responde ao postMessage).
    </div>
  </div>
  <iframe
    id="smart-kaits-iframe"
    title="Smart Kaits"
    src="{{ iframe_src }}"
    allowfullscreen
    allow="fullscreen; microphone; clipboard-read; clipboard-write; display-capture"
  ></iframe>
  <script>
  (function () {
    var iframe = document.getElementById('smart-kaits-iframe');
    var targetOrigin = {{ front_origin_json }};
    var hostToken = {{ host_bearer_json }};
    function sendHostBearer() {
      if (!hostToken) return;
      try {
        iframe.contentWindow.postMessage(
          { type: 'SMART_KAITS_KAITS_HOST_BEARER', token: hostToken },
          targetOrigin
        );
      } catch (e) {}
    }
    iframe.addEventListener('load', function () {
      sendHostBearer();
      setTimeout(sendHostBearer, 400);
    });
    function iframeFullscreen() {
      var el = iframe;
      var fn = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
      if (fn) {
        fn.call(el).catch(function () {});
      }
    }
    window.addEventListener('message', function (ev) {
      var d = ev.data;
      if (!d || typeof d !== 'object' || d.type !== 'SMART_KAITS_REQUEST_FULLSCREEN') return;
      if (ev.origin !== targetOrigin) return;
      iframeFullscreen();
    });
  })();
  </script>
</body>
</html>
"""


@app.get("/")
def index():
    hint = MOCK_KAITS_HOST_BEARER if len(MOCK_KAITS_HOST_BEARER) <= 48 else MOCK_KAITS_HOST_BEARER[:45] + "…"
    return render_template_string(
        INDEX_HTML,
        slug_a=SLUG_A,
        slug_b=SLUG_B,
        api=API,
        front=FRONT,
        host_bearer_hint=hint,
    )


@app.get("/portal/escola-a")
def portal_a():
    token = _embed_token(SLUG_A)
    iframe_src = f"{FRONT}/#access_token={token}"
    html = render_template_string(
        IFRAME_HTML,
        title=f"Escola A ({SLUG_A})",
        iframe_src=iframe_src,
        front_origin_json=json.dumps(_front_target_origin(FRONT) or FRONT),
        host_bearer_json=json.dumps(MOCK_KAITS_HOST_BEARER),
    )
    return _with_embed_parent_headers(make_response(html), FRONT)


@app.get("/portal/escola-b")
def portal_b():
    token = _embed_token(SLUG_B)
    iframe_src = f"{FRONT}/#access_token={token}"
    html = render_template_string(
        IFRAME_HTML,
        title=f"Escola B ({SLUG_B})",
        iframe_src=iframe_src,
        front_origin_json=json.dumps(_front_target_origin(FRONT) or FRONT),
        host_bearer_json=json.dumps(MOCK_KAITS_HOST_BEARER),
    )
    return _with_embed_parent_headers(make_response(html), FRONT)


if __name__ == "__main__":
    port = int(os.environ.get("MOCK_KAITS_PORT", "5055"))
    app.run(host="127.0.0.1", port=port, debug=True)
