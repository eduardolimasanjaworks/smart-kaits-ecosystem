// Tabela de papéis RBAC (nomes semânticos em pt-BR).
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const tabelaPapel = pgTable('papel', {
  id: uuid('id').defaultRandom().primaryKey(),
  nome: text('nome').notNull().unique(),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow()
});
