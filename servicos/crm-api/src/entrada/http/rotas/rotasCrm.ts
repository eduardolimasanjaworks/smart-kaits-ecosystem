// Rotas HTTP do CRM: negociações, kanban, leads, produtos e relatórios.
import { Hono } from 'hono';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../infra/banco/schema/indiceSchema.js';
import {
  inserirNegociacao,
  listarKanbanPorQuadro,
  moverNegociacao,
} from '../../../aplicacao/negociacao/repositorioNegociacao.js';
import {
  esquemaNegociacaoAtualizacao,
  esquemaNegociacaoCriacao,
} from '../esquemas/esquemaNegociacaoHttp.js';
import { esquemaConsultaLeads, esquemaLeadCriacao } from '../esquemas/esquemaLeadHttp.js';
import { listarLeadsPaginados } from '../../../aplicacao/lead/repositorioLead.js';
import { criarRotasCupom } from './rotasCupom.js';
import { criarRotasMetas } from './rotasMetas.js';
import { criarRotasRelatorios } from './rotasRelatorios.js';

type Db = NodePgDatabase<typeof schema>;

export function criarRotasCrm(db: Db) {
  const app = new Hono();

  app.route('/', criarRotasCupom(db));
  app.route('/', criarRotasMetas(db));
  app.route('/', criarRotasRelatorios(db));

  app.get('/health', (c) => c.json({ ok: true }));

  app.get('/quadros/padrao', async (c) => {
    const [quadro] = await db.select().from(schema.tabelaQuadro).limit(1);
    return c.json({ quadro });
  });

  app.get('/kanban/:quadroId', async (c) => {
    const quadroId = c.req.param('quadroId');
    const dados = await listarKanbanPorQuadro(db, quadroId);
    const porColuna = dados.colunas.map((col) => ({
      ...col,
      negociacoes: dados.negociacoes.filter((n) => n.colunaId === col.id),
    }));
    return c.json({ colunas: porColuna });
  });

  app.get('/leads', async (c) => {
    const parsed = esquemaConsultaLeads.safeParse(c.req.query());
    if (!parsed.success) return c.json({ erro: 'Parâmetros inválidos', detalhes: parsed.error.flatten() }, 400);
    const resultado = await listarLeadsPaginados(db, parsed.data);
    return c.json(resultado);
  });

  app.post('/leads', async (c) => {
    const corpo = await c.req.json();
    const parsed = esquemaLeadCriacao.safeParse(corpo);
    if (!parsed.success) return c.json({ erro: 'Dados inválidos' }, 400);
    const [lead] = await db.insert(schema.tabelaLead).values(parsed.data).returning();
    return c.json({ lead }, 201);
  });

  app.get('/tags', async (c) => {
    const tags = await db
      .select({
        id: schema.tabelaTag.id,
        nome: schema.tabelaTag.nome,
        criadoEm: schema.tabelaTag.criadoEm,
      })
      .from(schema.tabelaTag)
      .orderBy(schema.tabelaTag.nome)
      .limit(200);
    return c.json({ tags });
  });

  app.get('/produtos', async (c) => {
    const produtos = await db
      .select({
        id: schema.tabelaProduto.id,
        nome: schema.tabelaProduto.nome,
        codigoSku: schema.tabelaProduto.codigoSku,
        precoReferenciaBrlCentavos: schema.tabelaProduto.precoReferenciaBrlCentavos,
      })
      .from(schema.tabelaProduto)
      .limit(100);
    return c.json({ produtos });
  });

  app.post('/negociacoes', async (c) => {
    const corpo = await c.req.json();
    const parsed = esquemaNegociacaoCriacao.safeParse(corpo);
    if (!parsed.success) return c.json({ erro: 'Dados inválidos', detalhes: parsed.error.flatten() }, 400);
    const criada = await inserirNegociacao(db, parsed.data);
    return c.json({ negociacao: criada }, 201);
  });

  app.patch('/negociacoes/:id', async (c) => {
    const id = c.req.param('id');
    const corpo = await c.req.json();
    const parsed = esquemaNegociacaoAtualizacao.safeParse(corpo);
    if (!parsed.success) {
      return c.json({ erro: 'Dados inválidos', detalhes: parsed.error.flatten() }, 400);
    }

    if (parsed.data.colunaId) {
      await moverNegociacao(db, id, parsed.data.colunaId, crypto.randomUUID());
    }

    const { colunaId: _c, ...resto } = parsed.data;
    if (Object.keys(resto).length > 0) {
      await db.update(schema.tabelaNegociacao).set({ ...resto, atualizadoEm: new Date() }).where(eq(schema.tabelaNegociacao.id, id));
    }

    const [atualizada] = await db
      .select()
      .from(schema.tabelaNegociacao)
      .where(eq(schema.tabelaNegociacao.id, id))
      .limit(1);
    return c.json({ negociacao: atualizada });
  });

  app.delete('/negociacoes/:id', async (c) => {
    const id = c.req.param('id');
    await db.delete(schema.tabelaNegociacao).where(eq(schema.tabelaNegociacao.id, id));
    return c.json({ ok: true });
  });

  app.post('/negociacoes/:id/mover', async (c) => {
    const id = c.req.param('id');
    const { colunaId } = z.object({ colunaId: z.string().uuid() }).parse(await c.req.json());
    const ok = await moverNegociacao(db, id, colunaId, crypto.randomUUID());
    if (!ok) return c.json({ erro: 'Negociação não encontrada' }, 404);
    return c.json({ ok: true });
  });

  return app;
}
