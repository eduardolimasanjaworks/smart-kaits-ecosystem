// Ticket médio de negociações GANHA no período (F2-7).
import { and, avg, count, eq, sql } from 'drizzle-orm';
import * as schema from '../../../infra/banco/schema/indiceSchema.js';
import type { FiltroRelatorio } from '../../../entrada/http/esquemas/esquemaFiltroRelatorio.js';
import {
  montarCondicoesNegociacao,
  resolverPeriodoFiltro,
  type DbRelatorio,
} from '../utilCondicoesFiltroRelatorio.js';

export type ResultadoTicketMedio = {
  ticketMedioBrlCentavos: number;
  negociacoesGanhas: number;
  faturamentoTotalBrlCentavos: number;
};

export async function consultarTicketMedio(
  db: DbRelatorio,
  filtros: FiltroRelatorio,
): Promise<ResultadoTicketMedio> {
  const whereBase = montarCondicoesNegociacao(db, filtros);
  const where = and(whereBase, eq(schema.tabelaNegociacao.resultado, 'GANHA'));

  const [linha] = await db
    .select({
      ticketMedio: avg(schema.tabelaNegociacao.valorFechadoBrlCentavos),
      total: count(),
      faturamento: sql<number>`coalesce(sum(${schema.tabelaNegociacao.valorFechadoBrlCentavos}), 0)`,
    })
    .from(schema.tabelaNegociacao)
    .where(where);

  return {
    ticketMedioBrlCentavos: Math.round(Number(linha?.ticketMedio ?? 0)),
    negociacoesGanhas: Number(linha?.total ?? 0),
    faturamentoTotalBrlCentavos: Number(linha?.faturamento ?? 0),
  };
}

export function periodoTicketMedio(filtros: FiltroRelatorio) {
  const p = resolverPeriodoFiltro(filtros);
  return { inicio: p.inicio, fim: p.fim };
}
