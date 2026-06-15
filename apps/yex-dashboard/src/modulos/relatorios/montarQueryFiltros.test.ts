import { describe, expect, it } from "vitest";
import { montarQueryFiltros } from "./montarQueryFiltros";
import type { FiltroRelatorio } from "./tiposFiltroRelatorio";

function paramsDaQuery(qs: string): URLSearchParams {
  const raw = qs.startsWith("?") ? qs.slice(1) : qs;
  return new URLSearchParams(raw);
}

describe("montarQueryFiltros", () => {
  const base: FiltroRelatorio = { inicio: "2026-01-01", fim: "2026-01-31" };

  it("inclui inicio e fim obrigatórios", () => {
    const qs = montarQueryFiltros(base);
    const p = paramsDaQuery(qs);
    expect(qs).toMatch(/^\?/);
    expect(p.get("inicio")).toBe("2026-01-01");
    expect(p.get("fim")).toBe("2026-01-31");
  });

  it("omite campos opcionais vazios", () => {
    const p = paramsDaQuery(montarQueryFiltros(base));
    expect(p.has("tipoData")).toBe(false);
    expect(p.has("leadId")).toBe(false);
    expect(p.has("quadroId")).toBe(false);
    expect(p.getAll("resultado")).toEqual([]);
  });

  it("inclui tipoData, leadId e quadroId quando definidos", () => {
    const p = paramsDaQuery(
      montarQueryFiltros({
        ...base,
        tipoData: "atualizado",
        leadId: "lead-42",
        quadroId: "quadro-7",
      }),
    );
    expect(p.get("tipoData")).toBe("atualizado");
    expect(p.get("leadId")).toBe("lead-42");
    expect(p.get("quadroId")).toBe("quadro-7");
  });

  it("repete resultado para cada item do array", () => {
    const p = paramsDaQuery(
      montarQueryFiltros({
        ...base,
        resultados: ["GANHA", "PERDIDA"],
      }),
    );
    expect(p.getAll("resultado")).toEqual(["GANHA", "PERDIDA"]);
  });

  it("aceita um único resultado", () => {
    const p = paramsDaQuery(
      montarQueryFiltros({ ...base, resultados: ["ABERTA"] }),
    );
    expect(p.getAll("resultado")).toEqual(["ABERTA"]);
  });
});
