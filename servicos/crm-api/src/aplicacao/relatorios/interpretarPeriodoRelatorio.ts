// Interpreta parâmetros ISO `inicio`/`fim` (datas) para intervalo UTC meia-aberta.
import { z } from 'zod';

export const esquemaPeriodoRelatorio = z.object({
  inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export type PeriodoRelatorioUtc = {
  inicioInclusiveUtc: Date;
  fimExclusiveUtc: Date;
};

/**
 * Converte datas `YYYY-MM-DD` em intervalo [inicio, fim] inclusive no fim, em UTC.
 * @param inicio Primeiro dia (inclusive).
 * @param fim Último dia (inclusive).
 */
export default function interpretarPeriodoRelatorio(
  inicio: string,
  fim: string
): PeriodoRelatorioUtc {
  const [yi, mi, di] = inicio.split('-').map(Number);
  const [yf, mf, df] = fim.split('-').map(Number);
  const inicioInclusiveUtc = new Date(Date.UTC(yi, mi - 1, di, 0, 0, 0, 0));
  const fimExclusiveUtc = new Date(Date.UTC(yf, mf - 1, df + 1, 0, 0, 0, 0));
  return { inicioInclusiveUtc, fimExclusiveUtc };
}
