// Top 5 produtos por quantidade vendida (negociações GANHA no período).
import { and, desc, eq, sql } from 'drizzle-orm';
import * as schema from '../../../infra/banco/schema/indiceSchema.js';
import type { FiltroRelatorio } from '../../../entrada/http/esquemas/esquemaFiltroRelatorio.js';
import {
  montarCondicoesNegociacao,
  resolverPeriodoFiltro,
  type DbRelatorio,
} from '../utilCondicoesFiltroRelatorio.js';

export type LinhaTopProduto = {
  produtoId: string;
  nome: string;
  quantidadeTotal: number;
  receitaBrlCentavos: number;
};

export async function consultarTopProdutos(
  db: DbRelatorio,
  filtros: FiltroRelatorio,
): Promise<LinhaTopProduto[]> {
  const whereBase = montarCondicoesNegociacao(db, filtros);
  const where = and(whereBase, eq(schema.tabelaNegociacao.resultado, 'GANHA'));

  const linhas = await db
    .select({
      produtoId: schema.tabelaProduto.id,
      nome: schema.tabelaProduto.nome,
      quantidadeTotal: sql<number>`coalesce(sum(${schema.tabelaNegociacaoProduto.quantidade}), 0)`,
      receitaBrlCentavos: sql<number>`coalesce(sum(${schema.tabelaNegociacaoProduto.quantidade} * ${schema.tabelaNegociacaoProduto.precoUnitarioBrlCentavos}), 0)`,
    })
    .from(schema.tabelaNegociacaoProduto)
    .innerJoin(
      schema.tabelaNegociacao,
      eq(schema.tabelaNegociacao.id, schema.tabelaNegociacaoProduto.negociacaoId),
    )
    .innerJoin(
      schema.tabelaProduto,
      eq(schema.tabelaProduto.id, schema.tabelaNegociacaoProduto.produtoId),
    )
    .where(where)
    .groupBy(schema.tabelaProduto.id, schema.tabelaProduto.nome)
    .orderBy(desc(sql`sum(${schema.tabelaNegociacaoProduto.quantidade})`))
    .limit(5);

  return linhas.map((l) => ({
    produtoId: l.produtoId,
    nome: l.nome,
    quantidadeTotal: Number(l.quantidadeTotal),
    receitaBrlCentavos: Number(l.receitaBrlCentavos),
  }));
}

export function periodoTopProdutos(filtros: FiltroRelatorio) {
  const p = resolverPeriodoFiltro(filtros);
  return { inicio: p.inicio, fim: p.fim };
}
