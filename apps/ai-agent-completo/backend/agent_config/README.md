# agent_config/ — Domínio: Configuração do Agente por Escola

Armazena e recupera o JSON de configuração do agente de I.A. de cada escola.
É o coração do produto — tudo que o usuário configura no frontend vai aqui.

## Modelo de Dados

```sql
CREATE TABLE agent_configs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID UNIQUE REFERENCES schools(id) ON DELETE CASCADE,
  data        JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMP DEFAULT now()
);
```

O campo `data` (JSONB) armazena o config completo:
```json
{
  "assistantName": "Joana",
  "personality": "...",
  "greeting": "Olá!",
  "scriptRules": [...],
  "teamMembers": [...],
  "fallbackContact": "Maria",
  "fallbackMessage": "Cliente aguardando!",
  "fallbackUserMessage": "Vou te transferir agora...",
  "pauseAiOnHandover": true,
  "faqItems": [...],
  "docs": [...],
  "tools": {...},
  "apiToken": "..."
}
```

## Endpoints

```
GET  /api/v1/me/config    → Retorna config da escola autenticada
PUT  /api/v1/me/config    → Salva/substitui o config completo
```
