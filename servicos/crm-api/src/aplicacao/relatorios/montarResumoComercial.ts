// Agrega KPIs comerciais para dashboard e PDF (período mensal padrão).
import { SQL, and, count, desc, eq, gte, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../infra/banco/schema/indiceSchema.js';
import interpretarPeriodoRelatorio from './interpretarPeriodoRelatorio.js';

type Db = NodePgDatabase<typeof schema>;

function periodoMesAtual() {
  const agora = new Date();
  const inicio = `${agora.getUTCFullYear()}-${String(agora.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const fim = inicio.slice(0, 8) + String(new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 0)).getUTCDate()).padStart(2, '0');
  return interpretarPeriodoRelatorio(inicio, fim);
}

export type FiltrosResumoComercial = {
  responsavelEmail?: string;
};

export async function montarResumoComercial(db: Db, filtros: FiltrosResumoComercial = {}) {
  const { inicioInclusiveUtc: inicio, fimExclusiveUtc: fim } = periodoMesAtual();
  const emailResp = filtros.responsavelEmail?.trim().toLowerCase();
  const filtroNegociacao: SQL[] = [gte(schema.tabelaNegociacao.criadoEm, inicio)];
  if (emailResp) {
    filtroNegociacao.push(eq(schema.tabelaNegociacao.responsavelEmail, emailResp));
  }
  const whereNegociacao = and(...filtroNegociacao);

  const contatosRows = await db
    .select({ total: count() })
    .from(schema.tabelaLead)
    .where(gte(schema.tabelaLead.criadoEm, inicio));
  const contatosMes = contatosRows[0];

  const negociacoesMes = await db
    .select({
      resultado: schema.tabelaNegociacao.resultado,
      total: count(),
      valor: sql<number>`coalesce(sum(${schema.tabelaNegociacao.valorFechadoBrlCentavos}),0)`,
    })
    .from(schema.tabelaNegociacao)
    .where(whereNegociacao)
    .groupBy(schema.tabelaNegociacao.resultado);

  const orcamentosQuery = db
    .select({ total: count() })
    .from(schema.tabelaEventoComercial)
    .innerJoin(
      schema.tabelaNegociacao,
      eq(schema.tabelaNegociacao.id, schema.tabelaEventoComercial.negociacaoId),
    );
  const orcamentos = await (emailResp
    ? orcamentosQuery.where(
        and(
          eq(schema.tabelaEventoComercial.tipo, 'ORCAMENTO_ENVIADO'),
          gte(schema.tabelaEventoComercial.criadoEm, inicio),
          eq(schema.tabelaNegociacao.responsavelEmail, emailResp),
        ),
      )
    : orcamentosQuery.where(
        and(
          eq(schema.tabelaEventoComercial.tipo, 'ORCAMENTO_ENVIADO'),
          gte(schema.tabelaEventoComercial.criadoEm, inicio),
        ),
      ));

  const produtosTopQuery = db
    .select({
      produtoId: schema.tabelaNegociacaoProduto.produtoId,
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
    );
  const produtosTop = await (emailResp
    ? produtosTopQuery.where(eq(schema.tabelaNegociacao.responsavelEmail, emailResp))
    : produtosTopQuery
  )
    .groupBy(schema.tabelaNegociacaoProduto.produtoId, schema.tabelaProduto.nome)
    .orderBy(desc(sql`sum(${schema.tabelaNegociacaoProduto.quantidade})`))
    .limit(5);

  const ganhas = negociacoesMes.find((n) => n.resultado === 'GANHA')?.total ?? 0;
  const abertas = negociacoesMes.find((n) => n.resultado === 'ABERTA')?.total ?? 0;
  const perdidas = negociacoesMes.find((n) => n.resultado === 'PERDIDA')?.total ?? 0;
  const faturamento = negociacoesMes.find((n) => n.resultado === 'GANHA')?.valor ?? 0;
  const orcamentosTotal = Number(orcamentos.at(0)?.total ?? 0);
  const taxaConversao =
    orcamentosTotal > 0 ? Math.round((Number(ganhas) / orcamentosTotal) * 100) : 0;

  return {
    filtros: emailResp ? { responsavelEmail: emailResp } : {},
    periodo: { inicio: inicio.toISOString(), fim: new Date(fim.getTime() - 1).toISOString() },
    contatosNoMes: Number(contatosMes?.total ?? 0),
    negociacoesAbertas: Number(abertas),
    negociacoesGanhas: Number(ganhas),
    negociacoesPerdidas: Number(perdidas),
    orcamentosEnviados: orcamentosTotal,
    taxaConversaoOrcamentoParaVenda: taxaConversao,
    faturamentoBrutoBrlCentavos: Number(faturamento),
    produtosMaisVendidos: produtosTop.map((p) => ({
      nome: p.nome,
      quantidade: Number(p.quantidade),
    })),
  };
}
