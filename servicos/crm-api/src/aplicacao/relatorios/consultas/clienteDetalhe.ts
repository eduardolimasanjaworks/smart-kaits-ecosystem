// Detalhe comercial por lead: negociações e totais (F1-5).
import { eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../infra/banco/schema/indiceSchema.js';
import type { FiltroRelatorio } from '../../../entrada/http/esquemas/esquemaFiltroRelatorio.js';
import { montarCondicoesNegociacao, resolverPeriodoFiltro } from '../utilCondicoesFiltroRelatorio.js';

type Db = NodePgDatabase<typeof schema>;

export async function consultarClienteDetalhe(db: Db, leadId: string, filtrosBase?: FiltroRelatorio) {
  const [lead] = await db
    .select({
      id: schema.tabelaLead.id,
      nomeContato: schema.tabelaLead.nomeContato,
      emailContato: schema.tabelaLead.emailContato,
      telefoneContato: schema.tabelaLead.telefoneContato,
    })
    .from(schema.tabelaLead)
    .where(eq(schema.tabelaLead.id, leadId))
    .limit(1);

  if (!lead) return null;

  const filtros: FiltroRelatorio = { ...filtrosBase, leadId, tipoData: filtrosBase?.tipoData ?? 'criado' };
  const periodo = resolverPeriodoFiltro(filtros);
  const whereNeg = montarCondicoesNegociacao(db, filtros);

  const negociacoes = await db
    .select({
      id: schema.tabelaNegociacao.id,
      titulo: schema.tabelaNegociacao.titulo,
      resultado: schema.tabelaNegociacao.resultado,
      colunaId: schema.tabelaNegociacao.colunaId,
      valorEstimadoBrlCentavos: schema.tabelaNegociacao.valorEstimadoBrlCentavos,
      valorFechadoBrlCentavos: schema.tabelaNegociacao.valorFechadoBrlCentavos,
      criadoEm: schema.tabelaNegociacao.criadoEm,
      atualizadoEm: schema.tabelaNegociacao.atualizadoEm,
    })
    .from(schema.tabelaNegociacao)
    .where(whereNeg)
    .orderBy(schema.tabelaNegociacao.criadoEm);

  const totaisRows = await db
    .select({
      ganho: sql<number>`coalesce(sum(case when ${schema.tabelaNegociacao.resultado} = 'GANHA' then ${schema.tabelaNegociacao.valorFechadoBrlCentavos} else 0 end),0)`,
      aberto: sql<number>`coalesce(sum(case when ${schema.tabelaNegociacao.resultado} = 'ABERTA' then ${schema.tabelaNegociacao.valorEstimadoBrlCentavos} else 0 end),0)`,
      perdido: sql<number>`coalesce(sum(case when ${schema.tabelaNegociacao.resultado} = 'PERDIDA' then ${schema.tabelaNegociacao.valorEstimadoBrlCentavos} else 0 end),0)`,
    })
    .from(schema.tabelaNegociacao)
    .where(whereNeg);

  const totais = totaisRows[0];

  return {
    periodo: { inicio: periodo.inicioIso, fim: periodo.fimInclusiveIso },
    lead,
    negociacoes,
    totais: {
      ganhoBrlCentavos: Number(totais?.ganho ?? 0),
      abertoBrlCentavos: Number(totais?.aberto ?? 0),
      perdidoBrlCentavos: Number(totais?.perdido ?? 0),
    },
  };
}
