// Middleware que propaga ou gera o identificador de rastreamento (TraceID).
import type { Hono } from 'hono';
import { randomUUID } from 'node:crypto';

/**
 * Registra middleware de rastreamento no app raiz.
 * @param aplicativo Instância Hono.
 */
export default function registrarMiddlewareRastreamento(aplicativo: Hono): void {
  aplicativo.use('*', async (c, next) => {
    const cabecalho = c.req.header('x-trace-id');
    const id = cabecalho && cabecalho.length > 0 ? cabecalho : randomUUID();
    c.set('rastreamentoId', id);
    c.header('x-trace-id', id);
    await next();
  });
}
