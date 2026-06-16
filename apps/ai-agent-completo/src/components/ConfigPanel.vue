<script setup>
/**
 * ConfigPanel.vue v9
 * Tutorial: todos os blocos visíveis; blur nos inativos; sub-passos dentro de cada card.
 */
import { watch, nextTick, computed } from 'vue'
import AccordionCard    from './AccordionCard.vue'
import PersonalityCard  from './cards/PersonalityCard.vue'
import TeamCard         from './cards/TeamCard.vue'
import FaqCard          from './cards/FaqCard.vue'
import DocsCard         from './cards/DocsCard.vue'
import ToolsCard        from './cards/ToolsCard.vue'

const props = defineProps({
  config: Object,
  activeSection: String,
  onboardingMode: Boolean,
  onboardingStepTitle: { type: String, default: '' },
  onboardingStepDesc: { type: String, default: '' },
  onboardingMicroStep: { type: Number, default: 0 },
  onboardingMicroTotal: { type: Number, default: 1 },
  onboardingMicroLabels: { type: Array, default: () => [] },
  onboardingMicroTitle: { type: String, default: '' },
  onboardingMacroLabel: { type: String, default: '' },
  completionStatus: Object,
  completionHints: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['section-focus', 'local-edit', 'open-editor'])

function notifyLocalEdit() {
  emit('local-edit')
}

function handleFocus(section) {
  emit('section-focus', section)
}

/** No tutorial: só o passo atual fica visível; os outros ficam ocultos (sem blur em cima do foco). */
function isStepVisible(section) {
  if (!props.onboardingMode) return true
  return props.activeSection === section
}

function isCompanyStepVisible() {
  if (!props.onboardingMode) return true
  return props.activeSection === 'company'
}

function cardTutorialClass(section) {
  if (!props.onboardingMode) return {}
  const focused = props.activeSection === section
  return {
    'onboarding-tut-focus': focused,
    'onboarding-tut-dim': !focused,
  }
}

function getEmoji(section) {
  return props.completionStatus?.[section] ? '😊' : '⭕'
}

function statusTitle(section) {
  const labels = {
    personality: 'Personalidade',
    team: 'Equipe & Contatos',
    faq: 'Dúvidas frequentes',
    docs: 'Documentos base',
    tools: 'Integrações',
    company: 'Sobre a empresa',
  }
  const name = labels[section] || section
  if (props.completionStatus?.[section]) {
    return `${name}: completo (😊) — conta no % do header`
  }
  return props.completionHints?.[section] || `${name}: preencha para subir o potencial`
}

const microProgressLabel = computed(() => {
  if (!props.onboardingMode || props.onboardingMicroTotal <= 1) return ''
  return `Parte ${props.onboardingMicroStep + 1} de ${props.onboardingMicroTotal}`
})

const showMicroStepper = computed(
  () => props.onboardingMode && props.onboardingMicroTotal > 1 && props.onboardingMicroLabels.length > 1
)

watch(
  () => [props.activeSection, props.onboardingMicroStep],
  async () => {
    if (!props.activeSection) return
    await nextTick()
    const el = document.getElementById('card-' + props.activeSection)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
)
</script>

<template>
  <aside
    class="config-panel"
    :class="{ 'config-panel--onboarding': onboardingMode }"
    @focusin="notifyLocalEdit"
    @input="notifyLocalEdit"
  >
    <div
      v-if="onboardingMode && onboardingStepTitle"
      class="onboarding-step-banner onboarding-tut-focus onboarding-step-banner--current"
    >
      <div class="onboarding-step-banner__row">
        <span class="onboarding-step-banner__badge">{{ onboardingMacroLabel || 'Passo atual' }}</span>
        <span v-if="microProgressLabel" class="onboarding-step-banner__micro">{{ microProgressLabel }}</span>
      </div>
      <h2 class="onboarding-step-banner__title">{{ onboardingStepTitle }}</h2>
      <p v-if="onboardingStepDesc" class="onboarding-step-banner__desc">{{ onboardingStepDesc }}</p>

      <div v-if="showMicroStepper" class="onboarding-micro-stepper">
        <div
          class="onboarding-micro-stepper__bar"
          role="progressbar"
          :aria-valuenow="onboardingMicroStep + 1"
          :aria-valuemin="1"
          :aria-valuemax="onboardingMicroTotal"
        >
          <div
            class="onboarding-micro-stepper__fill"
            :style="{ width: `${((onboardingMicroStep + 1) / onboardingMicroTotal) * 100}%` }"
          />
        </div>
        <ol class="onboarding-micro-stepper__list">
          <li
            v-for="(label, i) in onboardingMicroLabels"
            :key="i"
            class="onboarding-micro-stepper__item"
            :class="{
              'onboarding-micro-stepper__item--done': i < onboardingMicroStep,
              'onboarding-micro-stepper__item--active': i === onboardingMicroStep,
            }"
          >
            <span class="onboarding-micro-stepper__num">{{ i + 1 }}</span>
            <span class="onboarding-micro-stepper__label">{{ label }}</span>
          </li>
        </ol>
      </div>

      <p v-if="onboardingMicroTitle && showMicroStepper" class="onboarding-step-banner__now">
        Agora você está em: <strong>{{ onboardingMicroTitle }}</strong>
      </p>

      <p class="onboarding-step-banner__hint">
        <template v-if="showMicroStepper">
          São <strong>{{ onboardingMicroTotal }} partes</strong> nesta etapa. Cada toque em
          <strong>«Próxima parte»</strong> no rodapé avança uma delas ({{ onboardingMicroStep + 1 }}/{{ onboardingMicroTotal }} agora).
        </template>
        <template v-else>
          Quando terminar, use <strong>Próximo passo</strong> no rodapé para a próxima etapa do guia.
        </template>
      </p>
    </div>

    <div v-if="!onboardingMode" class="config-panel__head">
      <p class="config-panel__subtitle">
        Preencha livremente. Veja o progresso e o preview atualizando.
      </p>
    </div>

    <div
      v-show="isCompanyStepVisible()"
      id="card-company"
      class="company-context-block dimmable"
      :class="cardTutorialClass('company')"
    >
      <div class="company-context-block__header">
        <span class="company-context-block__icon">🏢</span>
        <div>
          <span class="company-context-block__title">Sobre a empresa</span>
          <span
            class="company-context-block__status"
            :class="{ done: completionStatus?.company }"
            :title="statusTitle('company')"
          >
            {{
              onboardingMode
                ? completionStatus?.company
                  ? '😊 Perfeito, pode seguir'
                  : 'Uma frase já ajuda'
                : completionStatus?.company
                  ? '😊 Conta no % do potencial'
                  : '⭕ Falta para o % — mín. 20 caracteres'
            }}
          </span>
        </div>
      </div>
      <textarea
        v-model="config.companyContext"
        class="company-context-block__textarea"
        rows="3"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        :placeholder="
          onboardingMode
            ? 'Ex.: escola infantil em São Paulo, atendemos crianças de 2 a 10 anos…'
            : 'Ex: Escola de educação infantil em São Paulo, atendemos crianças de 2 a 10 anos, somos referência em bilíngue no bairro Jardins desde 2010...'
        "
        @focus="handleFocus('company')"
      />
    </div>

    <div class="config-panel__cards">
      <div
        v-show="isStepVisible('personality')"
        id="card-personality"
        class="dimmable"
        :class="cardTutorialClass('personality')"
      >
        <AccordionCard
          title="Personalidade"
          icon="👤"
          accent-color="var(--c-personality)"
          :status-emoji="getEmoji('personality')"
          :status-title="statusTitle('personality')"
        >
          <PersonalityCard
            :config="config"
            :onboarding-mode="onboardingMode"
            :onboarding-micro-step="onboardingMicroStep"
          />
        </AccordionCard>
      </div>

      <div
        v-show="isStepVisible('team')"
        id="card-team"
        class="dimmable"
        :class="cardTutorialClass('team')"
      >
        <AccordionCard
          title="Equipe & Contatos"
          icon="👥"
          accent-color="var(--c-team)"
          :status-emoji="getEmoji('team')"
          :status-title="statusTitle('team')"
        >
          <TeamCard
            :config="config"
            :onboarding-mode="onboardingMode"
            :onboarding-micro-step="onboardingMicroStep"
          />
        </AccordionCard>
      </div>

      <div
        v-show="isStepVisible('faq')"
        id="card-faq"
        class="dimmable"
        :class="cardTutorialClass('faq')"
      >
        <AccordionCard
          title="Dúvidas frequentes"
          icon="❓"
          accent-color="var(--c-faq)"
          :status-emoji="getEmoji('faq')"
          :status-title="statusTitle('faq')"
        >
          <FaqCard :config="config" :onboarding-mode="onboardingMode" />
        </AccordionCard>
      </div>

      <div
        v-show="isStepVisible('docs')"
        id="card-docs"
        class="dimmable"
        :class="cardTutorialClass('docs')"
      >
        <AccordionCard
          title="Documentos Base"
          icon="📄"
          accent-color="#14b8a6"
          :status-emoji="getEmoji('docs')"
          :status-title="statusTitle('docs')"
        >
          <DocsCard :config="config" @open-editor="$emit('open-editor', $event)" />
        </AccordionCard>
      </div>

      <div
        v-show="isStepVisible('tools')"
        id="card-tools"
        class="dimmable"
        :class="cardTutorialClass('tools')"
      >
        <AccordionCard
          title="Integrações (API)"
          icon="⚡"
          accent-color="#f59e0b"
          :status-emoji="getEmoji('tools')"
          :status-title="statusTitle('tools')"
        >
          <ToolsCard :config="config" />
        </AccordionCard>
      </div>
    </div>

  </aside>
</template>

<style scoped>
.config-panel {
  display: flex;
  flex-direction: column;
  background: var(--c-bg);
  border-right: 1.5px solid var(--c-border);
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  scroll-behavior: smooth;
}

.config-panel--onboarding {
  position: relative;
  z-index: 160;
  max-width: 100%;
  background: var(--c-bg);
  padding-bottom: 0.5rem;
}

/* Tutorial: tudo desfocado exceto .onboarding-tut-focus */
.config-panel--onboarding .onboarding-tut-dim {
  filter: blur(16px) grayscale(0.25);
  opacity: 0.28;
  pointer-events: none;
  user-select: none;
  transform: scale(0.98);
  transition:
    filter 0.35s ease,
    opacity 0.35s ease,
    transform 0.35s ease;
}

.config-panel--onboarding .onboarding-tut-focus {
  filter: none !important;
  opacity: 1 !important;
  pointer-events: auto;
  transform: none !important;
  position: relative;
  z-index: 25;
  isolation: isolate;
  background: #fff;
  border-radius: 16px;
  box-shadow:
    0 0 0 3px rgba(79, 70, 229, 0.45),
    0 24px 64px rgba(15, 23, 42, 0.28);
  animation: tutFocusPulse 2.2s ease-in-out infinite;
}

.onboarding-step-banner--current {
  margin-bottom: 0.5rem;
}

@keyframes tutFocusPulse {
  0%,
  100% {
    box-shadow:
      0 0 0 3px rgba(79, 70, 229, 0.4),
      0 20px 56px rgba(79, 70, 229, 0.2);
  }
  50% {
    box-shadow:
      0 0 0 4px rgba(79, 70, 229, 0.55),
      0 28px 72px rgba(79, 70, 229, 0.28);
  }
}

.onboarding-step-banner {
  margin: 0.75rem 1.25rem 0;
  padding: 0.85rem 1rem;
  background: linear-gradient(135deg, #eef2ff 0%, #fafbff 100%);
  border: 1.5px solid #c7d2fe;
  border-radius: 14px;
  box-shadow: 0 8px 24px rgba(79, 70, 229, 0.12);
  position: relative;
  z-index: 2;
}
.onboarding-step-banner__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
}
.onboarding-step-banner__badge {
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--c-primary);
}
.onboarding-step-banner__micro {
  font-size: 0.68rem;
  font-weight: 700;
  color: #475569;
  background: #fff;
  border: 1px solid #e2e8f0;
  padding: 0.15rem 0.45rem;
  border-radius: 6px;
}
.onboarding-step-banner__title {
  font-size: 1.05rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 0.3rem;
  line-height: 1.3;
}
.onboarding-step-banner__desc {
  font-size: 0.82rem;
  color: var(--c-text-muted);
  margin: 0 0 0.35rem;
  line-height: 1.45;
}
.onboarding-step-banner__hint {
  font-size: 0.72rem;
  color: #64748b;
  margin: 0;
  font-weight: 600;
  line-height: 1.45;
}
.onboarding-step-banner__now {
  font-size: 0.8rem;
  color: #3730a3;
  margin: 0.5rem 0 0.35rem;
  padding: 0.45rem 0.6rem;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #c7d2fe;
}
.onboarding-step-banner__now strong {
  color: #312e81;
}

