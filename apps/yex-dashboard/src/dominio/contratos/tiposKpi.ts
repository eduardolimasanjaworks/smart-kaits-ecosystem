// Contratos de dados do painel: formato único consumido pela UI e pelas rotas de API.
export type PeriodoRestaurante = "segunda_quinta" | "sexta_domingo";

export type ItemRanking = {
  nome: string;
  valorReais: number;
  unidades: number;
};

export type PontoSerieFaturamento = {
  dia: string;
  valor: number;
};

export type BlocoFaturamentoGlobal = {
  valorAtual: number;
  valorAnoAnterior: number;
  serieDiariaAtual: PontoSerieFaturamento[];
  serieDiariaAnterior: PontoSerieFaturamento[];
};

export type BlocoRestaurante = {
  faturamentoSegundaQuinta: number;
  faturamentoSextaDomingo: number;
  ticketMedioSegundaQuinta: number;
  ticketMedioSextaDomingo: number;
  quantidadeSegundaQuinta: number;
  quantidadeSextaDomingo: number;
};

export type BlocoBoliche = {
  faturamentoPorPista: number;
  ticketMedioPartida: number;
  faturamentoAlimentosBebidas: number;
  /** Razão alimentos ÷ boliche; meta de negócio próxima de 1. */
  proporcaoAlimentosPorRealBoliche: number;
  rankingBebidas: ItemRanking[];
  rankingComidas: ItemRanking[];
};

export type BlocoEventos = {
  faturamento: number;
  quantidadeVendidos: number;
  ticketMedioEvento: number;
  ticketMedioPessoa: number;
  funilApresentacoesFeitas: number;
  funilLeadsMes: number;
  funilLeadsTotais: number;
};

export type BlocoWhatsapp = {
  intencoes: { rotulo: string; peso: number }[];
};

export type KpisConsolidado = {
  faturamentoGlobal: BlocoFaturamentoGlobal;
  restaurante: BlocoRestaurante;
  boliche: BlocoBoliche;
  eventos: BlocoEventos;
  whatsapp: BlocoWhatsapp;
};
