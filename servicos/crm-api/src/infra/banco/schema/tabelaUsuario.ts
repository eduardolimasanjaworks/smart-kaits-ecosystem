// Usuários internos do CRM (autenticação detalhada fica fora desta fatia).
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const tabelaUsuario = pgTable('usuario', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  nomeExibicao: text('nome_exibicao').notNull(),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow()
});
