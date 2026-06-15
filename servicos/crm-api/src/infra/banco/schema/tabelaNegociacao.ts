// Negociação (cartão principal) com valores em centavos BRL e ponte Planka opcional.
import { bigint, date, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { enumResultadoNegociacao } from './enumResultadoNegociacao.js';
import { tabelaColuna } from './tabelaColuna.js';
import { tabelaLead } from './tabelaLead.js';
import { tabelaQuadro } from './tabelaQuadro.js';

export const tabelaNegociacao = pgTable('negociacao', {
  id: uuid('id').defaultRandom().primaryKey(),
  leadId: uuid('lead_id')
    .notNull()
    .references(() => tabelaLead.id, { onDelete: 'restrict' }),
  quadroId: uuid('quadro_id')
    .notNull()
    .references(() => tabelaQuadro.id, { onDelete: 'restrict' }),
  colunaId: uuid('coluna_id')
    .notNull()
    .references(() => tabelaColuna.id, { onDelete: 'restrict' }),
  titulo: text('titulo').notNull(),
  descricao: text('descricao'),
  valorEstimadoBrlCentavos: bigint('valor_estimado_brl_centavos', { mode: 'number' })
    .notNull()
    .default(0),
  valorFechadoBrlCentavos: bigint('valor_fechado_brl_centavos', { mode: 'number' })
    .notNull()
    .default(0),
  resultado: enumResultadoNegociacao('resultado').notNull().default('ABERTA'),
  plankaCardId: uuid('planka_card_id'),
  mesPrevistoEvento: date('mes_previsto_evento'),
  motivoPerda: text('motivo_perda'),
  responsavelEmail: text('responsavel_email'),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow()
});
