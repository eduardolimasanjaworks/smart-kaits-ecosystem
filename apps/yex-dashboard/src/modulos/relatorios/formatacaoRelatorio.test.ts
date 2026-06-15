import { describe, expect, it } from "vitest";
import {
  formatarMoedaCentavos,
  formatarVariacao,
  rotuloMesCurto,
} from "./formatacaoRelatorio";

describe("formatarMoedaCentavos", () => {
  it("formata centavos em BRL", () => {
    expect(formatarMoedaCentavos(15050)).toMatch(/150[,.]50/);
  });
});

describe("formatarVariacao", () => {
  it("retorna traço quando nulo", () => {
    expect(formatarVariacao(null)).toEqual({ texto: "—", positivo: null });
    expect(formatarVariacao(undefined)).toEqual({ texto: "—", positivo: null });
  });

  it("marca positivo e negativo", () => {
    expect(formatarVariacao(12).positivo).toBe(true);
    expect(formatarVariacao(12).texto).toBe("+12%");
    expect(formatarVariacao(-5).positivo).toBe(false);
    expect(formatarVariacao(0).positivo).toBe(null);
  });
});

describe("rotuloMesCurto", () => {
  it("abrevia mês em português", () => {
    expect(rotuloMesCurto("2026-05")).toBe("Mai/26");
    expect(rotuloMesCurto("2026-01")).toBe("Jan/26");
  });
});
