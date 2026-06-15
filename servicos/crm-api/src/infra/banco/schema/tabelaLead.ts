// Lead comercial (contato/mailing; não confundir com login de usuário).
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const tabelaLead = pgTable('lead', {
  id: uuid('id').defaultRandom().primaryKey(),
  nomeContato: text('nome_contato').notNull(),
  emailContato: text('email_contato'),
  telefoneContato: text('telefone_contato'),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow()
});
