import { describe, expect, it } from 'vitest';
import interpretarPeriodoRelatorio, {
  esquemaPeriodoRelatorio
} from './interpretarPeriodoRelatorio.js';

describe('interpretarPeriodoRelatorio', () => {
  it('converte um único dia em intervalo meia-aberta UTC', () => {
    const { inicioInclusiveUtc, fimExclusiveUtc } = interpretarPeriodoRelatorio(
      '2026-05-01',
      '2026-05-01'
    );
    expect(inicioInclusiveUtc.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    expect(fimExclusiveUtc.toISOString()).toBe('2026-05-02T00:00:00.000Z');
  });

  it('inclui o último dia do intervalo (fim exclusivo no dia seguinte)', () => {
    const { inicioInclusiveUtc, fimExclusiveUtc } = interpretarPeriodoRelatorio(
      '2026-01-01',
      '2026-01-31'
    );
    expect(inicioInclusiveUtc.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(fimExclusiveUtc.toISOString()).toBe('2026-02-01T00:00:00.000Z');
  });

  it('aceita datas válidas no esquema Zod', () => {
    const parsed = esquemaPeriodoRelatorio.safeParse({
      inicio: '2025-12-01',
      fim: '2025-12-31'
    });
    expect(parsed.success).toBe(true);
  });

  it('rejeita formato inválido no esquema Zod', () => {
    const parsed = esquemaPeriodoRelatorio.safeParse({
      inicio: '01/05/2026',
      fim: '2026-05-31'
    });
    expect(parsed.success).toBe(false);
  });
});
