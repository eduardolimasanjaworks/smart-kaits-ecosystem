// Filtros compartilhados dos relatórios (query HTTP → Zod).
// v1: no máximo 2 dimensões além do período (leadId, resultado, colunaId, quadroId, produtoId).
import { z } from 'zod';
import { esquemaResultadoNegociacao } from './esquemaNegociacaoHttp.js';

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const esquemaFiltroRelatorioBase = z.object({
  inicio: dataIso.optional(),
  fim: dataIso.optional(),
  tipoData: z.enum(['criado', 'atualizado']).default('criado'),
  responsavelEmail: z.string().email().max(320).optional(),
  leadId: z.string().uuid().optional(),
  resultado: z
    .union([esquemaResultadoNegociacao, z.array(esquemaResultadoNegociacao)])
    .optional()
    .transform((v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v])),
  colunaId: z.string().uuid().optional(),
  quadroId: z.string().uuid().optional(),
  produtoId: z.string().uuid().optional(),
});

function validarDimensoesFiltro(
  d: {
    inicio?: string;
    fim?: string;
    leadId?: string;
    resultado?: string[];
    colunaId?: string;
    quadroId?: string;
    produtoId?: string;
  },
  ctx: z.RefinementCtx,
) {
  const dims = [d.leadId, d.resultado, d.colunaId, d.quadroId, d.produtoId].filter(
    (x) => x !== undefined && (!(Array.isArray(x)) || x.length > 0),
  );
  if (dims.length > 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Máximo 2 dimensões além do período',
    });
  }
  if ((d.inicio && !d.fim) || (!d.inicio && d.fim)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Informe inicio e fim juntos (YYYY-MM-DD)',
      path: ['inicio'],
    });
  }
}

export const esquemaFiltroRelatorio = esquemaFiltroRelatorioBase.superRefine(validarDimensoesFiltro);

export const esquemaFiltroMesesRanking = esquemaFiltroRelatorioBase
  .extend({
    campoMes: z.enum(['criado', 'previsto']).default('criado'),
  })
  .superRefine(validarDimensoesFiltro);

export type FiltroRelatorio = z.infer<typeof esquemaFiltroRelatorio>;
export type FiltroMesesRanking = z.infer<typeof esquemaFiltroMesesRanking>;

function lerUm(query: Record<string, string | string[] | undefined>, chave: string) {
  const v = query[chave];
  return Array.isArray(v) ? v[0] : v;
}

function lerResultadoQuery(valor: string | undefined) {
  if (!valor) return undefined;
  if (valor.includes(',')) return valor.split(',').map((s) => s.trim());
  return valor;
}

function montarObjetoFiltroBase(query: Record<string, string | string[] | undefined>) {
  const resultadosRaw = query['resultado'];
  const resultados = Array.isArray(resultadosRaw)
    ? resultadosRaw
    : lerResultadoQuery(resultadosRaw);
  return {
    inicio: lerUm(query, 'inicio'),
    fim: lerUm(query, 'fim'),
    tipoData: lerUm(query, 'tipoData'),
    responsavelEmail: lerUm(query, 'responsavelEmail'),
    leadId: lerUm(query, 'leadId'),
    colunaId: lerUm(query, 'colunaId'),
    quadroId: lerUm(query, 'quadroId'),
    produtoId: lerUm(query, 'produtoId'),
    campoMes: lerUm(query, 'campoMes'),
    resultado: resultados,
  };
}

export function parsearFiltroRelatorioQuery(query: Record<string, string | string[] | undefined>) {
  return esquemaFiltroRelatorio.safeParse(montarObjetoFiltroBase(query));
}

export function parsearFiltroMesesRankingQuery(query: Record<string, string | string[] | undefined>) {
  return esquemaFiltroMesesRanking.safeParse(montarObjetoFiltroBase(query));
}
