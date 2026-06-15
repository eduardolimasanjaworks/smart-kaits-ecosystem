// Slides do modo TV: ordem fixa para carrossel executivo (navegação por setas e pausa).
export type VisaoTvId = "executiva" | "comercial" | "marketing" | "fluxo_caixa";

export type DefinicaoVisaoTv = {
  id: VisaoTvId;
  titulo: string;
  subtitulo: string;
};

export const LISTA_VISOES_TV: DefinicaoVisaoTv[] = [
  { id: "executiva", titulo: "Visão Executiva", subtitulo: "Principais Indicadores do Grupo FN" },
  { id: "comercial", titulo: "Comercial & Vendas", subtitulo: "Funil, conversão e ticket" },
  { id: "marketing", titulo: "Marketing & ROI", subtitulo: "Campanhas e retorno" },
  { id: "fluxo_caixa", titulo: "Fluxo de Caixa", subtitulo: "Entradas, saídas e saldo" },
];

export const INDICE_VISAO_INICIAL_TV = 0;
export const INTERVALO_ROTACAO_TV_MS = 12_000;
