// Junção negociação ↔ tag.
import { pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { tabelaNegociacao } from './tabelaNegociacao.js';
import { tabelaTag } from './tabelaTag.js';

export const tabelaNegociacaoTag = pgTable(
  'negociacao_tag',
  {
    negociacaoId: uuid('negociacao_id')
      .notNull()
      .references(() => tabelaNegociacao.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tabelaTag.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.negociacaoId, t.tagId] })],
);
