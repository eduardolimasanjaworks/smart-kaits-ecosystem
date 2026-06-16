/** Rótulos das sub-partes do tutorial (1 clique em «Próximo» = 1 parte). */
export const ONBOARDING_MICRO_LABELS = {
  company: ['Contexto do negócio'],
  personality: ['Nome da assistente', 'Tom de voz', 'Primeira mensagem'],
  team: ['Pessoas da equipe', 'Transferência para humano'],
  faq: ['Dúvidas frequentes'],
  docs: ['Documentos de apoio'],
}

export function microLabelsForSection(sectionId) {
  return ONBOARDING_MICRO_LABELS[sectionId] || ['Preencher']
}
