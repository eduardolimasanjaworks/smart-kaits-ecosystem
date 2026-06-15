// Rotas HTTP de relatórios BI (filtros Zod compartilhados).
import { Hono } from 'hono';
import { z } from 'zod';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../infra/banco/schema/indiceSchema.js';
import { consultarClienteDetalhe } from '../../../aplicacao/relatorios/consultas/clienteDetalhe.js';
import { consultarFaturamentoMensal } from '../../../aplicacao/relatorios/consultas/faturamentoMensal.js';
import { consultarFunilPorQuadro } from '../../../aplicacao/relatorios/consultas/funilPorQuadro.js';
import { listarNegociacoesRelatorio } from '../../../aplicacao/relatorios/consultas/listarNegociacoesRelatorio.js';
import { consultarMesesRanking } from '../../../aplicacao/relatorios/consultas/mesesRanking.js';
import { consultarConversaoFunil } from '../../../aplicacao/relatorios/consultas/conversaoFunil.js';
import { consultarGargalos } from '../../../aplicacao/relatorios/consultas/gargalos.js';
import { consultarResumoComFiltros } from '../../../aplicacao/relatorios/consultas/resumoComFiltros.js';
import { consultarTempoPorColuna } from '../../../aplicacao/relatorios/consultas/tempoPorColuna.js';
import { consultarTicketMedio, periodoTicketMedio } from '../../../aplicacao/relatorios/consultas/ticketMedio.js';
import {
  consultarTopClientes,
  periodoTopClientes,
} from '../../../aplicacao/relatorios/consultas/topClientes.js';
import {
  consultarTopProdutos,
  periodoTopProdutos,
} from '../../../aplicacao/relatorios/consultas/topProdutos.js';
import { gerarPdfCliente } from '../../../aplicacao/relatorios/gerarPdfCliente.js';
import { gerarPdfComFiltros } from '../../../aplicacao/relatorios/gerarPdfComFiltros.js';
import { resolverPeriodoFiltro } from '../../../aplicacao/relatorios/utilCondicoesFiltroRelatorio.js';
import {
  parsearFiltroMesesRankingQuery,
  parsearFiltroRelatorioQuery,
} from '../esquemas/esquemaFiltroRelatorio.js';
import { esquemaConsultaPaginada } from '../utilPaginacao.js';

type Db = NodePgDatabase<typeof schema>;

function respostaErroFiltro(
  c: { json: (b: unknown, s: number) => Response },
  erro: { flatten: () => unknown },
) {
  return c.json({ erro: 'Filtros inválidos', detalhes: erro.flatten() }, 400);
}

