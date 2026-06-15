// Cupons promocionais com token de resgate e código legível.
import { date, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const tabelaCupom = pgTable('cupom', {
  id: uuid('id').defaultRandom().primaryKey(),
  token: text('token').notNull().unique(),
  codigo: text('codigo').notNull(),
  nome: text('nome').notNull(),
  motivo: text('motivo').notNull(),
  descontoPercentual: integer('desconto_percentual').notNull(),
  validade: date('validade').notNull(),
  queimadoEm: timestamp('queimado_em', { withTimezone: true }),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
});
