// Resolve período de consulta (query ou mês atual) e variação percentual.
import interpretarPeriodoRelatorio, {
  type PeriodoRelatorioUtc,
} from './interpretarPeriodoRelatorio.js';

export type PeriodoConsulta = PeriodoRelatorioUtc & {
  inicio: string;
  fim: string;
};

function formatarDataUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function periodoMesAtualConsulta(): PeriodoConsulta {
  const agora = new Date();
  const inicio = `${agora.getUTCFullYear()}-${String(agora.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const ultimoDia = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 0)).getUTCDate();
  const fim = `${inicio.slice(0, 8)}${String(ultimoDia).padStart(2, '0')}`;
  const intervalo = interpretarPeriodoRelatorio(inicio, fim);
  return { inicio, fim, ...intervalo };
}

export function periodoMesAnteriorConsulta(referencia: PeriodoConsulta): PeriodoConsulta {
  const [ano, mes] = referencia.inicio.split('-').map(Number);
  const mesRef = mes === 1 ? 12 : mes - 1;
  const anoRef = mes === 1 ? ano - 1 : ano;
  const inicio = `${anoRef}-${String(mesRef).padStart(2, '0')}-01`;
  const ultimoDia = new Date(Date.UTC(anoRef, mesRef, 0)).getUTCDate();
  const fim = `${anoRef}-${String(mesRef).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
  const intervalo = interpretarPeriodoRelatorio(inicio, fim);
  return { inicio, fim, ...intervalo };
}

export function resolverPeriodoConsulta(inicio?: string, fim?: string): PeriodoConsulta {
  if (inicio && fim) {
    const intervalo = interpretarPeriodoRelatorio(inicio, fim);
    return { inicio, fim, ...intervalo };
  }
  return periodoMesAtualConsulta();
}

export function variacaoPercentual(atual: number, anterior: number): number | null {
  if (anterior === 0) return atual === 0 ? 0 : null;
  return Math.round(((atual - anterior) / anterior) * 100);
}

export function comparativoKpi(atual: number, anterior: number) {
  return { valorAtual: atual, valorAnterior: anterior, variacaoPercentual: variacaoPercentual(atual, anterior) };
}
