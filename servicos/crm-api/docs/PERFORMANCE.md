# Performance — relatórios CRM (F1-21)

## Meta p95

Os endpoints `GET /relatorios/resumo` e `GET /relatorios/funil` devem responder com **p95 &lt; 300 ms** em ambiente de produção típico (Postgres local ou RDS na mesma região, até ~50k negociações).

## Como validar

1. Subir a API com seed aplicado (`npm run dev` ou container).
2. Medir com ferramenta de carga (ex.: `hey`, k6) ou logs de `X-Response-Time` se instrumentado.
3. Se p95 &gt; 300 ms, aplicar índices sugeridos no comentário da migration `drizzle/0001_mes_previsto_evento.sql`.

## Índices recomendados (opcional)

- `negociacao (mes_previsto_evento)` parcial `WHERE mes_previsto_evento IS NOT NULL`
- `negociacao (lead_id, criado_em)` para filtros por cliente no resumo
