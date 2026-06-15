// Top 5 clientes por faturamento (negociações GANHA no período).
import { and, desc, eq, sql } from 'drizzle-orm';
import * as schema from '../../../infra/banco/schema/indiceSchema.js';
import type { FiltroRelatorio } from '../../../entrada/http/esquemas/esquemaFiltroRelatorio.js';
import {
  montarCondicoesNegociacao,
  resolverPeriodoFiltro,
  type DbRelatorio,
} from '../utilCondicoesFiltroRelatorio.js';

export type LinhaTopCliente = {
  leadId: string;
  nomeContato: string;
  totalFaturadoBrlCentavos: number;
  negociacoesGanhas: number;
};

export async function consultarTopClientes(
  db: DbRelatorio,
  filtros: FiltroRelatorio,
): Promise<LinhaTopCliente[]> {
  const whereBase = montarCondicoesNegociacao(db, filtros);
  const where = and(whereBase, eq(schema.tabelaNegociacao.resultado, 'GANHA'));

  const linhas = await db
    .select({
      leadId: schema.tabelaLead.id,
      nomeContato: schema.tabelaLead.nomeContato,
      totalFaturadoBrlCentavos: sql<number>`coalesce(sum(${schema.tabelaNegociacao.valorFechadoBrlCentavos}), 0)`,
      negociacoesGanhas: sql<number>`count(*)::int`,
    })
    .from(schema.tabelaNegociacao)
    .innerJoin(schema.tabelaLead, eq(schema.tabelaLead.id, schema.tabelaNegociacao.leadId))
    .where(where)
    .groupBy(schema.tabelaLead.id, schema.tabelaLead.nomeContato)
    .orderBy(desc(sql`sum(${schema.tabelaNegociacao.valorFechadoBrlCentavos})`))
    .limit(5);

  return linhas.map((l) => ({
    leadId: l.leadId,
    nomeContato: l.nomeContato,
    totalFaturadoBrlCentavos: Number(l.totalFaturadoBrlCentavos),
    negociacoesGanhas: Number(l.negociacoesGanhas),
  }));
}

export function periodoTopClientes(filtros: FiltroRelatorio) {
  const p = resolverPeriodoFiltro(filtros);
  return { inicio: p.inicio, fim: p.fim };
}
