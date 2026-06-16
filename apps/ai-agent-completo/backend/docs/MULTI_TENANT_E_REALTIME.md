# Multi-tenant (escolas), Qdrant e tempo real

## Isolamento por escola

- **PostgreSQL:** documentos, configuração do agente e demais tabelas usam `school_id` (FK).
- **Qdrant:** cada ponto vetorial carrega `school_id` no payload; buscas usam filtro obrigatório por escola (`ai/retriever.py`). Não é necessário criar uma coleção por escola para isolamento lógico — o filtro garante que uma escola não lê vetores de outra.

## Vários utilizadores humanos por escola

- Tabela `school_members` (ver `sql/002_school_members.sql`): e-mail único **por escola**, senha própria.
- **Login principal:** continua `POST /auth/login` (slug + senha da escola) — ideal para administrador.
- **Login equipe:** `POST /auth/member-login` com `school_slug`, `email`, `password`.
- JWT inclui sempre `school_id`; sessões de membro também incluem `member_id`.
- **Gestão de membros** (criar/remover): apenas token **sem** `member_id` (`GET`/`POST`/`DELETE /schools/members` com dependência `get_current_principal_school_id`).

## Sincronização entre browsers

- WebSocket: `GET ws(s)://.../api/v1/ws?token=<JWT>` (mesmo token do `Authorization`).
- Eventos emitidos pelo servidor ao gravar config, documentos ou equipe: `config_updated`, `documents_updated`, `team_updated`.
- O front reconcilia com `GET /me/config` de forma debounced (~380 ms).

## CORS

- Configure `ALLOWED_ORIGINS` com as URLs **exatas** do front (e do portal, se a API for chamada direto do browser do portal).
- Evite `*` com credenciais.
