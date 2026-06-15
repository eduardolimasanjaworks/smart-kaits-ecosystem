// Catálogo de produtos com preço de referência em centavos BRL.
import { bigint, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const tabelaProduto = pgTable('produto', {
  id: uuid('id').defaultRandom().primaryKey(),
  nome: text('nome').notNull(),
  codigoSku: text('codigo_sku'),
  precoReferenciaBrlCentavos: bigint('preco_referencia_brl_centavos', {
    mode: 'number'
  })
    .notNull()
    .default(0),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow()
});
