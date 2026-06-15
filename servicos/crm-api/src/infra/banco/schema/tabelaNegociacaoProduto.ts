// Linhas de produto na negociação com snapshot de preço unitário em centavos BRL.
import { bigint, integer, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tabelaNegociacao } from './tabelaNegociacao.js';
import { tabelaProduto } from './tabelaProduto.js';

export const tabelaNegociacaoProduto = pgTable('negociacao_produto', {
  id: uuid('id').defaultRandom().primaryKey(),
  negociacaoId: uuid('negociacao_id')
    .notNull()
    .references(() => tabelaNegociacao.id, { onDelete: 'cascade' }),
  produtoId: uuid('produto_id')
    .notNull()
    .references(() => tabelaProduto.id, { onDelete: 'restrict' }),
  quantidade: integer('quantidade').notNull(),
  precoUnitarioBrlCentavos: bigint('preco_unitario_brl_centavos', {
    mode: 'number'
  }).notNull(),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow()
});
