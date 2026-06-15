// Schemas Zod para criação e atualização de leads comerciais.
import { z } from 'zod';

export const esquemaLeadCriacao = z.object({
  nomeContato: z.string().min(1).max(500),
  emailContato: z.string().email().optional().nullable(),
  telefoneContato: z.string().max(50).optional().nullable()
});

export const esquemaLeadAtualizacao = z.object({
  nomeContato: z.string().min(1).max(500).optional(),
  emailContato: z.string().email().optional().nullable(),
  telefoneContato: z.string().max(50).optional().nullable()
});

export const esquemaConsultaLeads = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().trim().min(1).max(200).optional(),
});
