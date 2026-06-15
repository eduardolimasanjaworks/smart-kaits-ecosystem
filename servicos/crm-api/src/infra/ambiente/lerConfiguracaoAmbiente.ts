// Lê variáveis de ambiente tipadas para a API CRM (12-factor).
const padraoUrl = 'postgres://crm:crm@127.0.0.1:5432/crm';

/**
 * Monta configuração de runtime a partir de `process.env`.
 */
export function lerConfiguracaoAmbiente() {
  const urlBanco = process.env.DATABASE_URL ?? padraoUrl;
  const portaHttp = Number(process.env.PORT ?? '4001');
  const minimoPool = Number(process.env.PG_POOL_MIN ?? '1');
  const maximoPool = Number(process.env.PG_POOL_MAX ?? '10');
  return { urlBanco, portaHttp, minimoPool, maximoPool };
}
