// KPIs comerciais com filtros de relatório (F1-4) e comparativo mês anterior (F2-9).
import { and, count, desc, eq, gte, lt, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../infra/banco/schema/indiceSchema.js';
import type { FiltroRelatorio } from '../../../entrada/http/esquemas/esquemaFiltroRelatorio.js';
import {
  filtrosMesAnterior,
  montarCondicoesEventoNoPeriodo,
  montarCondicoesNegociacao,
  resolverPeriodoFiltro,
} from '../utilCondicoesFiltroRelatorio.js';
import { comparativoKpi } from '../utilPeriodoConsulta.js';

type Db = NodePgDatabase<typeof schema>;

type KpisResumo = {
  contatosNoPeriodo: number;
  negociacoesAbertas: number;
  negociacoesGanhas: number;
  negociacoesPerdidas: number;
  orcamentosEnviados: number;
  taxaConversaoOrcamentoParaVenda: number;
  faturamentoBrutoBrlCentavos: number;
  valorGanhoBrlCentavos: number;
  pipelineAtivoBrlCentavos: number;
  ticketMedioBrlCentavos: number;
};

export async function consultarKpisResumo(db: Db, filtros: FiltroRelatorio): Promise<KpisResumo> {
  const periodo = resolverPeriodoFiltro(filtros);
  const whereNeg = montarCondicoesNegociacao(db, filtros);

  const contatosRows = await db
    .select({ total: count() })
    .from(schema.tabelaLead)
    .where(
      and(
        gte(schema.tabelaLead.criadoEm, periodo.inicioInclusiveUtc),
        lt(schema.tabelaLead.criadoEm, periodo.fimExclusiveUtc),
        filtros.leadId ? eq(schema.tabelaLead.id, filtros.leadId) : undefined,
      ),
    );

  const negociacoesAgg = await db
    .select({
      resultado: schema.tabelaNegociacao.resultado,
      total: count(),
      valorFechado: sql<number>`coalesce(sum(${schema.tabelaNegociacao.valorFechadoBrlCentavos}),0)`,
      valorEstimado: sql<number>`coalesce(sum(${schema.tabelaNegociacao.valorEstimadoBrlCentavos}),0)`,
    })
    .from(schema.tabelaNegociacao)
    .where(whereNeg)
    .groupBy(schema.tabelaNegociacao.resultado);

  const whereOrc = montarCondicoesEventoNoPeriodo(db, filtros, 'ORCAMENTO_ENVIADO');
  const orcamentos = await db
    .select({ total: count() })
    .from(schema.tabelaEventoComercial)
    .where(whereOrc);

  const ganhas = negociacoesAgg.find((n) => n.resultado === 'GANHA');
  const abertas = negociacoesAgg.find((n) => n.resultado === 'ABERTA');
  const perdidas = negociacoesAgg.find((n) => n.resultado === 'PERDIDA');
  const qtdGanhas = Number(ganhas?.total ?? 0);
  const valorGanho = Number(ganhas?.valorFechado ?? 0);
  const orcamentosTotal = Number(orcamentos.at(0)?.total ?? 0);

  return {
    contatosNoPeriodo: Number(contatosRows.at(0)?.total ?? 0),
    negociacoesAbertas: Number(abertas?.total ?? 0),
    negociacoesGanhas: qtdGanhas,
    negociacoesPerdidas: Number(perdidas?.total ?? 0),
    orcamentosEnviados: orcamentosTotal,
    taxaConversaoOrcamentoParaVenda:
      orcamentosTotal > 0 ? Math.round((qtdGanhas / orcamentosTotal) * 100) : 0,
    faturamentoBrutoBrlCentavos: valorGanho,
    valorGanhoBrlCentavos: valorGanho,
    pipelineAtivoBrlCentavos: Number(abertas?.valorEstimado ?? 0),
    ticketMedioBrlCentavos: qtdGanhas > 0 ? Math.round(valorGanho / qtdGanhas) : 0,
  };
}

export async function consultarResumoComFiltros(db: Db, filtros: FiltroRelatorio) {
  const periodo = resolverPeriodoFiltro(filtros);
  const periodoAnterior = resolverPeriodoFiltro(filtrosMesAnterior(filtros));
  const whereNeg = montarCondicoesNegociacao(db, filtros);

  const [kpisAtual, kpisAnterior, produtosTop] = await Promise.all([
    consultarKpisResumo(db, filtros),
    consultarKpisResumo(db, filtrosMesAnterior(filtros)),
    db
      .select({
        nome: schema.tabelaProduto.nome,
        quantidade: sql<number>`sum(${schema.tabelaNegociacaoProduto.quantidade})`,
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
      .where(whereNeg)
      .groupBy(schema.tabelaProduto.nome)
      .orderBy(desc(sql`sum(${schema.tabelaNegociacaoProduto.quantidade})`))
      .limit(5),
  ]);

  return {
    periodo: { inicio: periodo.inicioIso, fim: periodo.fimInclusiveIso },
    filtrosAplicados: filtros,
    ...kpisAtual,
    produtosMaisVendidos: produtosTop.map((p) => ({
      nome: p.nome,
      quantidade: Number(p.quantidade),
    })),
    comparativoMesAnterior: {
      periodoReferencia: { inicio: periodoAnterior.inicio, fim: periodoAnterior.fim },
      contatosNoPeriodo: comparativoKpi(
        kpisAtual.contatosNoPeriodo,
        kpisAnterior.contatosNoPeriodo,
      ),
      negociacoesGanhas: comparativoKpi(kpisAtual.negociacoesGanhas, kpisAnterior.negociacoesGanhas),
      negociacoesAbertas: comparativoKpi(
        kpisAtual.negociacoesAbertas,
        kpisAnterior.negociacoesAbertas,
      ),
      faturamentoBrutoBrlCentavos: comparativoKpi(
        kpisAtual.faturamentoBrutoBrlCentavos,
        kpisAnterior.faturamentoBrutoBrlCentavos,
      ),
      ticketMedioBrlCentavos: comparativoKpi(
        kpisAtual.ticketMedioBrlCentavos,
        kpisAnterior.ticketMedioBrlCentavos,
      ),
      taxaConversaoOrcamentoParaVenda: comparativoKpi(
        kpisAtual.taxaConversaoOrcamentoParaVenda,
        kpisAnterior.taxaConversaoOrcamentoParaVenda,
      ),
    },
  };
}
