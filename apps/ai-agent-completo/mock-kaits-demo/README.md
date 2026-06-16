# Mock Kaits — demo de embed (SSO por HMAC)

Simula **dois portais** (duas “contas” ou escolas no mundo Kaits). Cada um chama o **mesmo** backend Smart Kaits com `POST /api/v1/auth/embed-handshake` assinado no **servidor** desta app e abre o iframe com `#access_token=<JWT>`.

## O que isto prova

- **Escola A** e **Escola B** com slugs diferentes recebem **JWTs com `school_id` diferentes**.
- No Smart Kaits real, o painel WhatsApp chama `GET /api/v1/whatsapp/connect` com esse JWT → instância Evolution `sk_<uuid_da_escola>` por tenant → **dois QR codes** (um por escola), desde que a Evolution esteja configurada na API.

Para **Login1 / senha123** e **Login2 / senha123** como no domínio `smartkaits.techfala.com.br`, use o projeto **`apps/mock-kaits-demonstracao`** (`/portal/`). Esta pasta `mock-kaits-demo` continua útil para **embed HMAC** local (Flask).

## Passos rápidos

1. No backend Smart Kaits: define `EMBED_TRUST_SECRET` (mesmo valor em todo o lado).
2. Cria **duas escolas** (ex.: `POST /api/v1/schools` duas vezes) e anota os **slugs**.
3. Copia `.env.example` para `.env` e preenche `KAITS_API_URL`, `EMBED_TRUST_SECRET`, `KAITS_FRONTEND_URL`, `SCHOOL_A_SLUG`, `SCHOOL_B_SLUG`.
4. No **front** Smart Kaits, em `.env`, inclui a origem desta app em `VITE_EMBED_ALLOWED_ORIGINS`, por exemplo:  
   `http://127.0.0.1:5055`
5. Instala e corre:

```bash
cd mock-kaits-demo
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
set -a && source .env && set +a   # ou export manual no Windows
.venv/bin/python app.py
```

6. Abre `http://127.0.0.1:5055/` e clica em **Escola A** ou **Escola B**.

Documentação do iframe: `../backend/docs/EMBED_IFRAME_SIMPLES.md` e `../backend/docs/INTEGRACAO_EMBED_PORTAL.md`.
