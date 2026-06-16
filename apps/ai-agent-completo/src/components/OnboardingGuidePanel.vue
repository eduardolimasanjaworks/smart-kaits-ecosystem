<script setup>
/**
 * OnboardingGuidePanel.vue — dicas do passo atual (sem vídeo)
 */
import { computed } from 'vue'

const props = defineProps({
  stepId: String,
  config: Object,
})

const stepsData = {
  personality: {
    title: 'Personalidade da I.A.',
    desc: 'Defina o nome, o tom de voz e a primeira mensagem que seus clientes vão receber.',
    tip: 'Pense em como uma pessoa da sua equipe falaria no WhatsApp.',
  },
  team: {
    title: 'Equipe & Contatos',
    desc: 'Cadastre quem recebe avisos e configure a mensagem de transferência de atendimento.',
    tip: 'Use os botões «Configurar mensagem» para ver exemplos com telefone e resumo da conversa.',
  },
  faq: {
    title: 'Dúvidas Frequentes',
    desc: 'Ensine a I.A. o que responder ou quem avisar quando certas perguntas aparecerem.',
    tip: 'Comece pelas 3 dúvidas que mais chegam no seu WhatsApp.',
  },
  docs: {
    title: 'Documentos',
    desc: 'Envie PDFs e materiais para a base de conhecimento da I.A.',
    tip: 'Contratos, tabelas de preço e regulamentos funcionam muito bem aqui.',
  },
}

const currentObj = computed(() => stepsData[props.stepId] || stepsData.personality)
</script>

<template>
  <section class="guide-panel">
    <div class="guide-panel__head">
      <span class="guide-panel__badge">🧭 Tutorial Guiado</span>
      <span class="guide-panel__hint">Passo a passo</span>
    </div>

    <div class="guide-panel__content">
      <div class="guide-header">
        <h2 class="guide-title">{{ currentObj.title }}</h2>
        <p class="guide-desc">{{ currentObj.desc }}</p>
      </div>

      <div class="guide-tip">
        <span class="guide-tip__icon">💡</span>
        <p>{{ currentObj.tip }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.guide-panel {
  display: flex;
  flex-direction: column;
  background: #fff;
  border-left: 1.5px solid var(--c-border);
  height: 100%;
}
.guide-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.8rem 1.25rem;
  border-bottom: 1px solid var(--c-border);
  background: #fafafa;
}
.guide-panel__badge {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--c-primary);
}
.guide-panel__hint {
  font-size: 0.72rem;
  color: var(--c-text-light);
}

.guide-panel__content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem;
  flex: 1;
  overflow: auto;
}

.guide-header { margin-bottom: 0.25rem; }
.guide-title {
  font-size: 1.1rem;
  color: var(--c-text);
  font-weight: 700;
  margin: 0 0 0.35rem;
}
.guide-desc {
  font-size: 0.85rem;
  color: var(--c-text-muted);
  line-height: 1.5;
  margin: 0;
}

.guide-tip {
  display: flex;
  gap: 0.65rem;
  align-items: flex-start;
  background: var(--c-primary-dim);
  border-radius: var(--r-md);
  padding: 0.85rem 1rem;
  font-size: 0.82rem;
  color: var(--c-text-muted);
  line-height: 1.5;
}
.guide-tip__icon { font-size: 1.1rem; flex-shrink: 0; }
.guide-tip p { margin: 0; }
</style>
