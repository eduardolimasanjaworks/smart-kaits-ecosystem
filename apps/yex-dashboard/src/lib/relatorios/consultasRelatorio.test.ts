import { describe, expect, it } from "vitest";
import {
  baseUrlCrm,
  listarConsultasPersonalizado,
  listarConsultasVisao,
  periodoMesAnterior,
  urlClienteDetalhe,
  urlClientePdf,
  urlConversaoFunil,
  urlFunil,
  urlNegociacoes,
  urlResumo,
  urlResumoComparativoMes,
} from "./consultasRelatorio";
import type { FiltroRelatorio } from "@/modulos/relatorios/tiposFiltroRelatorio";

const BASE = "http://crm.test";
const QUADRO = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const LEAD = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";

const filtros: FiltroRelatorio = {
  inicio: "2026-05-01",
  fim: "2026-05-31",
  tipoData: "criado",
  resultados: ["GANHA"],
  leadId: LEAD,
};

describe("consultasRelatorio — URLs por endpoint", () => {
  it("monta resumo com query de filtros", () => {
    const url = urlResumo(filtros, BASE);
    expect(url).toBe(
      `${BASE}/relatorios/resumo?inicio=2026-05-01&fim=2026-05-31&tipoData=criado&leadId=${LEAD}&resultado=GANHA`,
    );
  });

  it("monta comparativo de resumo (mês atual e anterior)", () => {
    const { atual, anterior } = urlResumoComparativoMes(filtros, BASE);
    expect(atual).toContain("/relatorios/resumo?");
    expect(anterior).toContain("inicio=2026-04-01");
    expect(anterior).toContain("fim=2026-04-30");
  });

  it("calcula período do mês anterior", () => {
    expect(periodoMesAnterior({ inicio: "2026-01-15", fim: "2026-01-31" })).toEqual({
      inicio: "2025-12-01",
      fim: "2025-12-31",
    });
  });

  it("inclui quadroId no funil quando informado", () => {
    const url = urlFunil({ ...filtros, quadroId: undefined }, QUADRO, BASE);
    expect(url).toContain("quadroId=" + QUADRO);
    expect(url).toContain("/relatorios/funil");
  });

  it("monta detalhe e PDF do cliente", () => {
    expect(urlClienteDetalhe(LEAD, filtros, BASE)).toContain(
      `/relatorios/cliente/${LEAD}?`,
    );
    expect(urlClientePdf(LEAD, BASE)).toBe(
      `${BASE}/relatorios/cliente/${LEAD}/pdf`,
    );
  });

  it("monta conversão do funil com quadroId", () => {
    expect(urlConversaoFunil(QUADRO, BASE)).toBe(
      `${BASE}/relatorios/conversao-funil?quadroId=${QUADRO}`,
    );
  });

  it("cursor negociações", () => {
    const cursor = "00000000-0000-4000-8000-000000000001";
    const url = urlNegociacoes(filtros, 10, cursor, BASE);
    expect(url).toContain(`cursor=${cursor}`);
    expect(url).toContain("limite=10");
  });

  it("usa base padrão sem barra final", () => {
    expect(baseUrlCrm("https://api.exemplo.com/")).toBe("https://api.exemplo.com");
  });
});

describe("consultasRelatorio — contrato por visão (D3)", () => {
  const opcoes = { baseUrl: BASE, filtros, quadroId: QUADRO, leadId: LEAD };

  it("VisaoDono: resumo atual, resumo anterior e conversão", () => {
    const ids = listarConsultasVisao("dono", opcoes).map((c) => c.id);
    expect(ids).toEqual(["resumo-atual", "resumo-mes-anterior", "conversao-funil"]);
    expect(listarConsultasVisao("dono", opcoes).every((c) => c.metodo === "GET")).toBe(
      true,
    );
  });

  it("VisaoDono sem quadroId omite conversão", () => {
    const ids = listarConsultasVisao("dono", {
      ...opcoes,
      quadroId: undefined,
      filtros: { ...filtros, quadroId: undefined },
    }).map((c) => c.id);
    expect(ids).toEqual(["resumo-atual", "resumo-mes-anterior"]);
  });

  it("VisaoCliente: detalhe + PDF", () => {
    const consultas = listarConsultasVisao("cliente", opcoes);
    expect(consultas.map((c) => c.id)).toEqual(["cliente-detalhe", "cliente-pdf"]);
    expect(consultas[0].url).toContain("/relatorios/cliente/");
    expect(consultas[1].url).toMatch(/\/pdf$/);
  });

  it("VisaoCliente sem leadId não dispara fetch", () => {
    expect(listarConsultasVisao("cliente", { ...opcoes, leadId: undefined })).toEqual(
      [],
    );
  });

  it("VisaoFunil: quadro padrão, funil, gargalos e tempo", () => {
    const paths = listarConsultasVisao("funil", opcoes).map((c) =>
      new URL(c.url).pathname,
    );
    expect(paths).toEqual([
      "/quadros/padrao",
      "/relatorios/funil",
      "/relatorios/gargalos",
      "/relatorios/tempo-por-coluna",
    ]);
  });

  it("VisaoFinanceiro: faturamento, tops e ticket", () => {
    const ids = listarConsultasVisao("financeiro", opcoes).map((c) => c.id);
    expect(ids).toEqual([
      "faturamento-mensal",
      "top-clientes",
      "top-produtos",
      "ticket-medio",
    ]);
  });

  it("aba personalizada mantém endpoints do GeradorRelatorios atual", () => {
    const ids = listarConsultasPersonalizado(opcoes).map((c) => c.id);
    expect(ids).toEqual(["resumo", "funil", "faturamento-mensal", "negociacoes"]);
  });
});
