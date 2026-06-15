// Helpers de paginação por cursor (UUID) com limite máximo seguro.
import { z } from 'zod';

export const esquemaConsultaPaginada = z.object({
  limite: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional()
});

export type ConsultaPaginada = z.infer<typeof esquemaConsultaPaginada>;

/**
 * Monta metadados de resposta paginada para listas ordenadas por id asc.
 * @param ids Lista de ids retornados (ordem crescente).
 * @param limite Limite solicitado.
 */
export function montarRespostaPaginada(ids: string[], limite: number) {
  const temProxima = ids.length > limite;
  const fatia = temProxima ? ids.slice(0, limite) : ids;
  const cursorProximo = temProxima ? fatia[fatia.length - 1] : null;
  return { itensIds: fatia, temProximaPagina: temProxima, cursorProximo };
}
