/**
 * Testes de contrato D3: visões pré-montadas ainda não implementadas como componentes.
 * Quando VisaoDono/Cliente/Funil/Financeiro existirem, devem usar listarConsultasVisao
 * ou os builders de @/lib/relatorios/consultasRelatorio.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  listarConsultasVisao,
  type VisaoRelatorioPreMontada,
} from "@/lib/relatorios/consultasRelatorio";
import type { FiltroRelatorio } from "../tiposFiltroRelatorio";

const VISAO_ARQUIVOS: Record<VisaoRelatorioPreMontada, string> = {
  dono: "VisaoDono.tsx",
  cliente: "VisaoCliente.tsx",
  funil: "VisaoFunil.tsx",
  financeiro: "VisaoFinanceiro.tsx",
};

const filtros: FiltroRelatorio = {
  inicio: "2026-05-01",
  fim: "2026-05-31",
  tipoData: "criado",
};

const QUADRO = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const LEAD = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
const BASE = "http://127.0.0.1:4001";

describe("visões pré-montadas — contrato de fetch (SPEC D3)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function simularMontagemVisao(visao: VisaoRelatorioPreMontada) {
    const consultas = listarConsultasVisao(visao, {
      baseUrl: BASE,
      filtros,
      quadroId: QUADRO,
      leadId: LEAD,
    });
    await Promise.all(consultas.map((c) => fetch(c.url)));
    return consultas;
  }

  it.each([
    ["dono", ["/relatorios/resumo", "/relatorios/conversao-funil"]],
    [
      "cliente",
      [`/relatorios/cliente/${LEAD}`, `/relatorios/cliente/${LEAD}/pdf`],
    ],
    [
      "funil",
      [
        "/quadros/padrao",
        "/relatorios/funil",
        "/relatorios/gargalos",
        "/relatorios/tempo-por-coluna",
      ],
    ],
    [
      "financeiro",
      [
        "/relatorios/faturamento-mensal",
        "/relatorios/top-clientes",
        "/relatorios/top-produtos",
        "/relatorios/ticket-medio",
      ],
    ],
  ] as const)(
    "visão %s dispara GETs esperados",
    async (visao, pathsEsperados) => {
      const consultas = await simularMontagemVisao(visao);
      expect(fetchMock).toHaveBeenCalledTimes(consultas.length);
      const pathsChamados = fetchMock.mock.calls.map(([url]) => new URL(url).pathname);
      for (const p of pathsEsperados) {
        expect(pathsChamados.some((path) => path === p || path.startsWith(p))).toBe(
          true,
        );
      }
    },
  );

  it("componentes D3 ainda ausentes — documenta pendência", () => {
    const dir = resolve(__dirname);
    const todas = Object.keys(VISAO_ARQUIVOS) as VisaoRelatorioPreMontada[];
    const pendentes = Object.entries(VISAO_ARQUIVOS)
      .filter(([, arquivo]) => !existsSync(resolve(dir, arquivo)))
      .map(([id]) => id);
    expect(pendentes.length).toBeGreaterThan(0);
    expect(pendentes.length).toBeLessThan(todas.length);
    expect(pendentes.every((id) => todas.includes(id as VisaoRelatorioPreMontada))).toBe(
      true,
    );
  });
});
