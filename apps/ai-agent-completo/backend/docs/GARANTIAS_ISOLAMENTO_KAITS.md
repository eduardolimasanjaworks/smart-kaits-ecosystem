# Garantias de isolamento por escola (Smart Kaits)

Este documento resume o que o código **já garante** quando o utilizador entra com um **perfil de escola** (JWT com `school_id`), incluindo utilizadores múltiplos do Kaits que partilham a mesma escola.

## 1. Autenticação e “perfil de escola”

- O JWT emitido pelo Smart Kaits contém **`school_id`** (UUID da escola). Todos os endpoints protegidos usam `get_current_school_id` — não há acesso cruzado por troca de URL sozinha.
- **Membros da equipe** (`member_id` no JWT) partilham o **mesmo** `school_id` — mesmo RAG, mesma instância Evolution, mesmos documentos. A diferença é só permissão de gestão (ex.: convidar membros só com token “principal”, sem `member_id`).

## 2. RAG / Qdrant

- Cada chunk indexado inclui **`school_id`** no payload.
- `search_knowledge` aplica **filtro obrigatório** por `school_id` — uma escola **não** lê vetores de outra.

## 3. PostgreSQL / configuração

- `agent_config`, `documents`, etc. têm FK **`school_id`**. Queries usam sempre o UUID do token.

## 4. WhatsApp (Evolution API)

- Nome de instância **determinístico**: `sk_<uuid_da_escola_sem_hífen>`.
- Uma instância Evolution por escola; webhook resolve a escola pelo nome da instância e chama a I.A. com o **mesmo** `school_id`.
- Estado da ligação: `GET /api/v1/whatsapp/status` (polling no front, ex. a cada 30 s).

## 5. Embed pelo Kaits (sem segundo login)

- O browser **não** deve conhecer a senha da escola no Smart Kaits.
- O **servidor Kaits** chama `POST /api/v1/auth/embed-handshake` com HMAC (`EMBED_TRUST_SECRET` alinhado com o backend Smart Kaits) e obtém o JWT.
- O portal entrega o token ao iframe com **`#access_token=<jwt>`** ou **`postMessage`** (origens em `VITE_EMBED_ALLOWED_ORIGINS`).

## 6. URL direta (ex. aiagent.sanjaworks.com)

- **Sem token** e **fora do iframe**: o utilizador vê a tela de **slug + senha da escola** — não existe login “demo” partilhado nem bypass.
- **Sem token** e **dentro do iframe**: mensagem de suporte / aguardar sessão do portal — não entra em modo demo.
