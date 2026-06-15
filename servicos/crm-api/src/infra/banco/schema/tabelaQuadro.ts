// Quadro de funil (instância multi-quadro do CRM).
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const tabelaQuadro = pgTable('quadro', {
  id: uuid('id').defaultRandom().primaryKey(),
  titulo: text('titulo').notNull(),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow()
});
