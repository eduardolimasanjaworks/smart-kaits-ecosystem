// Schemas Zod para catálogo de produtos.
import { z } from 'zod';

export const esquemaProdutoCriacao = z.object({
  nome: z.string().min(1).max(500),
  codigoSku: z.string().max(120).optional().nullable(),
  precoReferenciaBrlCentavos: z.number().int().nonnegative().default(0)
});

export const esquemaProdutoAtualizacao = z.object({
  nome: z.string().min(1).max(500).optional(),
  codigoSku: z.string().max(120).optional().nullable(),
  precoReferenciaBrlCentavos: z.number().int().nonnegative().optional()
});
