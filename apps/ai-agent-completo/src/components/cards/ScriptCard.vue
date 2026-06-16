<script setup>
/**
 * cards/ScriptCard.vue
 * Cartão B — Roteiro / Jornada
 * Saudação padrão + lista de gatilhos "Quando… a IA faz…"
 */
import { ref } from 'vue'
const props = defineProps({ config: Object })

// Adiciona nova regra com IDs únicos
let nextId = 1
function addRule() {
  props.config.scriptRules.push({
    id:       nextId++,
    trigger:  '',
    response: '',
  })
}

function removeRule(id) {
  const idx = props.config.scriptRules.findIndex(r => r.id === id)
  if (idx !== -1) props.config.scriptRules.splice(idx, 1)
}
</script>

<template>
  <div class="script">

    <!-- Saudação padrão -->
    <div>
      <label class="label">👋 Primeira mensagem enviada pela I.A.</label>
      <input
        v-model="props.config.greeting"
        placeholder="Ex: Olá! Seja bem-vindo à Escola 😊 Como posso te ajudar?"
      />
    </div>

    <!-- Divisor -->
    <div class="divider">
      <span>Regras de conversa</span>
    </div>

    <!-- Lista de gatilhos -->
    <TransitionGroup name="fade" tag="div" class="rules-list">
      <div
        v-for="rule in props.config.scriptRules"
        :key="rule.id"
        class="rule-block"
      >
        <!-- Cabeçalho da regra -->
        <div class="rule-block__header">
          <span class="rule-block__label">Regra</span>
          <button class="btn-icon" @click="removeRule(rule.id)" title="Remover regra">
            <!-- ícone lixeira SVG inline -->
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>

        <!-- Campo: gatilho -->
        <div>
          <label class="label">Quando o cliente disser / fizer:</label>
          <input v-model="rule.trigger"
                 placeholder='Ex: "quero me matricular", "qual o preço"...' />
        </div>

        <!-- Campo: resposta -->
        <div>
          <label class="label">A I.A. deve responder:</label>
          <textarea v-model="rule.response" rows="2"
                    placeholder="Ex: Ótimo! Deixa eu te ajudar com a matrícula. Qual o nome do aluno?" />
        </div>
      </div>
    </TransitionGroup>

    <!-- Botão adicionar regra -->
    <button class="btn btn-add" @click="addRule">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      Adicionar regra de conversa
    </button>

  </div>
</template>

<style scoped>
.script { display: flex; flex-direction: column; gap: .75rem; }

/* ── Divisor ────────────────────────────────────────────── */
.divider {
  display: flex; align-items: center; gap: .6rem;
  font-size: .75rem; color: var(--c-text-light); font-weight: 500;
}
.divider::before, .divider::after {
  content: ''; flex: 1; height: 1px; background: var(--c-border);
}

/* ── Rule block ─────────────────────────────────────────── */
.rules-list { display: flex; flex-direction: column; gap: .5rem; }

.rule-block {
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: var(--r-sm);
  padding: .75rem;
  display: flex; flex-direction: column; gap: .55rem;
}
.rule-block__header {
  display: flex; align-items: center; justify-content: space-between;
}
.rule-block__label {
  font-size: .7rem; font-weight: 600;
  text-transform: uppercase; letter-spacing: .05em;
  color: var(--c-personality);
}
</style>
