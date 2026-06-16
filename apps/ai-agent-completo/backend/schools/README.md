# schools/ — Domínio: Escolas (Tenants)

Gerencia o cadastro e autenticação de escolas no sistema.
Cada escola é um tenant isolado — seus dados nunca se misturam.

## Responsabilidades

- Criar escolas (somente via admin interno ou CLI)
- Autenticar escolas via slug + senha → retornar JWT
- Expor dados básicos da escola autenticada

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `models.py` | Tabela `schools` no banco (SQLAlchemy) |
| `schemas.py` | Validação de entrada/saída (Pydantic) |
| `repository.py` | Queries SQL para School |
| `service.py` | Regras de negócio: criar escola, autenticar |
| `router.py` | Endpoints HTTP: `/auth/login`, `/schools` |

## Endpoints Expostos

```
POST /api/v1/auth/login     → Login com slug + senha → JWT
POST /api/v1/schools        → Criar escola (admin only — proteger em prod)
GET  /api/v1/schools/me     → Dados da escola autenticada
```

## Modelo de Dados

```sql
CREATE TABLE schools (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(120) NOT NULL,
  slug         VARCHAR(60) UNIQUE NOT NULL,  -- ex: "colegio-alfa"
  password_hash VARCHAR(255) NOT NULL,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMP DEFAULT now()
);
```
