// Tipagem de variáveis de contexto Hono (TraceID / rastreamento).
declare module 'hono' {
  interface ContextVariableMap {
    rastreamentoId: string;
  }
}

export {};
