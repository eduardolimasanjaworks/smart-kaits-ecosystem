# O que o Kaits (aplicação mãe) envia para o Smart Kaits

Objetivo: cada **escola** no Kaits vira um **tenant** no Smart Kaits (JWT com `school_id`), com **RAG no Qdrant só daquela escola**, **instância Evolution `sk_<uuid>` só daquela escola**, e vários utilizadores humanos do Kaits a acederem ao **mesmo perfil de escola** (mesmo slug/senha ou embed para essa escola).

---

## Opção A — Embed (recomendado no iframe)

O **servidor do Kaits** (nunca o JavaScript público com segredo):

1. Resolve **qual escola** é (`school_slug` registado no Smart Kaits).
2. Calcula `ts` (Unix segundos UTC) e `sig = HMAC-SHA256(EMBED_TRUST_SECRET, f"{slug}.{ts}")` em hex.
3. Chama `POST https://<API-SMART-KAITS>/api/v1/auth/embed-handshake` com JSON `{ "school_slug", "ts", "sig" }`.
4. Recebe `access_token` (JWT).
5. Entrega ao browser: URL do iframe com `#access_token=<JWT>` **ou** `postMessage` para a origem do Smart Kaits (configurada em `VITE_EMBED_ALLOWED_ORIGINS`).

O Smart Kaits **não** precisa de “tag extra” no Qdrant vinda do Kaits: o JWT já traz `school_id`; toda a busca RAG filtra `school_id` no payload.

---

## Opção B — Login escola (slug + senha)

Se o fluxo for manual ou B2B:

1. O Kaits guarda **slug** e **senha da escola** (fornecidos quando a escola foi criada no Smart Kaits) **só no servidor**.
2. O browser pode chamar `POST …/auth/login` com `{ "slug", "password" }` **se** o CORS da API incluir a origem do portal.

---

## O que o Smart Kaits garante por desenho

| Peça | Isolamento |
|------|------------|
| **JWT** | `school_id` em todo o tráfego autenticado. |
| **Qdrant / RAG** | Filtro obrigatório `school_id` em `search_knowledge` (ver `ai/retriever.py`). |
| **Postgres** | Documentos, `agent_config`, histórico WA por `school_id` + contacto. |
| **Evolution** | Nome fixo `sk_<uuid_da_escola>` por escola; webhook resolve a escola e chama a I.A. com o mesmo `school_id`. |

**Vários utilizadores Kaits na mesma escola:** todos recebem embed ou credenciais da **mesma** escola → mesmo tenant (comportamento esperado). Equipa interna com logins distintos por pessoa: usar `school_members` + `POST /auth/member-login` (mesmo `school_id` no JWT).

---

## Leitura de QR e “online”

- O painel chama `GET /api/v1/whatsapp/connect` (JWT) para QR.
- Polling `GET /api/v1/whatsapp/status` (ex.: 30 s no front) para estado Evolution `open` = ligado.

---

## URL pública sem autenticação

Podes ativar `VITE_REQUIRE_EMBED=true` no build do front: **fora do iframe**, sem token, o utilizador **não** vê formulário de slug/senha — só mensagem para aceder pelo portal Kaits (evita “link direto” aberto ao público).

Documentação do iframe (curta): `EMBED_IFRAME_SIMPLES.md`. Fluxo completo: `INTEGRACAO_EMBED_PORTAL.md`.
