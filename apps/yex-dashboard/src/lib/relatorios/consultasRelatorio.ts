import type { FiltroRelatorio } from "@/modulos/relatorios/tiposFiltroRelatorio";
import { montarQueryFiltros } from "@/modulos/relatorios/montarQueryFiltros";

/** Visões pré-montadas do Gerador de Relatórios (agente D3). */
export type VisaoRelatorioPreMontada = "dono" | "cliente" | "funil" | "financeiro";

export type ConsultaRelatorio = {
  id: string;
  metodo: "GET";
  url: string;
};

export type OpcoesConsultaRelatorio = {
  baseUrl?: string;
  filtros: FiltroRelatorio;
  quadroId?: string;
  leadId?: string;
  cursor?: string;
  limite?: number;
};

const BASE_PADRAO = "http://127.0.0.1:4001";

export function baseUrlCrm(baseUrl?: string): string {
  const bruto =
    baseUrl ??
    process.env.NEXT_PUBLIC_CRM_API_URL?.replace(/\/$/, "") ??
    BASE_PADRAO;
  return bruto.replace(/\/$/, "");
}

function pathComQuery(
  base: string,
  caminho: string,
  query?: string,
  extras?: Record<string, string | number | undefined>,
): string {
  const params = new URLSearchParams(query?.replace(/^\?/, "") ?? "");
  if (extras) {
    for (const [chave, valor] of Object.entries(extras)) {
      if (valor !== undefined && valor !== "") params.set(chave, String(valor));
    }
  }
  const qs = params.toString();
  return `${base}${caminho}${qs ? `?${qs}` : ""}`;
}

/** Período do mês civil imediatamente anterior ao intervalo informado. */
export function periodoMesAnterior(
  filtros: Pick<FiltroRelatorio, "inicio" | "fim">,
): Pick<FiltroRelatorio, "inicio" | "fim"> {
  const [y, m] = filtros.inicio.split("-").map(Number);
  const mesRef = new Date(y, m - 1, 1);
  mesRef.setMonth(mesRef.getMonth() - 1);
  const yAnt = mesRef.getFullYear();
  const mAnt = mesRef.getMonth();
  const inicio = `${yAnt}-${String(mAnt + 1).padStart(2, "0")}-01`;
  const ultimo = new Date(yAnt, mAnt + 1, 0).getDate();
  const fim = `${yAnt}-${String(mAnt + 1).padStart(2, "0")}-${String(ultimo).padStart(2, "0")}`;
  return { inicio, fim };
}

export function urlQuadroPadrao(baseUrl?: string): string {
  return `${baseUrlCrm(baseUrl)}/quadros/padrao`;
}

export function urlResumo(filtros: FiltroRelatorio, baseUrl?: string): string {
  return `${baseUrlCrm(baseUrl)}/relatorios/resumo${montarQueryFiltros(filtros)}`;
}

export function urlResumoComparativoMes(
  filtros: FiltroRelatorio,
  baseUrl?: string,
): { atual: string; anterior: string } {
  const anterior = periodoMesAnterior(filtros);
  return {
    atual: urlResumo(filtros, baseUrl),
    anterior: urlResumo({ ...filtros, ...anterior }, baseUrl),
  };
}

export function urlClienteDetalhe(
  leadId: string,
  filtros: FiltroRelatorio,
  baseUrl?: string,
): string {
  return `${baseUrlCrm(baseUrl)}/relatorios/cliente/${leadId}${montarQueryFiltros(filtros)}`;
}

export function urlClientePdf(leadId: string, baseUrl?: string): string {
  return `${baseUrlCrm(baseUrl)}/relatorios/cliente/${leadId}/pdf`;
}

export function urlFunil(
  filtros: FiltroRelatorio,
  quadroId?: string,
  baseUrl?: string,
): string {
  const qid = quadroId ?? filtros.quadroId;
  const qs = montarQueryFiltros({ ...filtros, quadroId: qid });
  const base = baseUrlCrm(baseUrl);
  if (!qid) return `${base}/relatorios/funil${qs}`;
  if (qs.includes("quadroId=")) return `${base}/relatorios/funil${qs}`;
  const sep = qs ? "&" : "?";
  return `${base}/relatorios/funil${qs}${sep}quadroId=${qid}`;
}

export function urlGargalos(filtros: FiltroRelatorio, baseUrl?: string): string {
  return `${baseUrlCrm(baseUrl)}/relatorios/gargalos${montarQueryFiltros(filtros)}`;
}

export function urlTempoPorColuna(filtros: FiltroRelatorio, baseUrl?: string): string {
  return `${baseUrlCrm(baseUrl)}/relatorios/tempo-por-coluna${montarQueryFiltros(filtros)}`;
}

export function urlConversaoFunil(quadroId: string, baseUrl?: string): string {
  return pathComQuery(baseUrlCrm(baseUrl), "/relatorios/conversao-funil", "", {
    quadroId,
  });
}

