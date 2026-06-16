<script setup>
/**
 * cards/PersonalityCard.vue v2
 * Adicionado campo "Nome da assistente" no topo
 */
const MICRO_PARTS = ['Nome da assistente', 'Tom de voz', 'Primeira mensagem']

const props = defineProps({
  config: Object,
  onboardingMode: { type: Boolean, default: false },
  onboardingMicroStep: { type: Number, default: 0 },
})

const placeholder = `Ex: Gentil e objetiva, usa emojis com moderação 😊\nResponde no mesmo idioma que o cliente usar.\nMensagens curtas, máximo 3 linhas.`
</script>

<template>
  <div class="personality">
    <p v-if="onboardingMode" class="personality-part-chip">
      Parte {{ onboardingMicroStep + 1 }} de 3 · {{ MICRO_PARTS[onboardingMicroStep] }}
    </p>

    <div v-show="!onboardingMode || onboardingMicroStep === 0" class="personality-step">
    <!-- Nome da assistente -->
    <div class="name-row">
      <div class="name-row__field">
        <label class="label" for="asst-name">Nome da assistente</label>
        <input id="asst-name" v-model="config.assistantName"
               placeholder="Ex: Sofia, Ana, Julia..." />
      </div>
      <div class="name-row__preview" v-if="config.assistantName">
        {{ config.assistantName[0]?.toUpperCase() }}
      </div>
    </div>
    <div class="tip-reassure">Fique tranquilo(a), você pode alterar o nome da inteligência depois.</div>
    </div>

    <div v-show="!onboardingMode || onboardingMicroStep === 1" class="personality-step">
    <div class="tip">
      <span>💡</span>
      <p>Descreva <strong>como</strong> ela deve se comunicar: tom, emojis, idioma, formalidade.</p>
    </div>

    <div>
      <label class="label" for="personality-input">Estilo de comunicação</label>
      <textarea
        id="personality-input"
        v-model="config.personality"
        :placeholder="placeholder"
        rows="4"
        class="personality-textarea"
      />
    </div>
    </div>

    <div v-show="!onboardingMode || onboardingMicroStep === 2" class="personality-step">
    <div>
      <label class="label" for="greeting-input">👋 Primeira mensagem enviada pela I.A.</label>
      <input
        id="greeting-input"
        v-model="config.greeting"
        placeholder="Ex: Olá! Seja bem-vindo 😊 Como posso te ajudar?"
      />
      <p class="field-hint">Esta é a mensagem que a I.A. envia automaticamente ao primeiro contato.</p>
    </div>
    </div>

  </div>
</template>

<style scoped>
.personality { display: flex; flex-direction: column; gap: .7rem; }
.personality-part-chip {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--c-primary);
  background: var(--c-primary-dim);
  border-radius: 8px;
  padding: 0.4rem 0.6rem;
  margin: 0 0 0.15rem;
}
.personality-step { display: flex; flex-direction: column; gap: .7rem; }

.name-row { display: flex; align-items: flex-end; gap: .65rem; }
.name-row__field { flex: 1; }
.name-row__preview {
  width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0;
  background: var(--c-primary); color: white;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.15rem; font-weight: 700; margin-bottom: 1px;
}
.tip-reassure { font-size: 0.72rem; color: var(--c-primary); margin-top: -6px; opacity: 0.8; font-weight: 500;}

.tip {
  display: flex; gap: .55rem; align-items: flex-start;
  background: var(--c-primary-dim); border-radius: var(--r-sm);
  padding: .55rem .75rem; font-size: .8rem; color: var(--c-text-muted); line-height: 1.5;
}
.tip strong { color: var(--c-primary); }

.personality-textarea {
  width: 100%;
  font-family: inherit;
  font-size: .875rem;
  line-height: 1.5;
  padding: .6rem;
  border: 1.5px solid var(--c-border);
  border-radius: var(--r-sm);
  resize: vertical;
}
.personality-textarea:focus { border-color: var(--c-primary); outline: none; }
.field-hint { font-size: 0.7rem; color: var(--c-text-light); margin-top: 0.25rem; }
</style>
