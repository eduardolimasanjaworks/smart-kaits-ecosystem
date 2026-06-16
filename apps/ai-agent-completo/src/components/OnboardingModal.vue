<script setup>
/**
 * Boas-vindas do tutorial — uma ideia por tela, tom leve e progressivo.
 */
import { ref, onMounted } from 'vue'

const emit = defineEmits(['start'])

const isAnalyzing = ref(true)
const dots = ref('.')
const welcomeStep = ref(0)

const slides = [
  {
    kicker: 'Smart Kaits',
    title: 'Sua inteligência artificial',
    body: '',
    cta: 'Continuar',
  },
  {
    kicker: '',
    title: 'Olá! Sou seu novo vendedor, atendente, consultor… o que você quiser!',
    body: '',
    cta: 'Continuar',
  },
  {
    kicker: '',
    title: 'Em poucos passos',
    body:
      'Vou te mostrar como me configurar para falar com seus contatos — alunos, colaboradores, pais de aluno, quem você quiser.',
    cta: 'Vamos começar',
  },
]

const current = () => slides[welcomeStep.value]

function advance() {
  if (welcomeStep.value < slides.length - 1) {
    welcomeStep.value += 1
    return
  }
  emit('start')
}

onMounted(() => {
  const interval = setInterval(() => {
    dots.value = dots.value.length < 3 ? dots.value + '.' : '.'
  }, 400)
  setTimeout(() => {
    clearInterval(interval)
    isAnalyzing.value = false
  }, 1400)
})
</script>

<template>
  <div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-slide-title">
    <div v-if="isAnalyzing" class="modal-card modal-card--loading">
      <div class="spinner" />
      <h2>Preparando ambiente{{ dots }}</h2>
    </div>

    <div v-else class="modal-card modal-card--welcome">
      <div class="welcome-dots" aria-hidden="true">
        <span
          v-for="(_, i) in slides"
          :key="i"
          class="welcome-dot"
          :class="{ 'welcome-dot--on': i === welcomeStep, 'welcome-dot--done': i < welcomeStep }"
        />
      </div>

      <p v-if="current().kicker" class="welcome-kicker">{{ current().kicker }}</p>
      <h2 id="welcome-slide-title" class="welcome-title">{{ current().title }}</h2>
      <p v-if="current().body" class="welcome-text">{{ current().body }}</p>

      <button type="button" class="btn action-btn-start" @click="advance">
        {{ current().cta }}
        <span v-if="welcomeStep < slides.length - 1" aria-hidden="true"> →</span>
        <span v-else aria-hidden="true"> 🚀</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(15, 15, 20, 0.85);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.modal-card {
  background: var(--c-surface);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-lg);
  animation: popIn var(--t-med) cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes popIn {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-card--loading {
  width: 90%;
  max-width: 400px;
  padding: 4rem 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  text-align: center;
}
.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--c-border);
  border-top-color: var(--c-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.modal-card--welcome {
  width: 90%;
  max-width: 420px;
  min-height: 220px;
  padding: 2rem 2rem 1.75rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.85rem;
  text-align: left;
}

.welcome-dots {
  display: flex;
  gap: 0.4rem;
  margin-bottom: 0.25rem;
}
.welcome-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #e2e8f0;
  transition: background 0.2s, transform 0.2s;
}
.welcome-dot--on {
  background: var(--c-primary);
  transform: scale(1.15);
}
.welcome-dot--done {
  background: #a5b4fc;
}

.welcome-kicker {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--c-primary);
}

.welcome-title {
  font-size: clamp(1.15rem, 4vw, 1.35rem);
  color: #111;
  font-weight: 800;
  line-height: 1.4;
  margin: 0;
}

.welcome-text {
  color: var(--c-text-muted);
  line-height: 1.65;
  font-size: 1rem;
  margin: 0;
}

.action-btn-start {
  margin-top: auto;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0.95rem 1rem;
  font-size: 1rem;
  font-weight: 700;
  color: white;
  background: linear-gradient(135deg, var(--c-primary), #6d28d9);
  border: none;
  border-radius: var(--r-md);
  box-shadow: 0 6px 20px rgba(91, 95, 207, 0.35);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  font-family: inherit;
}
.action-btn-start:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(91, 95, 207, 0.45);
}
.action-btn-start:active {
  transform: translateY(0);
}
</style>
