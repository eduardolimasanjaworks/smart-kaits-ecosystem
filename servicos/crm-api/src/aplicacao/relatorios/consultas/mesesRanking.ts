// Ranking de meses com mais e menos negociações (criado ou mês previsto).
import { and, isNotNull, sql, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { FiltroMesesRanking } from '../../../entrada/http/esquemas/esquemaFiltroRelatorio.js';
import * as schema from '../../../infra/banco/schema/indiceSchema.js';
import {
  condicaoJoinProduto,
  montarCondicoesFiltroRelatorio,
} from '../montarCondicoesFiltroRelatorio.js';

type Db = NodePgDatabase<typeof schema>;

function expressaoMes(filtro: FiltroMesesRanking) {
  if (filtro.campoMes === 'previsto') {
    return sql<string>`to_char(${schema.tabelaNegociacao.mesPrevistoEvento}, 'YYYY-MM')`;
  }
  return sql<string>`to_char(date_trunc('month', ${schema.tabelaNegociacao.criadoEm}), 'YYYY-MM')`;
}

export async function consultarMesesRanking(db: Db, filtro: FiltroMesesRanking) {
  const mesExpr = expressaoMes(filtro);
  const partes: SQL[] = [];
  const filtroSql = montarCondicoesFiltroRelatorio(filtro);
  if (filtroSql) partes.push(filtroSql);
  if (filtro.campoMes === 'previsto') {
    partes.push(isNotNull(schema.tabelaNegociacao.mesPrevistoEvento));
  }
  const whereClause = partes.length ? and(...partes) : undefined;
  const joinProduto = condicaoJoinProduto(filtro);

  const base = db
    .select({
      mes: mesExpr,
      quantidade: sql<number>`count(*)::int`,
    })
    .from(schema.tabelaNegociacao);

  const comJoin = joinProduto
    ? base.innerJoin(schema.tabelaNegociacaoProduto, joinProduto)
    : base;

  const ranking = await comJoin
    .where(whereClause)
    .groupBy(mesExpr)
    .orderBy(sql`count(*) desc`);

  const comDados = ranking.filter((r) => r.mes);
  const mais = comDados[0] ?? null;
  const menos = comDados.length ? comDados[comDados.length - 1] : null;

  return {
    filtros: filtro,
    campoMes: filtro.campoMes,
    ranking: comDados.map((r) => ({ mes: r.mes, quantidade: Number(r.quantidade) })),
    destaque: {
      mesComMais: mais ? { mes: mais.mes, quantidade: Number(mais.quantidade) } : null,
      mesComMenos: menos ? { mes: menos.mes, quantidade: Number(menos.quantidade) } : null,
    },
  };
}
