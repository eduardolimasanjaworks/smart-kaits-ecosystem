// Stub de logging JSON estruturado (evolui para logger real sem bloquear rotas).
type NivelLog = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

type EntradaLog = {
  nivel: NivelLog;
  rastreamentoId: string;
  mensagem: string;
  contexto?: Record<string, string | number | boolean>;
};

/**
 * Emite uma linha JSON no stdout para ingestão futura (Datadog etc.).
 * @param entrada Campos mínimos do log.
 */
export default function emitirLogEstruturado(entrada: EntradaLog): void {
  const linha = JSON.stringify({
    quando: new Date().toISOString(),
    ...entrada
  });
  // eslint-disable-next-line no-console
  console.log(linha);
}
