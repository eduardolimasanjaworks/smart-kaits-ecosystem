// Faturamento mensal: soma valor fechado por mês (somente GANHA).
import { and, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { FiltroRelatorio } from '../../../entrada/http/esquemas/esquemaFiltroRelatorio.js';
import * as schema from '../../../infra/banco/schema/indiceSchema.js';
import {
  condicaoJoinProduto,
  montarCondicoesFiltroRelatorio,
} from '../montarCondicoesFiltroRelatorio.js';

type Db = NodePgDatabase<typeof schema>;

const mesExpr = sql<string>`to_char(date_trunc('month', ${schema.tabelaNegociacao.atualizadoEm}), 'YYYY-MM')`;

export async function consultarFaturamentoMensal(db: Db, filtro: FiltroRelatorio) {
  const filtroBase = montarCondicoesFiltroRelatorio(filtro);
  const condicoes = and(eq(schema.tabelaNegociacao.resultado, 'GANHA'), filtroBase ?? sql`true`);
  const joinProduto = condicaoJoinProduto(filtro);

  const base = db
    .select({
      mes: mesExpr,
      valorFechadoBrlCentavos: sql<number>`coalesce(sum(${schema.tabelaNegociacao.valorFechadoBrlCentavos}), 0)`,
      quantidade: sql<number>`count(*)::int`,
    })
    .from(schema.tabelaNegociacao);

  const comJoin = joinProduto
    ? base.innerJoin(schema.tabelaNegociacaoProduto, joinProduto)
    : base;

  const linhas = await comJoin.where(condicoes).groupBy(mesExpr).orderBy(mesExpr);

  return {
    filtros: filtro,
    serie: linhas.map((l) => ({
      mes: l.mes,
      valorFechadoBrlCentavos: Number(l.valorFechadoBrlCentavos),
      quantidadeGanhas: Number(l.quantidade),
    })),
  };
}
