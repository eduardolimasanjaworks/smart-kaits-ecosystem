<script setup>
/**
 * cards/ToolsCard.vue v3 — Múltiplos gatilhos por ferramenta
 * Formato de leitura: "Quando alguém: X → a [Nome] vai Y"
 */
const props = defineProps({ config: Object })

// Definição estática das ferramentas disponíveis no KAITS
const toolDefs = [
  { key: 'consultClasses',  emoji: '🏫', label: 'Consultar grade escolar',  triggersKey: 'consultClassesTriggers' },
  { key: 'checkSchedule',   emoji: '📅', label: 'Agenda e horários do aluno', triggersKey: 'checkScheduleTriggers',
    params: [
      { key: 'scheduleQ1', label: 'Pergunta 1 (ex: Qual o ano escolar?)' },
      { key: 'scheduleQ2', label: 'Pergunta 2 (ex: Qual o turno?)' },
    ]},
  { key: 'enrollStudent',   emoji: '✍️', label: 'Iniciar nova pré-matrícula', triggersKey: 'enrollStudentTriggers' },
  { key: 'checkFinancial',  emoji: '💰', label: 'Verificar pendências e boletos', triggersKey: 'checkFinancialTriggers' },
]

const assistantName = () => props.config.assistantName || 'a I.A.'

let nextTriggerId = 200

function addTrigger(triggersKey) {
  if (!props.config.tools[triggersKey]) props.config.tools[triggersKey] = []
  props.config.tools[triggersKey].push({ id: nextTriggerId++, condition: '' })
}

function removeTrigger(triggersKey, id) {
  const arr = props.config.tools[triggersKey]
  if (!arr) return
  props.config.tools[triggersKey] = arr.filter(t => t.id !== id)
}
</script>

<template>
  <div class="tools">

    <p class="tools__intro">Ative as APIs para permitir que a I.A. consuma os endpoints do KAITS e use os dados em suas respostas (RAG):</p>

    <div class="tools-list">
      <div
        v-for="tool in toolDefs"
        :key="tool.key"
        class="tool-item"
        :class="{ 'tool-item--active': config.tools[tool.key] }"
      >
        <!-- Toggle principal -->
        <label class="check-item tool-item__header">
          <input type="checkbox" v-model="config.tools[tool.key]" />
          <span class="tool-item__label">{{ tool.emoji }} {{ tool.label }}</span>
        </label>

        <!-- Corpo expansível -->
        <Transition name="slide">
          <div v-if="config.tools[tool.key]" class="tool-item__body">

            <!-- Parâmetros extras (para checkSchedule) -->
            <template v-if="tool.params">
              <div class="tool-item__params-tip">
                🤖 Para buscar, a I.A. precisará perguntar ao cliente:
              </div>
              <div v-for="param in tool.params" :key="param.key">
                <label class="label">{{ param.label }}</label>
                <input v-model="config.tools[param.key]" :placeholder="param.label" />
              </div>
              <div class="tool-item__divider" />
            </template>

            <!-- Lista de gatilhos -->
            <div class="triggers-section">
              <p class="triggers-section__title">Autorização e Gatilho (Quando deve ser ativado?)</p>

              <div
                v-for="(trigger, idx) in (config.tools[tool.triggersKey] || [])"
                :key="trigger.id"
                class="trigger-row"
              >
                <!-- Número sutil -->
                <span class="badge-count trigger-row__num">{{ idx + 1 }}</span>

                <div class="trigger-row__content">
                  <!-- Linha 1: condition -->
                  <div class="trigger-row__line">
                    <span class="trigger-row__pill">Quando alguém</span>
                    <input
                      v-model="trigger.condition"
                      placeholder="mencionar vagas, perguntar sobre turmas..."
                    />
                  </div>
                  <!-- Linha 2: resultado (read-only) -->
                  <div class="trigger-row__result">
                    → <em>{{ assistantName() }}</em> vai {{ tool.label.toLowerCase() }}
                  </div>
                </div>

                <button class="btn-icon" @click="removeTrigger(tool.triggersKey, trigger.id)">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              <!-- Add trigger -->
              <button class="btn btn-add trigger-add"
                      @click="addTrigger(tool.triggersKey)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Adicionar gatilho
              </button>
            </div>

          </div>
        </Transition>
      </div>
    </div>

  </div>
</template>

<style scoped>
.tools { display: flex; flex-direction: column; gap: .65rem; }
.tools__intro { font-size: .8rem; color: var(--c-text-muted); }
.tools-list   { display: flex; flex-direction: column; gap: .45rem; }

/* ── Tool item ───────────────────────────────────────────── */
.tool-item {
  border: 1.5px solid var(--c-border);
  border-radius: var(--r-sm);
  background: var(--c-surface);
  overflow: hidden;
  transition: border-color var(--t-fast);
}
.tool-item--active { border-color: var(--c-tools); }

.tool-item__header {
  padding: .75rem .9rem; gap: .65rem; align-items: center;
  border-bottom: 1px solid transparent;
  transition: background var(--t-fast);
}
.tool-item--active .tool-item__header { border-bottom-color: #bfdbfe; }

.tool-item__label { font-size: .86rem; font-weight: 500; }

/* ── Body ────────────────────────────────────────────────── */
.tool-item__body {
  background: #f0f7ff;
  padding: .75rem .9rem;
  display: flex; flex-direction: column; gap: .6rem;
}
.tool-item__params-tip {
  font-size: .78rem; color: #1e40af; font-weight: 500;
}
.tool-item__divider { height: 1px; background: #bfdbfe; margin: .1rem 0; }

/* ── Triggers section ────────────────────────────────────── */
.triggers-section { display: flex; flex-direction: column; gap: .45rem; }
.triggers-section__title {
  font-size: .72rem; font-weight: 600; text-transform: uppercase;
  letter-spacing: .05em; color: var(--c-tools);
}

/* ── Trigger row ─────────────────────────────────────────── */
.trigger-row {
  display: flex; align-items: flex-start; gap: .45rem;
  background: white; border: 1px solid #bfdbfe;
  border-radius: var(--r-sm); padding: .6rem .7rem;
}
.trigger-row__num { margin-top: 2px; }
.trigger-row__content { flex: 1; display: flex; flex-direction: column; gap: .35rem; }
.trigger-row__line   { display: flex; align-items: center; gap: .4rem; }
.trigger-row__line input { flex: 1; min-height: 0; border-radius: 4px; padding: .35rem .6rem; }

.trigger-row__pill {
  font-size: .72rem; font-weight: 600; white-space: nowrap;
  background: #dbeafe; color: #1e3a8a; border-radius: 99px; padding: .15rem .55rem;
}
.trigger-row__result {
  font-size: .77rem; color: var(--c-text-muted); padding-left: .2rem;
}
.trigger-row__result em {
  font-style: normal; font-weight: 600; color: var(--c-tools);
}

.trigger-add {
  font-size: .77rem; padding: .4rem;
  background: transparent; color: var(--c-tools);
  border: 1.5px dashed #93c5fd;
}
.trigger-add:hover { background: #dbeafe; }
</style>
