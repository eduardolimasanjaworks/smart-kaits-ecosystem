// Coluna pertencente a um quadro (etapa do funil).
import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tabelaQuadro } from './tabelaQuadro.js';

export const tabelaColuna = pgTable('coluna', {
  id: uuid('id').defaultRandom().primaryKey(),
  quadroId: uuid('quadro_id')
    .notNull()
    .references(() => tabelaQuadro.id, { onDelete: 'cascade' }),
  titulo: text('titulo').notNull(),
  ordemPosicao: integer('ordem_posicao').notNull().default(0),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow()
});
