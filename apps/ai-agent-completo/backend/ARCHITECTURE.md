# Decisões Arquiteturais (ADR — Architecture Decision Records)

Este documento registra **por quê** cada decisão foi tomada.
Uma I.A. lendo este arquivo deve entender o contexto para não propor mudanças conflitantes.

---

## ADR-001: FastAPI como Framework Web

**Decisão:** Usar FastAPI.

**Motivo:**
- Async nativo → ideal para I/O de banco + futuras chamadas de LLM
- Auto-geração de OpenAPI (Swagger) sem esforço adicional
- Pydantic integrado = validação + serialização em um só lugar
- Comunidade ativa e suporte a Python 3.11+

**Alternativas rejeitadas:** Django (pesado para API pura), Flask (sem async nativo).

---

## ADR-002: PostgreSQL como banco principal

**Decisão:** PostgreSQL com coluna JSONB para o `agent_config`.

**Motivo:**
- JSONB permite armazenar o config flexível da I.A. sem migrations toda vez que um campo novo for adicionado
- Quando o schema do config estabilizar, podemos normalizar (extrair tabelas)
- PostgreSQL tem Row Level Security (RLS) se migrarmos para Supabase futuramente

**Modelo de dados chave:**
```sql
agent_configs (
  id         UUID PRIMARY KEY,
  school_id  UUID REFERENCES schools(id),
  data       JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP
)
```

---

## ADR-003: Multi-Tenancy por School ID no JWT

**Decisão:** Cada JWT contém o `school_id`. Toda query filtra por ele.

**Motivo:**
- Simples de implementar e auditar
- O `school_id` nunca vem do body (evita privilege escalation)
- Toda camada de Repository recebe `school_id` explicitamente

**Regra de ouro:** Nenhum endpoint retorna dados sem filtrar por `school_id`.

---

## ADR-004: Arquitetura em Camadas por Domínio

**Decisão:** Organizar por domínio (`schools/`, `agent_config/`, `documents/`),
cada um com `models → schemas → repository → service → router`.

**Motivo:**
- Facilita navegação para I.A. e humanos
- `repository.py` = só queries de banco (zero lógica de negócio)
- `service.py` = só regras de negócio (zero SQL direto)
- `router.py` = só validação HTTP e orquestração

**Limite de linhas:** Máximo 300 linhas por arquivo. Se ultrapassar, refatorar em sub-módulos.

---

## ADR-005: Documentos tratados como metadados (Fase 1)

**Decisão:** Na Fase 1, salvar apenas metadados (nome, extensão, tamanho) do documento.
O conteúdo vetorizado (RAG) é Fase 2.

**Motivo:** Evitar complexidade prematura com vector stores.

**Plano para Fase 2:**
- Extrair texto com `pymupdf` / `python-docx`
- Vetorizar com `sentence-transformers`
- Armazenar em `pgvector` (extensão PostgreSQL)

---

## Convenções de Código

| Regra | Exemplo |
|---|---|
| Nomes de arquivos | `snake_case.py` |
| Funções públicas | `def get_school_by_slug(...)` |
| Funções privadas | `def _hash_token(...)` |
| Constantes | `MAX_DOCUMENTS_PER_SCHOOL = 50` |
| Comentário de seção | `# ── SEÇÃO ───────────────────────────────────` |
| Docstrings | Google style |

---

## Mapa de Dependências Entre Módulos

```
main.py
  └── core/ (sem deps internas)
  └── schools/ → core/
  └── agent_config/ → core/ + schools/
  └── documents/ → core/ + schools/
```

Regra: nenhum domain importa de outro domain (apenas de `core/`).