export function criarRotasRelatorios(db: Db) {
  const app = new Hono();

  app.get('/relatorios/resumo', async (c) => {
    const parsed = parsearFiltroRelatorioQuery(c.req.query());
    if (!parsed.success) return respostaErroFiltro(c, parsed.error);
    return c.json(await consultarResumoComFiltros(db, parsed.data));
  });

  app.get('/relatorios/cliente/:leadId', async (c) => {
    const parsed = parsearFiltroRelatorioQuery(c.req.query());
    if (!parsed.success) return respostaErroFiltro(c, parsed.error);
    const dados = await consultarClienteDetalhe(db, c.req.param('leadId'), parsed.data);
    if (!dados) return c.json({ erro: 'Cliente não encontrado' }, 404);
    return c.json(dados);
  });

  app.get('/relatorios/cliente/:leadId/pdf', async (c) => {
    try {
      const pdf = await gerarPdfCliente(db, c.req.param('leadId'));
      return new Response(new Uint8Array(pdf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="relatorio-cliente.pdf"',
        },
      });
    } catch {
      return c.json({ erro: 'Cliente não encontrado' }, 404);
    }
  });

  app.get('/relatorios/funil', async (c) => {
    const quadroId = z.string().uuid().safeParse(c.req.query('quadroId'));
    if (!quadroId.success) {
      return c.json({ erro: 'quadroId inválido' }, 400);
    }
    const parsed = parsearFiltroRelatorioQuery(c.req.query());
    if (!parsed.success) return respostaErroFiltro(c, parsed.error);
    return c.json(await consultarFunilPorQuadro(db, quadroId.data, parsed.data));
  });

  app.get('/relatorios/faturamento-mensal', async (c) => {
    const parsed = parsearFiltroRelatorioQuery(c.req.query());
    if (!parsed.success) return respostaErroFiltro(c, parsed.error);
    return c.json(await consultarFaturamentoMensal(db, parsed.data));
  });

  app.get('/relatorios/negociacoes', async (c) => {
    const parsedFiltro = parsearFiltroRelatorioQuery(c.req.query());
    if (!parsedFiltro.success) return respostaErroFiltro(c, parsedFiltro.error);
    const parsedPag = esquemaConsultaPaginada.safeParse(c.req.query());
    if (!parsedPag.success) {
      return c.json({ erro: 'Paginação inválida', detalhes: parsedPag.error.flatten() }, 400);
    }
    return c.json(await listarNegociacoesRelatorio(db, parsedFiltro.data, parsedPag.data));
  });

  app.get('/relatorios/meses-ranking', async (c) => {
    const parsed = parsearFiltroMesesRankingQuery(c.req.query());
    if (!parsed.success) return respostaErroFiltro(c, parsed.error);
    return c.json(await consultarMesesRanking(db, parsed.data));
  });

  app.get('/relatorios/pdf', async (c) => {
    const parsed = parsearFiltroRelatorioQuery(c.req.query());
    if (!parsed.success) return respostaErroFiltro(c, parsed.error);
    const pdf = await gerarPdfComFiltros(db, parsed.data);
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="relatorio-filtros.pdf"',
      },
    });
  });

  app.get('/relatorios/ticket-medio', async (c) => {
    const parsed = parsearFiltroRelatorioQuery(c.req.query());
    if (!parsed.success) return respostaErroFiltro(c, parsed.error);
    const resultado = await consultarTicketMedio(db, parsed.data);
    return c.json({ periodo: periodoTicketMedio(parsed.data), ...resultado });
  });

  app.get('/relatorios/tempo-por-coluna', async (c) => {
    const parsed = parsearFiltroRelatorioQuery(c.req.query());
    if (!parsed.success) return respostaErroFiltro(c, parsed.error);
    const periodo = resolverPeriodoFiltro(parsed.data);
    const colunas = await consultarTempoPorColuna(db, {
      quadroId: parsed.data.quadroId,
      inicioUtc: periodo.inicioInclusiveUtc,
      fimExclusiveUtc: periodo.fimExclusiveUtc,
    });
    return c.json({
      periodo: { inicio: periodo.inicio, fim: periodo.fim },
      quadroId: parsed.data.quadroId ?? null,
      colunas,
    });
  });

  app.get('/relatorios/gargalos', async (c) => {
    const parsed = parsearFiltroRelatorioQuery(c.req.query());
    if (!parsed.success) return respostaErroFiltro(c, parsed.error);
    const periodo = resolverPeriodoFiltro(parsed.data);
    const resultado = await consultarGargalos(db, {
      quadroId: parsed.data.quadroId,
      inicioUtc: periodo.inicioInclusiveUtc,
      fimExclusiveUtc: periodo.fimExclusiveUtc,
    });
    return c.json({
      periodo: { inicio: periodo.inicio, fim: periodo.fim },
      quadroId: parsed.data.quadroId ?? null,
      ...resultado,
    });
  });

  app.get('/relatorios/conversao-funil', async (c) => {
    const quadroId = z.string().uuid().safeParse(c.req.query('quadroId'));
    if (!quadroId.success) {
      return c.json({ erro: 'quadroId obrigatório (uuid)' }, 400);
    }
    const etapas = await consultarConversaoFunil(db, quadroId.data);
    return c.json({ quadroId: quadroId.data, etapas });
  });

  app.get('/relatorios/top-clientes', async (c) => {
    const parsed = parsearFiltroRelatorioQuery(c.req.query());
    if (!parsed.success) return respostaErroFiltro(c, parsed.error);
    const clientes = await consultarTopClientes(db, parsed.data);
    return c.json({ periodo: periodoTopClientes(parsed.data), clientes });
  });

  app.get('/relatorios/top-produtos', async (c) => {
    const parsed = parsearFiltroRelatorioQuery(c.req.query());
    if (!parsed.success) return respostaErroFiltro(c, parsed.error);
    const produtos = await consultarTopProdutos(db, parsed.data);
    return c.json({ periodo: periodoTopProdutos(parsed.data), produtos });
  });

  return app;
}
