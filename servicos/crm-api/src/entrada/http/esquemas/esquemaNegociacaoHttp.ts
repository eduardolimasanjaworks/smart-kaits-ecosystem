// Schemas Zod para negociação, linhas de produto e eventos comerciais.
import { z } from 'zod';

export const esquemaResultadoNegociacao = z.enum([
  'ABERTA',
  'GANHA',
  'PERDIDA',
  'ARQUIVADA'
]);

export const esquemaNegociacaoCriacao = z.object({
  leadId: z.string().uuid(),
  quadroId: z.string().uuid(),
  colunaId: z.string().uuid(),
  titulo: z.string().min(1).max(500),
  descricao: z.string().max(5000).optional().nullable(),
  valorEstimadoBrlCentavos: z.number().int().nonnegative().default(0),
  valorFechadoBrlCentavos: z.number().int().nonnegative().default(0),
  resultado: esquemaResultadoNegociacao.default('ABERTA'),
  mesPrevistoEvento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  motivoPerda: z.string().max(2000).optional().nullable(),
  responsavelEmail: z.string().email().max(320).optional().nullable(),
  plankaCardId: z.string().uuid().optional().nullable()
});

export const esquemaNegociacaoAtualizacao = z.object({
  colunaId: z.string().uuid().optional(),
  titulo: z.string().min(1).max(500).optional(),
  descricao: z.string().max(5000).optional().nullable(),
  valorEstimadoBrlCentavos: z.number().int().nonnegative().optional(),
  valorFechadoBrlCentavos: z.number().int().nonnegative().optional(),
  resultado: esquemaResultadoNegociacao.optional(),
  mesPrevistoEvento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  motivoPerda: z.string().min(1).max(2000).optional().nullable(),
  responsavelEmail: z.string().email().max(320).optional().nullable(),
  plankaCardId: z.string().uuid().optional().nullable()
}).superRefine((data, ctx) => {
  if (data.resultado === 'PERDIDA' && (!data.motivoPerda || data.motivoPerda.trim() === '')) {
    ctx.addIssue({
      code: 'custom',
      message: 'motivo_perda é obrigatório quando resultado=PERDIDA',
      path: ['motivoPerda'],
    });
  }
});

export const esquemaLinhaNegociacaoProduto = z.object({
  produtoId: z.string().uuid(),
  quantidade: z.number().int().positive(),
  precoUnitarioBrlCentavos: z.number().int().nonnegative()
});

export const esquemaSubstituicaoNegociacaoProdutos = z.object({
  linhas: z.array(esquemaLinhaNegociacaoProduto).max(500)
});

export const esquemaTipoEventoComercial = z.enum([
  'ORCAMENTO_ENVIADO',
  'CONTATO_REGISTRADO'
]);

export const esquemaEventoComercialCriacao = z.object({
  tipo: esquemaTipoEventoComercial,
  metadados: z.record(z.unknown()).optional().nullable()
});
