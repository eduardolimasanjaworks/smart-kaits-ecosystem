// Instância Drizzle + pool PostgreSQL compartilhados pelo processo HTTP.
import { drizzle } from 'drizzle-orm/node-postgres';
import { lerConfiguracaoAmbiente } from '../ambiente/lerConfiguracaoAmbiente.js';
import { criarPoolPostgres } from './poolConexaoPostgres.js';
import * as schema from './schema/indiceSchema.js';

const ambiente = lerConfiguracaoAmbiente();

export const poolPostgres = criarPoolPostgres({
  urlConexao: ambiente.urlBanco,
  minimo: ambiente.minimoPool,
  maximo: ambiente.maximoPool
});

export const bancoDados = drizzle(poolPostgres, { schema });
