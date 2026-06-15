// Rotas HTTP de cupons promocionais.
import { Hono } from 'hono';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../infra/banco/schema/indiceSchema.js';
import {
  atualizarCupom,
  criarCupom,
  excluirCupom,
  listarCupons,
  resgatarCupomPorToken,
} from '../../../aplicacao/cupom/repositorioCupom.js';
import {
  esquemaCupomAtualizacao,
  esquemaCupomCriacao,
  esquemaCupomResgate,
} from '../esquemas/esquemaCupomHttp.js';

type Db = NodePgDatabase<typeof schema>;

export function criarRotasCupom(db: Db) {
  const app = new Hono();

  app.get('/cupons', async (c) => {
    const cupons = await listarCupons(db);
    return c.json({ cupons });
  });

  app.post('/cupons', async (c) => {
    const corpo = await c.req.json();
    const parsed = esquemaCupomCriacao.safeParse(corpo);
    if (!parsed.success) {
      return c.json({ erro: 'Dados inválidos', detalhes: parsed.error.flatten() }, 400);
    }
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    const cupom = await criarCupom(db, parsed.data, token);
    return c.json({ cupom }, 201);
  });

  app.patch('/cupons/:id', async (c) => {
    const parsed = esquemaCupomAtualizacao.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ erro: 'Dados inválidos' }, 400);
    const cupom = await atualizarCupom(db, c.req.param('id'), parsed.data);
    if (!cupom) return c.json({ erro: 'Cupom não encontrado' }, 404);
    return c.json({ cupom });
  });

  app.delete('/cupons/:id', async (c) => {
    const ok = await excluirCupom(db, c.req.param('id'));
    if (!ok) return c.json({ erro: 'Cupom não encontrado' }, 404);
    return c.json({ ok: true });
  });

  app.post('/cupons/resgatar', async (c) => {
    const parsed = esquemaCupomResgate.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ erro: 'Token inválido' }, 400);
    const resultado = await resgatarCupomPorToken(db, parsed.data.token);
    if ('ok' in resultado && resultado.ok) {
      return c.json({ ok: true, mensagem: 'Cupom resgatado com sucesso.', cupom: resultado.cupom });
    }
    if ('erro' in resultado) {
      return c.json({ erro: resultado.erro, cupom: resultado.cupom }, resultado.status as 404);
    }
    return c.json({ erro: 'Falha ao resgatar cupom' }, 500);
  });

  return app;
}
