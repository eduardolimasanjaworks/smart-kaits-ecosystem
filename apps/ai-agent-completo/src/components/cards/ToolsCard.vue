<script setup>
/**
 * cards/ToolsCard.vue v5 — Interface melhorada com governança de acesso
 */
const props = defineProps({ config: Object })

// Definição com descrições claras e parâmetros explícitos
const toolDefs = [
  { 
    key: 'consultClasses',  
    emoji: '🏫', 
    label: 'Consultar grade, turmas e aulas', 
    description: 'Busca horários, turmas disponíveis e aulas por data ou turma.',
    triggersKey: 'consultClassesTriggers' 
  },
  { 
    key: 'checkFinancial',  
    emoji: '💰', 
    label: 'Verificar finanças (pendências, boletos)', 
    description: 'Consulta valores de turmas, pendências de alunos ou responsáveis por CPF.',
    triggersKey: 'checkFinancialTriggers' 
  },
  { 
    key: 'searchStudent',  
    emoji: '🔍', 
    label: 'Buscar dados de aluno/responsável', 
    description: 'Busca dados de usuário (nome, CPF, e-mail, telefone).',
    triggersKey: 'searchStudentTriggers' 
  },
  { 
    key: 'enrollStudent',  
    emoji: '✍️', 
    label: 'Iniciar pré-matrícula', 
    description: 'Inicia processo de matrícula para novo aluno.',
    triggersKey: 'enrollStudentTriggers' 
  },
]

const assistantName = () => props.config.assistantName || 'a I.A.'

let nextTriggerId = 200
let nextAllowedId = 300
let nextBlockedId = 400

function addTrigger(triggersKey) {
  if (!props.config.tools[triggersKey]) props.config.tools[triggersKey] = []
  props.config.tools[triggersKey].push({ id: nextTriggerId++, condition: '' })
}

function removeTrigger(triggersKey, id) {
  const arr = props.config.tools[triggersKey]
  if (!arr) return
  props.config.tools[triggersKey] = arr.filter(t => t.id !== id)
}

function addAllowedContact(toolKey) {
  const key = toolKey + 'AllowedContacts'
  if (!props.config.tools[key]) props.config.tools[key] = []
  props.config.tools[key].push({ id: nextAllowedId++, contact: '' })
}

function removeAllowedContact(toolKey, id) {
  const key = toolKey + 'AllowedContacts'
  const arr = props.config.tools[key]
  if (!arr) return
  props.config.tools[key] = arr.filter(t => t.id !== id)
}

function addBlockedContact(toolKey) {
  const key = toolKey + 'BlockedContacts'
  if (!props.config.tools[key]) props.config.tools[key] = []
  props.config.tools[key].push({ id: nextBlockedId++, contact: '' })
}

function removeBlockedContact(toolKey, id) {
  const key = toolKey + 'BlockedContacts'
  const arr = props.config.tools[key]
  if (!arr) return
  props.config.tools[key] = arr.filter(t => t.id !== id)
}
</script>

