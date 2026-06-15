// Schemas Zod para quadros e colunas de funil.
import { z } from 'zod';

export const esquemaQuadroCriacao = z.object({
  titulo: z.string().min(1).max(500)
});

export const esquemaQuadroAtualizacao = z.object({
  titulo: z.string().min(1).max(500).optional()
});

export const esquemaColunaCriacao = z.object({
  titulo: z.string().min(1).max(500),
  ordemPosicao: z.number().int().min(0).default(0)
});

export const esquemaColunaAtualizacao = z.object({
  titulo: z.string().min(1).max(500).optional(),
  ordemPosicao: z.number().int().min(0).optional()
});
