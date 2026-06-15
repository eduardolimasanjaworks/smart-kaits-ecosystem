// Variação percentual ano contra ano (métrica-mestre de faturamento global).
export type EntradaVariacaoPercentual = {
  valorAtual: number;
  valorAnterior: number;
};

/**
 * Calcula variação percentual entre dois valores.
 * @returns 0 quando o valor anterior é zero para evitar divisão por zero.
 */
export default function calcularVariacaoPercentual(entrada: EntradaVariacaoPercentual): number {
  if (entrada.valorAnterior === 0) {
    return 0;
  }
  return ((entrada.valorAtual - entrada.valorAnterior) / entrada.valorAnterior) * 100;
}
