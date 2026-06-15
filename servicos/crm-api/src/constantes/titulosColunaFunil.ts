// Títulos de colunas do funil comercial (seed e regras de evento).
export const TITULO_COLUNA_ORCAMENTO_ENVIADO = 'Orçamento enviado';

/** Indica se o título da coluna corresponde à etapa de orçamento enviado. */
export function tituloColunaEhOrcamentoEnviado(titulo: string): boolean {
  return titulo.trim().toLowerCase() === TITULO_COLUNA_ORCAMENTO_ENVIADO.toLowerCase();
}
