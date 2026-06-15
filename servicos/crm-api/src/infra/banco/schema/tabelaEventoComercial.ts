// Eventos comerciais vinculados à negociação (KPIs e conversões).
import { jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { enumTipoEventoComercial } from './enumTipoEventoComercial.js';
import { tabelaNegociacao } from './tabelaNegociacao.js';

export const tabelaEventoComercial = pgTable('evento_comercial', {
  id: uuid('id').defaultRandom().primaryKey(),
  negociacaoId: uuid('negociacao_id')
    .notNull()
    .references(() => tabelaNegociacao.id, { onDelete: 'cascade' }),
  tipo: enumTipoEventoComercial('tipo').notNull(),
  metadados: jsonb('metadados'),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow()
});