export function urlFaturamentoMensal(filtros: FiltroRelatorio, baseUrl?: string): string {
  return `${baseUrlCrm(baseUrl)}/relatorios/faturamento-mensal${montarQueryFiltros(filtros)}`;
}

export function urlTopClientes(filtros: FiltroRelatorio, baseUrl?: string): string {
  return `${baseUrlCrm(baseUrl)}/relatorios/top-clientes${montarQueryFiltros(filtros)}`;
}

export function urlTopProdutos(filtros: FiltroRelatorio, baseUrl?: string): string {
  return `${baseUrlCrm(baseUrl)}/relatorios/top-produtos${montarQueryFiltros(filtros)}`;
}

export function urlTicketMedio(filtros: FiltroRelatorio, baseUrl?: string): string {
  return `${baseUrlCrm(baseUrl)}/relatorios/ticket-medio${montarQueryFiltros(filtros)}`;
}

export function urlNegociacoes(
  filtros: FiltroRelatorio,
  limite = 25,
  cursor?: string,
  baseUrl?: string,
): string {
  const qs = montarQueryFiltros(filtros);
  const sep = qs ? "&" : "?";
  const pag = new URLSearchParams({ limite: String(limite) });
  if (cursor) pag.set("cursor", cursor);
  return `${baseUrlCrm(baseUrl)}/relatorios/negociacoes${qs}${sep}${pag.toString()}`;
}

export function urlPdfRelatorio(filtros: FiltroRelatorio, baseUrl?: string): string {
  return `${baseUrlCrm(baseUrl)}/relatorios/pdf${montarQueryFiltros(filtros)}`;
}

/** Lista de GETs que cada visão pré-montada deve disparar (contrato D3 / crm-api). */
export function listarConsultasVisao(
  visao: VisaoRelatorioPreMontada,
  opcoes: OpcoesConsultaRelatorio,
): ConsultaRelatorio[] {
  const { filtros, baseUrl, quadroId, leadId } = opcoes;
  const qid = quadroId ?? filtros.quadroId;

  switch (visao) {
    case "dono": {
      const { atual, anterior } = urlResumoComparativoMes(filtros, baseUrl);
      const consultas: ConsultaRelatorio[] = [
        { id: "resumo-atual", metodo: "GET", url: atual },
        { id: "resumo-mes-anterior", metodo: "GET", url: anterior },
      ];
      if (qid) {
        consultas.push({
          id: "conversao-funil",
          metodo: "GET",
          url: urlConversaoFunil(qid, baseUrl),
        });
      }
      return consultas;
    }
    case "cliente": {
      if (!leadId) return [];
      return [
        {
          id: "cliente-detalhe",
          metodo: "GET",
          url: urlClienteDetalhe(leadId, filtros, baseUrl),
        },
        {
          id: "cliente-pdf",
          metodo: "GET",
          url: urlClientePdf(leadId, baseUrl),
        },
      ];
    }
    case "funil":
      return [
        { id: "quadro-padrao", metodo: "GET", url: urlQuadroPadrao(baseUrl) },
        { id: "funil", metodo: "GET", url: urlFunil(filtros, qid, baseUrl) },
        { id: "gargalos", metodo: "GET", url: urlGargalos(filtros, baseUrl) },
        {
          id: "tempo-por-coluna",
          metodo: "GET",
          url: urlTempoPorColuna(filtros, baseUrl),
        },
      ];
    case "financeiro":
      return [
        {
          id: "faturamento-mensal",
          metodo: "GET",
          url: urlFaturamentoMensal(filtros, baseUrl),
        },
        { id: "top-clientes", metodo: "GET", url: urlTopClientes(filtros, baseUrl) },
        { id: "top-produtos", metodo: "GET", url: urlTopProdutos(filtros, baseUrl) },
        { id: "ticket-medio", metodo: "GET", url: urlTicketMedio(filtros, baseUrl) },
      ];
    default:
      return [];
  }
}

/** Aba personalizada: filtros compartilhados + componentes atuais do GeradorRelatorios. */
export function listarConsultasPersonalizado(
  opcoes: OpcoesConsultaRelatorio,
): ConsultaRelatorio[] {
  const { filtros, baseUrl, quadroId, cursor, limite } = opcoes;
  return [
    { id: "resumo", metodo: "GET", url: urlResumo(filtros, baseUrl) },
    { id: "funil", metodo: "GET", url: urlFunil(filtros, quadroId, baseUrl) },
    {
      id: "faturamento-mensal",
      metodo: "GET",
      url: urlFaturamentoMensal(filtros, baseUrl),
    },
    {
      id: "negociacoes",
      metodo: "GET",
      url: urlNegociacoes(filtros, limite ?? 25, cursor, baseUrl),
    },
  ];
}
