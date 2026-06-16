<script setup>
/**
 * Modal didático para configurar mensagens com variáveis ({whatsapp_cliente}, etc.).
 */
import { ref, computed, watch, nextTick } from 'vue'

const props = defineProps({
  open: Boolean,
  title: String,
  subtitle: String,
  modelValue: { type: String, default: '' },
  exampleText: { type: String, default: '' },
  variables: { type: Array, default: () => [] },
  previewVars: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update:open', 'update:modelValue'])

const draft = ref('')
const textareaRef = ref(null)

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      draft.value = props.modelValue || ''
      nextTick(() => textareaRef.value?.focus())
    }
  }
)

const previewText = computed(() => {
  let text = draft.value || props.exampleText || ''
  const map = {
    whatsapp_cliente: props.previewVars.whatsapp_cliente || '(11) 98765-4321',
    resumo_conversa:
      props.previewVars.resumo_conversa ||
      'Cliente perguntou sobre matrícula 2026; a I.A. não tinha o valor na base.',
    nome_atendente: props.previewVars.nome_atendente || 'Maria',
  }
  for (const [key, val] of Object.entries(map)) {
    text = text.replaceAll(`{${key}}`, val)
  }
  return text || '—'
})

function close() {
  emit('update:open', false)
}

function save() {
  emit('update:modelValue', draft.value)
  close()
}

function useExample() {
  draft.value = props.exampleText
}

function insertVar(variable) {
  const token = `{${variable}}`
  const el = textareaRef.value
  if (el && typeof el.selectionStart === 'number') {
    const start = el.selectionStart
    const end = el.selectionEnd
    const before = draft.value.slice(0, start)
    const after = draft.value.slice(end)
    draft.value = before + token + after
    nextTick(() => {
      const pos = start + token.length
      el.setSelectionRange(pos, pos)
      el.focus()
    })
  } else {
    draft.value = (draft.value || '') + token
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="didactic-overlay" @click.self="close">
        <div class="didactic-modal" role="dialog" aria-modal="true" @click.stop>
          <button type="button" class="didactic-modal__close" aria-label="Fechar" @click="close">×</button>

          <h3 class="didactic-modal__title">{{ title }}</h3>
          <p v-if="subtitle" class="didactic-modal__subtitle">{{ subtitle }}</p>

          <div class="didactic-modal__explain">
            <p><strong>Como funciona:</strong> você escreve o texto; onde aparecerem as «etiquetas» abaixo, o sistema troca pelos dados reais no momento da transferência ou do aviso.</p>
          </div>

          <div v-if="variables.length" class="didactic-modal__chips">
            <span class="didactic-modal__chips-label">Inserir etiqueta:</span>
            <button
              v-for="v in variables"
              :key="v.key"
              type="button"
              class="didactic-chip"
              @click="insertVar(v.key)"
            >
              {{ v.label }}
            </button>
          </div>

          <label class="label">Sua mensagem</label>
          <textarea
            ref="textareaRef"
            v-model="draft"
            class="didactic-modal__textarea"
            rows="4"
            :placeholder="exampleText"
          />

          <div class="didactic-modal__preview">
            <span class="didactic-modal__preview-label">Pré-visualização (exemplo)</span>
            <p class="didactic-modal__preview-text">{{ previewText }}</p>
          </div>

          <div v-if="exampleText" class="didactic-modal__example">
            <span class="didactic-modal__example-label">Exemplo pronto</span>
            <p class="didactic-modal__example-text">{{ exampleText }}</p>
            <button type="button" class="btn btn-ghost didactic-modal__use-example" @click="useExample">
              Usar este exemplo
            </button>
          </div>

          <div class="didactic-modal__actions">
            <button type="button" class="btn btn-ghost" @click="close">Cancelar</button>
            <button type="button" class="btn btn-primary" @click="save">Salvar mensagem</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.didactic-overlay {
  position: fixed;
  inset: 0;
  z-index: 10050;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}
.didactic-modal {
  position: relative;
  width: min(520px, 100%);
  max-height: 90vh;
  overflow-y: auto;
  background: white;
  border-radius: 16px;
  padding: 1.25rem 1.35rem 1.1rem;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.25);
}
.didactic-modal__close {
  position: absolute;
  top: 0.65rem;
  right: 0.75rem;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: #f1f5f9;
  color: #64748b;
  font-size: 1.35rem;
  line-height: 1;
  cursor: pointer;
}
.didactic-modal__close:hover { background: #e2e8f0; color: #0f172a; }
.didactic-modal__title {
  font-size: 1.05rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0 2rem 0.35rem 0;
  line-height: 1.3;
}
.didactic-modal__subtitle {
  font-size: 0.85rem;
  color: var(--c-text-muted);
  line-height: 1.5;
  margin: 0 0 0.75rem;
}
.didactic-modal__explain {
  background: #f0fdfa;
  border: 1px solid #99f6e4;
  border-radius: 10px;
  padding: 0.65rem 0.8rem;
  font-size: 0.8rem;
  color: #0f766e;
  line-height: 1.5;
  margin-bottom: 0.75rem;
}
.didactic-modal__chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  margin-bottom: 0.5rem;
}
.didactic-modal__chips-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: #64748b;
}
.didactic-chip {
  font-family: inherit;
  font-size: 0.72rem;
  font-weight: 700;
  background: white;
  color: #0d9488;
  border: 1.5px solid #5eead4;
  border-radius: 99px;
  padding: 0.2rem 0.55rem;
  cursor: pointer;
}
.didactic-chip:hover { background: #ccfbf1; }
.didactic-modal__textarea {
  width: 100%;
  font-size: 0.875rem;
  margin-bottom: 0.65rem;
}
.didactic-modal__preview {
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 10px;
  padding: 0.6rem 0.75rem;
  margin-bottom: 0.65rem;
}
.didactic-modal__preview-label,
.didactic-modal__example-label {
  display: block;
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
  margin-bottom: 0.25rem;
}
.didactic-modal__preview-text,
.didactic-modal__example-text {
  font-size: 0.82rem;
  color: #334155;
  line-height: 1.5;
  margin: 0;
  white-space: pre-wrap;
}
.didactic-modal__example {
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 10px;
  padding: 0.6rem 0.75rem;
  margin-bottom: 0.85rem;
}
.didactic-modal__use-example {
  margin-top: 0.45rem;
  font-size: 0.78rem !important;
  padding: 0.35rem 0.65rem !important;
}
.didactic-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  flex-wrap: wrap;
}
</style>
