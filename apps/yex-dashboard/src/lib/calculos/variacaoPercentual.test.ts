import { describe, expect, it } from "vitest";
import calcularVariacaoPercentual from "./variacaoPercentual";

describe("calcularVariacaoPercentual", () => {
  it("calcula crescimento positivo", () => {
    const resultado = calcularVariacaoPercentual({
      valorAtual: 120,
      valorAnterior: 100,
    });
    expect(resultado).toBeCloseTo(20);
  });

  it("retorna 0 quando o valor anterior é zero", () => {
    const resultado = calcularVariacaoPercentual({
      valorAtual: 50,
      valorAnterior: 0,
    });
    expect(resultado).toBe(0);
  });

  it("calcula queda", () => {
    const resultado = calcularVariacaoPercentual({
      valorAtual: 80,
      valorAnterior: 100,
    });
    expect(resultado).toBeCloseTo(-20);
  });
});
