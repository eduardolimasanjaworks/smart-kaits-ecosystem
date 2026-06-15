// Histórico imutável de mudanças de coluna (funil) para métricas de permanência.
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tabelaColuna } from './tabelaColuna.js';
import { tabelaNegociacao } from './tabelaNegociacao.js';

export const tabelaHistoricoColuna = pgTable('historico_coluna', {
  id: uuid('id').defaultRandom().primaryKey(),
  negociacaoId: uuid('negociacao_id')
    .notNull()
    .references(() => tabelaNegociacao.id, { onDelete: 'cascade' }),
  colunaOrigemId: uuid('coluna_origem_id').references(() => tabelaColuna.id, {
    onDelete: 'set null'
  }),
  colunaDestinoId: uuid('coluna_destino_id')
    .notNull()
    .references(() => tabelaColuna.id, { onDelete: 'restrict' }),
  rastreamentoId: text('rastreamento_id').notNull(),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow()
});
