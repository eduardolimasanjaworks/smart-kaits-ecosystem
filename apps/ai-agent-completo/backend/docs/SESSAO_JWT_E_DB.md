# Sessão: JWT, duração e tabela `login_sessions`

## JWT

O backend emite um **JWT** após `POST /api/v1/auth/login` com `{ slug, password }`. O token inclui `school_id`, `slug`, `jti` (identificador único da emissão), `exp` (expiração) e é assinado com `SECRET_KEY`.

O front continua armazenando o token (hoje `localStorage['kaits_token']`) e enviando `Authorization: Bearer …`.

## Quem define o “TTL”

O tempo de vida efetivo do token é **`JWT_EXPIRE_MINUTES`** no ambiente do **Smart Kaits** (variável de ambiente do deploy). Não é o KAITS que altera isso, salvo se no futuro existir um **BFF** do KAITS que chame o login e vocês **configurarem o deploy** com o valor desejado.

Exemplos já documentados no `.env.example`: 300 (5 h), 1440 (24 h), 10080 (7 d), 43200 (~30 d para demo).

## Tabela `login_sessions` (opcional)

Com `AUTH_STORE_SESSIONS_IN_DB=true`:

1. Rode `backend/sql/001_login_sessions.sql` no PostgreSQL.
2. Cada login insere uma linha com o mesmo `jti` do JWT.
3. Cada request autenticada exige que essa linha ainda exista e não esteja expirada.
4. `POST /api/v1/auth/logout` remove a linha (o cliente deve apagar o JWT localmente).

Isso **não substitui** o armazenamento do token no browser para o SPA atual; oferece **revogação** e rastreabilidade no servidor. Para “só cookie HttpOnly”, seria outro desenho (CORS + `withCredentials`).

## Apresentação

Para reduzir relogin: aumente `JWT_EXPIRE_MINUTES` no `.env` do deploy (ex.: 43200). Mantenha valores curtos em produção multi-cliente quando o risco de token vazado for relevante.
