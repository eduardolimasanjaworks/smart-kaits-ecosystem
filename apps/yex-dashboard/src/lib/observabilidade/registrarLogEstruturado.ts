// Logs JSON mínimos para rastreio: expandir para provedor externo quando houver backend real.
export type NivelLog = "DEBUG" | "INFO" | "WARN" | "ERROR";

export type EntradaLogEstruturado = {
  nivel: NivelLog;
  mensagem: string;
  traceId: string;
  contexto: Record<string, string | number | boolean>;
};

export default function registrarLogEstruturado(entrada: EntradaLogEstruturado) {
  const payload = {
    nivel: entrada.nivel,
    mensagem: entrada.mensagem,
    traceId: entrada.traceId,
    quando: new Date().toISOString(),
    contexto: entrada.contexto,
  };
  // eslint-disable-next-line no-console -- canal provisório até integração com agregador
  console.info(JSON.stringify(payload));
}
