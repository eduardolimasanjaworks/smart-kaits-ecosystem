import obterDadosMockKpis from "@/dominio/repositorio/obterDadosMockKpis";
import { esquemaKpisConsolidado } from "@/dominio/validacao/esquemaKpisConsolidado";
import { describe, expect, it } from "vitest";

describe("esquemaKpisConsolidado", () => {
  it("aceita o payload mock completo", () => {
    const analise = esquemaKpisConsolidado.safeParse(obterDadosMockKpis());
    expect(analise.success).toBe(true);
  });

  it("rejeita payloads incompletos", () => {
    const analise = esquemaKpisConsolidado.safeParse({ invalido: true });
    expect(analise.success).toBe(false);
  });
});
