// Tabela paginada de negociações para exportação e PDF.
import { and, asc, eq, gt, sql, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { FiltroRelatorio } from '../../../entrada/http/esquemas/esquemaFiltroRelatorio.js';
import type { ConsultaPaginada } from '../../../entrada/http/utilPaginacao.js';
import { montarRespostaPaginada } from '../../../entrada/http/utilPaginacao.js';
import * as schema from '../../../infra/banco/schema/indiceSchema.js';
import {
  condicaoJoinProduto,
  montarCondicoesFiltroRelatorio,
} from '../montarCondicoesFiltroRelatorio.js';

type Db = NodePgDatabase<typeof schema>;

export async function listarNegociacoesRelatorio(
  db: Db,
  filtro: FiltroRelatorio,
  paginacao: ConsultaPaginada,
) {
  const partes: SQL[] = [];
  const filtroSql = montarCondicoesFiltroRelatorio(filtro);
  if (filtroSql) partes.push(filtroSql);
  if (paginacao.cursor) partes.push(gt(schema.tabelaNegociacao.id, paginacao.cursor));

  const whereClause = partes.length ? and(...partes) : undefined;
  const joinProduto = condicaoJoinProduto(filtro);
  const limiteBusca = paginacao.limite + 1;

  const selecao = {
    id: schema.tabelaNegociacao.id,
    titulo: schema.tabelaNegociacao.titulo,
    cliente: schema.tabelaLead.nomeContato,
    coluna: schema.tabelaColuna.titulo,
    resultado: schema.tabelaNegociacao.resultado,
    valorEstimadoBrlCentavos: schema.tabelaNegociacao.valorEstimadoBrlCentavos,
    valorFechadoBrlCentavos: schema.tabelaNegociacao.valorFechadoBrlCentavos,
    criadoEm: schema.tabelaNegociacao.criadoEm,
    atualizadoEm: schema.tabelaNegociacao.atualizadoEm,
    mesPrevistoEvento: schema.tabelaNegociacao.mesPrevistoEvento,
  };

  let consulta = db
    .select(selecao)
    .from(schema.tabelaNegociacao)
    .innerJoin(schema.tabelaLead, eq(schema.tabelaLead.id, schema.tabelaNegociacao.leadId))
    .innerJoin(schema.tabelaColuna, eq(schema.tabelaColuna.id, schema.tabelaNegociacao.colunaId))
    .$dynamic();

  if (joinProduto) {
    consulta = consulta.innerJoin(schema.tabelaNegociacaoProduto, joinProduto);
  }

  const linhas = await consulta
    .where(whereClause)
    .orderBy(asc(schema.tabelaNegociacao.id))
    .limit(limiteBusca);

  const ids = linhas.map((l) => l.id);
  const meta = montarRespostaPaginada(ids, paginacao.limite);
  const mapa = new Map(linhas.map((l) => [l.id, l]));
  const itens = meta.itensIds.map((id) => {
    const n = mapa.get(id)!;
    return {
      id: n.id,
      titulo: n.titulo,
      cliente: n.cliente,
      coluna: n.coluna,
      resultado: n.resultado,
      valorEstimadoBrlCentavos: n.valorEstimadoBrlCentavos,
      valorFechadoBrlCentavos: n.valorFechadoBrlCentavos,
      criadoEm: n.criadoEm.toISOString(),
      atualizadoEm: n.atualizadoEm.toISOString(),
      mesPrevistoEvento: n.mesPrevistoEvento ?? null,
    };
  });

  return {
    filtros: filtro,
    paginacao: {
      limite: paginacao.limite,
      cursorProximo: meta.cursorProximo,
      temProximaPagina: meta.temProximaPagina,
    },
    itens,
  };
}
