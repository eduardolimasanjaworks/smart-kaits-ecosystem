# Smart Kaits — Backend Python (FastAPI)

## Visão Geral

Backend multi-tenant para o Smart Kaits, o configurador de I.A. para escolas.
Cada escola possui seu próprio perfil de agente isolado.

## Stack

- **Framework:** FastAPI (alta performance, async nativo, auto-docs)
- **Banco de dados:** PostgreSQL (via SQLAlchemy async + Alembic para migrations)
- **Autenticação:** JWT (python-jose) — token por escola
- **Validação:** Pydantic v2
- **Servidor:** Uvicorn

## Estrutura de Pastas

```
backend/
├── README.md                  # Este arquivo
├── ARCHITECTURE.md            # Decisões arquiteturais e ADRs
├── requirements.txt           # Dependências Python
├── .env.example               # Variáveis de ambiente necessárias
├── main.py                    # Entry point — monta o app FastAPI
│
├── core/                      # Configurações globais e utilitários base
│   ├── README.md
│   ├── config.py              # Settings via pydantic-settings
│   ├── database.py            # Engine, sessão async, Base do SQLAlchemy
│   ├── security.py            # JWT: create_token, decode_token, hash_password
│   └── dependencies.py       # FastAPI Depends reutilizáveis (get_db, get_current_school)
│
├── schools/                   # Domínio: Escolas (tenants)
│   ├── README.md
│   ├── models.py              # SQLAlchemy: School, ApiKey
│   ├── schemas.py             # Pydantic: SchoolCreate, SchoolOut, LoginRequest
│   ├── repository.py          # Queries de banco para School
│   ├── service.py             # Regras de negócio (criar escola, gerar token)
│   └── router.py              # Endpoints: POST /schools, POST /auth/login
│
├── agent_config/              # Domínio: Configuração do Agente por Escola
│   ├── README.md
│   ├── models.py              # SQLAlchemy: AgentConfig (JSON blob por school_id)
│   ├── schemas.py             # Pydantic: AgentConfigIn, AgentConfigOut
│   ├── repository.py          # Queries de banco para AgentConfig
│   ├── service.py             # Regras: salvar, carregar, validar config
│   └── router.py              # Endpoints: GET/PUT /me/config
│
├── documents/                 # Domínio: Upload de documentos (RAG futuro)
│   ├── README.md
│   ├── models.py              # SQLAlchemy: Document (nome, extension, school_id)
│   ├── schemas.py             # Pydantic: DocumentOut, DocumentCreate
│   ├── repository.py          # Queries de banco para Document
│   ├── service.py             # Upload, remoção, listagem
│   └── router.py              # Endpoints: POST/GET/DELETE /me/documents
│
└── migrations/                # Alembic — controle de versão do banco
    ├── README.md
    ├── env.py
    └── versions/              # Scripts gerados pelo alembic
```

## Como Rodar

```bash
# 1. Criar ambiente virtual
python -m venv .venv
.venv\Scripts\activate        # Windows
source .venv/bin/activate     # Linux/Mac

# 2. Instalar dependências
pip install -r requirements.txt

# 3. Configurar variáveis de ambiente
cp .env.example .env
# Edite o .env com suas credenciais do banco

# 4. Rodar migrations
alembic upgrade head

# 5. Iniciar servidor de desenvolvimento
uvicorn main:app --reload --port 8000
```

## Documentação Automática

Com o servidor rodando, acesse:
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

## Variáveis de Ambiente Necessárias

Veja `.env.example` para a lista completa. As principais:
- `DATABASE_URL` — string de conexão PostgreSQL
- `SECRET_KEY` — chave secreta para assinar JWTs
- `ENVIRONMENT` — `development` | `production`
