# Ecossistema Smart Kaits

Este diretório contém a infraestrutura e as aplicações do projeto **Smart Kaits**, organizadas de forma isolada e segura para não interferir em outros serviços do servidor (como o n8n).

## Estrutura do Projeto

- `docker-compose.yml`: Define todos os serviços, redes e volumes.
- `apps/`: Contém os repositórios clonados das aplicações.
  - `ai-agent-completo/`: Backend (FastAPI) e Frontend (Vue/Vite).
  - `mock-kaits-demonstracao/`: Mock estático da integração.

## Tecnologias e Infraestrutura

### Bancos de Dados
- **Postgres (16)**: Banco relacional principal.
- **Redis (7-alpine)**: Cache e filas.
- **Qdrant**: Banco de vetores para ferramentas de I.A. (RAG).

### Serviços Web
- **Traefik**: Utilizado como Reverse Proxy (integrado com a rede externa `n8n_edge`).
- **SSL**: Gerenciado automaticamente pelo Traefik via Let's Encrypt.

## Domínios e Roteamento

As aplicações estão configuradas nos seguintes domínios:

1. **aiagent.sanjaworks.com**
   - Frontend Vue: Rota raiz (`/`)
   - Backend FastAPI: Rota da API (`/api/`)
2. **smartkaits.techfala.com.br**
   - Mock Demonstrativo (HTML estático)

## Como Iniciar

Para subir todo o ecossistema:

```bash
cd /root/smart-kaits-ecosystem
docker compose up -d --build
```

### SSO do Chatwoot (widget)
A API gera o HMAC por escola em `GET /api/v1/chatwoot/sso-config` (com JWT). Configure `CHATWOOT_WEBSITE_TOKEN` e `CHATWOOT_IDENTITY_TOKEN` no `docker-compose` ou num arquivo `.env` na raiz (veja `apps/ai-agent-completo/backend/.env.example` e a chave `chatwoot` em `GET /health`).

## Notas para Agentes de I.A. Exploratórios

- Toda a persistência é feita através de volumes Docker nomeados: `postgres_data`, `redis_data`, `qdrant_data`.
- A rede interna `smart-network` isola os bancos de dados, expondo apenas o necessário via Traefik na rede `n8n_edge`.
- O diretório raiz `/root/smart-kaits-ecosystem` deve ser tratado como a unidade atômica deste projeto.
- **Segurança**: As credenciais padrão estão no `docker-compose.yml`. Em produção real, mova-as para um arquivo `.env` (ignore se já estiver feito).

---
*Configurado de forma segura e organizada, sem "gambiarras".*
