// Rotas HTTP de metas de vendas.
import { Hono } from 'hono';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../infra/banco/schema/indiceSchema.js';
import { criarMeta, listarMetasComProgresso } from '../../../aplicacao/meta/repositorioMetaVenda.js';
import { esquemaMetaCriacao } from '../esquemas/esquemaMetaHttp.js';

type Db = NodePgDatabase<typeof schema>;

export function criarRotasMetas(db: Db) {
  const app = new Hono();

  app.get('/metas', async (c) => {
    const metas = await listarMetasComProgresso(db);
    return c.json({ metas });
  });

  app.post('/metas', async (c) => {
    const parsed = esquemaMetaCriacao.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ erro: 'Dados inválidos', detalhes: parsed.error.flatten() }, 400);
    }
    const meta = await criarMeta(db, parsed.data);
    return c.json({ meta }, 201);
  });

  return app;
}
