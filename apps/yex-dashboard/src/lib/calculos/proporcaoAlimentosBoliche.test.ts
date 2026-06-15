import { describe, expect, it } from "vitest";
import calcularProporcaoAlimentosBoliche from "./proporcaoAlimentosBoliche";

describe("calcularProporcaoAlimentosBoliche", () => {
  it("retorna a razão quando o denominador é positivo", () => {
    const resultado = calcularProporcaoAlimentosBoliche({
      faturamentoAlimentosBebidas: 5000,
      faturamentoBoliche: 5000,
    });
    expect(resultado).toBe(1);
  });

  it("retorna 0 quando o faturamento de boliche é zero", () => {
    const resultado = calcularProporcaoAlimentosBoliche({
      faturamentoAlimentosBebidas: 1000,
      faturamentoBoliche: 0,
    });
    expect(resultado).toBe(0);
  });

  it("retorna 0 quando o faturamento de boliche é negativo", () => {
    const resultado = calcularProporcaoAlimentosBoliche({
      faturamentoAlimentosBebidas: 1000,
      faturamentoBoliche: -10,
    });
    expect(resultado).toBe(0);
  });
});
