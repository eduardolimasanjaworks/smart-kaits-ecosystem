# Evolution API + WhatsApp (por escola)

## Visão geral

- Cada escola tem uma instância Evolution com nome fixo **`sk_<UUID_SEM_HIFEN>`** (ex.: `sk_a1b2c3d4...`).
- O painel chama `GET /api/v1/whatsapp/connect` (autenticado) → cria/reutiliza instância, **regista webhook** e devolve **QR em Base64**.
- A Evolution envia `MESSAGES_UPSERT` para **`POST /api/v1/webhooks/evolution`** → o backend responde com **`process_chat_message`** (RAG + config da mesma `school_id`).

## Docker (neste repositório)

```bash
cd apps/ai-agent-completo
# Defina no ambiente ou num .env ao lado do compose:
export EVOLUTION_AUTH_KEY="$(python3 -c 'import secrets; print(secrets.token_hex(24))')"
export EVOLUTION_SERVER_URL="http://localhost:8080"   # ou URL pública HTTPS da Evolution

docker compose -f docker-compose.infra.yml up -d
```

- **Postgres**: o script `docker/postgres-init/99-evolution-database.sql` cria a base `evolution` **apenas no primeiro volume vazio**. Se o volume já existia, crie manualmente:  
  `docker exec -it kaits_postgres psql -U postgres -c "CREATE DATABASE evolution;"`

- **Imagem**: `atendai/evolution-api:v2.2.2` (ajuste a tag se necessário).

- **SERVER_URL** (`EVOLUTION_SERVER_URL`): URL em que o telefone / WhatsApp alcança a Evolution (em produção costuma ser HTTPS atrás de reverse proxy).

## Variáveis do backend Smart Kaits (`.env` em `backend/`)

| Variável | Descrição |
|----------|-----------|
| `EVOLUTION_API_URL` | Base da Evolution, ex. `http://127.0.0.1:8080` (sem barra final). |
| `EVOLUTION_API_KEY` | Mesmo valor que `AUTHENTICATION_API_KEY` / `EVOLUTION_AUTH_KEY` da Evolution. |
| `EVOLUTION_WEBHOOK_PUBLIC_BASE` | URL **pública** do Smart Kaits (sem `/api/v1`), ex. `https://aiagent.sanjaworks.com` — a Evolution precisa conseguir fazer POST até aí. |
| `EVOLUTION_WEBHOOK_SECRET` | (Opcional) Se definido, a Evolution deve enviar o header `X-Smart-Kaits-Webhook-Secret` com o mesmo valor (configurado no `webhook/set` e no create). |
| `EVOLUTION_CONNECT_NUMBER` | (Opcional) DDI+número (só dígitos) para query `?number=` em `GET /instance/connect` (doc Evolution). |

### Mapeamento Evolution ↔ Smart Kaits (`/api/v1/whatsapp`)

| Evolution (OpenAPI v2) | Smart Kaits |
|--------------------------|-------------|
| `POST /instance/create` | Interno: `evolution_service._ensure_instance_exists` |
| `GET /instance/fetchInstances` | `GET /api/v1/whatsapp/instance` |
| `GET /instance/connect/{instance}` | Interno: `_poll_connect_qr_linear` |
| `GET /instance/connectionState/{instance}` | `GET /api/v1/whatsapp/status` |
| `POST /instance/restart/{instance}` | `POST /api/v1/whatsapp/restart` |
| `DELETE /instance/logout/{instance}` | `POST /api/v1/whatsapp/logout` |
| `DELETE /instance/delete/{instance}` | `DELETE /api/v1/whatsapp/instance` (JWT **acesso principal**) |
| `POST /message/sendText/{instance}` | `POST /api/v1/whatsapp/send-text` + `send_text` interno |
| `POST /chat/markMessageAsRead/{instance}` | `POST /api/v1/whatsapp/chat/mark-read` |

Código: `evolution_service.py` (HTTP) e `whatsapp_api.py` (rotas FastAPI).

## SQL no Postgres da aplicação

```bash
psql ... -f backend/sql/003_school_evolution_instance.sql
```

Campos opcionais em `schools`: `evolution_instance_name`, `evolution_instance_token`.

## Fluxo “novo token JWT da escola”

O JWT **sempre** carrega um `school_id` que já existe no Postgres do Smart Kaits (login slug/senha ou embed-handshake). **Não** se “varre” a Evolution à procura de instâncias: o nome é **determinístico** — uma escola ↔ **`sk_<uuid_hex_sem_hífen>`**.

- **Escola nova no Smart Kaits** (primeiro acesso WhatsApp): `POST /instance/create` com esse nome; se a Evolution devolver **409/403 nome em uso**, trata-se como **reutilização** da mesma instância.
- **Escola que já tinha instância**: mesmo nome → **reutiliza**; o backend regista/atualiza webhook e pede QR ou confirma estado.

Antes de pedir QR, o backend consulta `GET /instance/connectionState/{instance}`: se **`state == open`**, responde com **`already_connected: true`** (sem forçar `/instance/connect`).

O front chama `/whatsapp/connect` ao abrir o modal do QR (e **aguarda** `/whatsapp/status` antes, para mostrar “já conectado” sem pedir QR à toa). Cada chamada a `/whatsapp/connect` quando **não** está `open`:

1. Garante nome `sk_<school_id.hex>` na linha `schools`.
2. Cria instância se não existir (409/403 “nome em uso” = reutiliza).
3. Chama `POST /webhook/set/{instance}` com JSON `{ "webhook": { "enabled", "url", "byEvents", "base64", "events" } }` (schema Evolution v2.2).
4. Chama `GET /instance/connect/{instance}` (com retentativas) e devolve QR / pairing code.

## Segurança

- Não commite `EVOLUTION_API_KEY` em repositório público.
- Em produção, use `EVOLUTION_WEBHOOK_SECRET` e HTTPS.
