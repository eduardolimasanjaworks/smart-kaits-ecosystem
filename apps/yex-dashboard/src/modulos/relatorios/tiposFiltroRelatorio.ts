export type ResultadoNegociacao = "ABERTA" | "GANHA" | "PERDIDA" | "ARQUIVADA";

export type FiltroRelatorio = {
  inicio: string;
  fim: string;
  tipoData?: "criado" | "atualizado";
  leadId?: string;
  resultados?: ResultadoNegociacao[];
  quadroId?: string;
};

export function periodoMesAtual(): Pick<FiltroRelatorio, "inicio" | "fim"> {
  const agora = new Date();
  const y = agora.getFullYear();
  const m = agora.getMonth();
  const inicio = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const ultimo = new Date(y, m + 1, 0).getDate();
  const fim = `${y}-${String(m + 1).padStart(2, "0")}-${String(ultimo).padStart(2, "0")}`;
  return { inicio, fim };
}

export function filtrosPadrao(): FiltroRelatorio {
  return { ...periodoMesAtual(), tipoData: "criado" };
}
