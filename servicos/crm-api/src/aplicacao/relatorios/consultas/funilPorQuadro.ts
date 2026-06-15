// Funil por colunas do quadro: quantidade e valores (F1-6).
import { count, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../infra/banco/schema/indiceSchema.js';
import type { FiltroRelatorio } from '../../../entrada/http/esquemas/esquemaFiltroRelatorio.js';
import { montarCondicoesNegociacao, resolverPeriodoFiltro } from '../utilCondicoesFiltroRelatorio.js';

type Db = NodePgDatabase<typeof schema>;

export async function consultarFunilPorQuadro(
  db: Db,
  quadroId: string,
  filtrosBase?: FiltroRelatorio,
) {
  const filtros: FiltroRelatorio = { ...filtrosBase, quadroId, tipoData: filtrosBase?.tipoData ?? 'criado' };
  const periodo = resolverPeriodoFiltro(filtros);
  const whereNeg = montarCondicoesNegociacao(db, filtros);

  const colunas = await db
    .select({
      id: schema.tabelaColuna.id,
      titulo: schema.tabelaColuna.titulo,
      ordemPosicao: schema.tabelaColuna.ordemPosicao,
    })
    .from(schema.tabelaColuna)
    .where(eq(schema.tabelaColuna.quadroId, quadroId))
    .orderBy(schema.tabelaColuna.ordemPosicao);

  const agg = await db
    .select({
      colunaId: schema.tabelaNegociacao.colunaId,
      quantidade: count(),
      valorEstimadoBrlCentavos: sql<number>`coalesce(sum(${schema.tabelaNegociacao.valorEstimadoBrlCentavos}),0)`,
      valorGanhoBrlCentavos: sql<number>`coalesce(sum(case when ${schema.tabelaNegociacao.resultado} = 'GANHA' then ${schema.tabelaNegociacao.valorFechadoBrlCentavos} else 0 end),0)`,
    })
    .from(schema.tabelaNegociacao)
    .where(whereNeg)
    .groupBy(schema.tabelaNegociacao.colunaId);

  const porColunaId = new Map(agg.map((a) => [a.colunaId, a]));

  return {
    quadroId,
    periodo: { inicio: periodo.inicioIso, fim: periodo.fimInclusiveIso },
    colunas: colunas.map((c) => {
      const dados = porColunaId.get(c.id);
      return {
        colunaId: c.id,
        titulo: c.titulo,
        ordemPosicao: c.ordemPosicao,
        quantidade: Number(dados?.quantidade ?? 0),
        valorEstimadoBrlCentavos: Number(dados?.valorEstimadoBrlCentavos ?? 0),
        valorGanhoBrlCentavos: Number(dados?.valorGanhoBrlCentavos ?? 0),
      };
    }),
  };
}