.onboarding-micro-stepper {
  margin-top: 0.65rem;
}
.onboarding-micro-stepper__bar {
  height: 6px;
  background: #e2e8f0;
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 0.55rem;
}
.onboarding-micro-stepper__fill {
  height: 100%;
  background: linear-gradient(90deg, var(--c-primary), #818cf8);
  border-radius: 999px;
  transition: width 0.35s ease;
}
.onboarding-micro-stepper__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.onboarding-micro-stepper__item {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.72rem;
  color: #94a3b8;
  font-weight: 600;
}
.onboarding-micro-stepper__item--active {
  color: #312e81;
}
.onboarding-micro-stepper__item--active .onboarding-micro-stepper__num {
  background: var(--c-primary);
  color: #fff;
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.25);
}
.onboarding-micro-stepper__item--done {
  color: #16a34a;
}
.onboarding-micro-stepper__item--done .onboarding-micro-stepper__num {
  background: #dcfce7;
  color: #15803d;
}
.onboarding-micro-stepper__num {
  flex-shrink: 0;
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  font-weight: 800;
  background: #f1f5f9;
  color: #64748b;
}
.onboarding-micro-stepper__label {
  line-height: 1.3;
}

.config-panel__head {
  padding: 0.85rem 1.25rem 0.7rem;
  border-bottom: 1px solid var(--c-border);
  background: white;
  flex-shrink: 0;
}
.config-panel__subtitle {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--c-primary);
}
.config-panel__cards {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem clamp(0.75rem, 2vw, 1.75rem) 5rem;
  position: relative;
  z-index: 2;
}

.company-context-block {
  margin: 0.75rem 1.25rem 0;
  background: linear-gradient(135deg, #f0f4ff 0%, #fafbff 100%);
  border: 1.5px solid #c7d2fe;
  border-radius: 14px;
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  flex-shrink: 0;
}
.company-context-block__header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.company-context-block__icon {
  font-size: 1.2rem;
  line-height: 1;
}
.company-context-block__title {
  display: block;
  font-size: 0.82rem;
  font-weight: 700;
  color: #3730a3;
  line-height: 1.2;
}
.company-context-block__status {
  display: block;
  font-size: 0.68rem;
  color: #7c88a8;
  margin-top: 1px;
}
.company-context-block__status.done {
  color: #16a34a;
  font-weight: 600;
}
.company-context-block__textarea {
  font-family: inherit;
  font-size: 0.82rem;
  width: 100%;
  box-sizing: border-box;
  border-radius: 10px;
  border: 1px solid #c7d2fe;
  padding: 0.55rem 0.75rem;
  resize: vertical;
  min-height: 3.5rem;
  background: white;
  color: var(--c-text);
  line-height: 1.5;
}
.company-context-block__textarea:focus {
  outline: none;
  border-color: var(--c-primary);
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}
</style>
