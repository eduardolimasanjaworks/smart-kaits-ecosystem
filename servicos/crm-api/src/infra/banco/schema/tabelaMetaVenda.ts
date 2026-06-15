// Metas de vendas semanais ou mensais em centavos BRL.
import { bigint, date, pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

export const enumPeriodoMeta = pgEnum('periodo_meta', ['SEMANAL', 'MENSAL']);

export const tabelaMetaVenda = pgTable('meta_venda', {
  id: uuid('id').defaultRandom().primaryKey(),
  periodo: enumPeriodoMeta('periodo').notNull(),
  inicioPeriodo: date('inicio_periodo').notNull(),
  valorAlvoBrlCentavos: bigint('valor_alvo_brl_centavos', { mode: 'number' }).notNull(),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
});
