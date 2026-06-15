// Pool PostgreSQL configurável por ambiente (latência e limites de conexão).
import pg from 'pg';

const { Pool } = pg;

type ConfiguracaoPool = {
  urlConexao: string;
  minimo: number;
  maximo: number;
};

/**
 * Cria pool pg com limites explícitos para requisições HTTP curtas.
 * @param configuracao URL e limites mín/máx do pool.
 */
export function criarPoolPostgres(configuracao: ConfiguracaoPool): pg.Pool {
  return new Pool({
    connectionString: configuracao.urlConexao,
    min: configuracao.minimo,
    max: configuracao.maximo
  });
}
