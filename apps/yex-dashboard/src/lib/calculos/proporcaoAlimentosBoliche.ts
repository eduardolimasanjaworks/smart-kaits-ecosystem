// Regra de negócio: quanto de alimentos por R$ de boliche (meta típica 1:1 no material de KPIs).
export type EntradaProporcaoAlimentosBoliche = {
  faturamentoAlimentosBebidas: number;
  faturamentoBoliche: number;
};

/**
 * Calcula faturamento de alimentos dividido pelo faturamento de boliche.
 * @returns 0 quando denominador inválido para evitar divisão por zero.
 */
export default function calcularProporcaoAlimentosBoliche(
  entrada: EntradaProporcaoAlimentosBoliche,
): number {
  if (entrada.faturamentoBoliche <= 0) {
    return 0;
  }
  return entrada.faturamentoAlimentosBebidas / entrada.faturamentoBoliche;
}
