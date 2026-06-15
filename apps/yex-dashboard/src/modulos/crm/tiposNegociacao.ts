export type NegociacaoKanban = {
  id: string;
  titulo: string;
  descricao: string | null;
  colunaId: string;
  valorEstimadoBrlCentavos: number;
  valorFechadoBrlCentavos?: number;
  resultado: string;
  leadNome: string;
};

export type ColunaKanban = {
  id: string;
  titulo: string;
  ordemPosicao: number;
  negociacoes: NegociacaoKanban[];
};

export type LinhaProduto = {
  produtoId: string;
  quantidade: number;
  precoUnitarioBrlCentavos: number;
};

export type ProdutoDetalhe = LinhaProduto & {
  id: string;
  produtoNome: string;
  codigoSku: string | null;
};

export type DetalheNegociacao = {
  negociacao: {
    id: string;
    titulo: string;
    descricao: string | null;
    colunaId: string;
    valorEstimadoBrlCentavos: number;
    valorFechadoBrlCentavos: number;
    resultado: string;
    mesPrevistoEvento: string | null;
    dataHoraPrevistoEvento: string | null;
    motivoPerda: string | null;
  };
  lead: { id: string; nomeContato: string; emailContato: string | null; telefoneContato: string | null } | null;
  produtos: ProdutoDetalhe[];
  ultimosEventos: { id: string; tipo: string; criadoEm: string }[];
  tempoPorColunaResumo: { colunaId: string; titulo: string; diasNaColuna: number }[];
};

export type ProdutoCatalogo = {
  id: string;
  nome: string;
  codigoSku: string | null;
  precoReferenciaBrlCentavos: number;
};