<template>
  <div class="tools">

    <p class="tools__intro">
      Ative as APIs para permitir que a I.A. consuma os endpoints do KAITS e use os dados em suas respostas!
    </p>

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
            <p class="tool-item__desc">{{ tool.description }}</p>

            <!-- Campo para instruções de uso (importante para a IA) -->
            <div class="field-group">
              <label class="label">📝 Instruções de uso (para a IA):</label>
              <textarea 
                v-if="!config.tools[tool.key + 'Instructions']"
                placeholder="Ex: Use esta ferramenta sempre que o usuário perguntar sobre horários de turmas específicas ou sobre aulas em uma data determinada."
                @input="config.tools[tool.key + 'Instructions'] = ($event.target as HTMLTextAreaElement).value"
              ></textarea>
              <textarea 
                v-else
                v-model="config.tools[tool.key + 'Instructions']"
              ></textarea>
            </div>

            <div class="tool-item__divider" />

            <!-- Governança de acesso -->
            <div class="governance-section">
              <p class="triggers-section__title">🔒 Governança de acesso:</p>
              
              <!-- Permitidos -->
              <div class="governance-block">
                <p class="governance-subtitle">Apenas estes contatos podem usar:</p>
                <div v-for="(item, idx) in (config.tools[tool.key + 'AllowedContacts'] || [])"
                     :key="item.id"
                     class="governance-row">
                  <span class="badge-count">{{ idx + 1 }}</span>
                  <input type="text" v-model="item.contact" placeholder="E-mail, CPF ou identificador do contato" class="input-governance">
                  <button class="btn-icon" @click="removeAllowedContact(tool.key, item.id)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
                <button class="btn btn-add trigger-add" @click="addAllowedContact(tool.key)">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Adicionar contato permitido
                </button>
                <p class="governance-note">Deixe vazio para permitir a todos.</p>
              </div>
              
              <!-- Bloqueados -->
              <div class="governance-block">
                <p class="governance-subtitle">Exceto estes contatos:</p>
                <div v-for="(item, idx) in (config.tools[tool.key + 'BlockedContacts'] || [])"
                     :key="item.id"
                     class="governance-row">
                  <span class="badge-count">{{ idx + 1 }}</span>
                  <input type="text" v-model="item.contact" placeholder="E-mail, CPF ou identificador do contato" class="input-governance">
                  <button class="btn-icon" @click="removeBlockedContact(tool.key, item.id)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
                <button class="btn btn-add trigger-add" @click="addBlockedContact(tool.key)">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Adicionar contato bloqueado
                </button>
              </div>
              
              <!-- Instruções IA para governança -->
              <div class="field-group" style="margin-top: 0.75rem;">
                <label class="label">📋 Instruções IA sobre governança:</label>
                <textarea 
                  v-if="!config.tools[tool.key + 'GovernanceInstructions']"
                  placeholder="Ex: Sempre pergunte o nome completo e CPF do responsável antes de acessar dados financeiros. Nunca compartilhe dados de mais de um aluno sem a confirmação da secretaria."
                  @input="config.tools[tool.key + 'GovernanceInstructions'] = ($event.target as HTMLTextAreaElement).value"
                ></textarea>
                <textarea 
                  v-else
                  v-model="config.tools[tool.key + 'GovernanceInstructions']"
                ></textarea>
              </div>
            </div>

            <div class="tool-item__divider" />

            <!-- Lista de gatilhos -->
            <div class="triggers-section">
              <p class="triggers-section__title">🎯 Gatilhos (Quando a IA deve usar esta tool):</p>

              <div
                v-for="(trigger, idx) in (config.tools[tool.triggersKey] || [])"
                :key="trigger.id"
                class="trigger-row"
              >
                <span class="badge-count trigger-row__num">{{ idx + 1 }}</span>
                <div class="trigger-row__content">
                  <textarea
                    v-model="trigger.condition"
                    placeholder="Ex: Quando perguntar sobre a grade da turma 3A, ou sobre aulas de matemática, ou sobre horários de determinada turma"
                  ></textarea>
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

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

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

.tool-item__desc {
  font-size: 0.8rem;
  color: #1e40af;
  margin-bottom: 0.5rem;
}

/* ── Body ────────────────────────────────────────────────── */
.tool-item__body {
  background: #f0f7ff;
  padding: .75rem .9rem;
  display: flex; flex-direction: column; gap: .6rem;
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
.trigger-row textarea {
  flex: 1;
  min-height: 0;
  border-radius: 4px;
  padding: .35rem .6rem;
  border: 1px solid #d1d5db;
  font-family: inherit;
  resize: vertical;
  min-height: 60px;
}
.trigger-row textarea:focus {
  outline: none;
  border-color: #3b82f6;
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

.label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #4b5563;
}

/* ── Governance section ─────────────────────────────────── */
.governance-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.governance-block {
  background: white;
  border: 1px solid #bfdbfe;
  border-radius: var(--r-sm);
  padding: 0.6rem 0.7rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.governance-subtitle {
  font-size: 0.78rem;
  font-weight: 600;
  color: #1e40af;
  margin: 0;
}

.governance-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.input-governance {
  flex: 1;
  border-radius: 4px;
  padding: 0.35rem 0.6rem;
  border: 1px solid #d1d5db;
  font-family: inherit;
  font-size: 0.8rem;
}

.input-governance:focus {
  outline: none;
  border-color: #3b82f6;
}

.governance-note {
  font-size: 0.7rem;
  color: #6b7280;
  margin: 0.25rem 0 0 0;
}

.badge-count {
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 0.7rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.btn-icon {
  background: transparent;
  border: none;
  color: #6b7280;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon:hover {
  background: #f3f4f6;
  color: #dc2626;
}
</style>
