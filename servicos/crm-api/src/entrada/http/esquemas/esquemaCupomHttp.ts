import { z } from 'zod';

export const esquemaCupomCriacao = z.object({
  nome: z.string().min(1).max(200),
  motivo: z.string().min(1).max(500),
  descontoPercentual: z.number().min(0).max(100),
  validade: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const esquemaCupomAtualizacao = z.object({
  nome: z.string().min(1).max(200).optional(),
  motivo: z.string().min(1).max(500).optional(),
  descontoPercentual: z.number().min(0).max(100).optional(),
  validade: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const esquemaCupomResgate = z.object({
  token: z.string().min(8).max(128),
});
