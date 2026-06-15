// Ponto de entrada HTTP da API CRM Yex (Hono + Postgres).
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { lerConfiguracaoAmbiente } from './infra/ambiente/lerConfiguracaoAmbiente.js';
import { bancoDados, poolPostgres } from './infra/banco/instanciaBancoDados.js';
import { executarSeedInicial } from './infra/banco/seedInicial.js';
import { criarRotasCrm } from './entrada/http/rotas/rotasCrm.js';
import registrarMiddlewareRastreamento from './entrada/http/middlewareRastreamento.js';
import manipuladorErroGlobal from './entrada/http/manipuladorErroGlobal.js';

const ambiente = lerConfiguracaoAmbiente();
const app = new Hono();

registrarMiddlewareRastreamento(app);
app.route('/', criarRotasCrm(bancoDados));
app.onError(manipuladorErroGlobal);

async function iniciar() {
  await migrate(bancoDados, { migrationsFolder: './drizzle' });
  await executarSeedInicial(bancoDados);
  serve({ fetch: app.fetch, port: ambiente.portaHttp }, () => {
    console.log(`CRM API ouvindo na porta ${ambiente.portaHttp}`);
  });
}

iniciar().catch((erro) => {
  console.error('Falha ao iniciar CRM API', erro);
  process.exit(1);
});

process.on('SIGTERM', () => void poolPostgres.end());
