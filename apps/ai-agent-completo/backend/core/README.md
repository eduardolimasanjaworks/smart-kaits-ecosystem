# core/ — Módulo de Infraestrutura Central

Este módulo fornece os blocos de construção compartilhados por todos os domínios.

## Regras

- **Sem lógica de negócio aqui.** Apenas configuração, conexão e utilitários.
- Nenhum domain (`schools/`, `agent_config/`, etc.) deve ser importado aqui.
- Este módulo pode ser importado por qualquer domínio sem criar ciclo.

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `config.py` | Lê variáveis de ambiente, expõe objeto `settings` global |
| `database.py` | Engine SQLAlchemy async, `AsyncSession`, `Base` declarativa |
| `security.py` | Hash de senha (bcrypt), criação/decodificação de JWT |
| `dependencies.py` | FastAPI `Depends` reutilizáveis: `get_db`, `get_current_school` |
