import { z } from 'zod';

export const esquemaMetaCriacao = z.object({
  periodo: z.enum(['SEMANAL', 'MENSAL']),
  inicioPeriodo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  valorAlvoBrlCentavos: z.number().int().positive(),
});
