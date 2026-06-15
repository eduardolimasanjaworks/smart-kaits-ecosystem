// Tags comerciais (origem, campanha, etc.) — associação N:N via negociacao_tag.
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const tabelaTag = pgTable('tag', {
  id: uuid('id').defaultRandom().primaryKey(),
  nome: text('nome').notNull(),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
});
