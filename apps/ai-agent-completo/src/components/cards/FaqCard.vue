<script setup>
/**
 * cards/FaqCard.vue v2
 * UX reimaginada: dropdown de ação (Responder / Notificar / Ambos)
 * + toggle "Pausar" aditivo + seção de notificação colapsável
 * + label de resposta como "sugestão para a I.A."
 */
import { ref, computed, nextTick, watch } from 'vue'
import DidacticFieldModal from '../DidacticFieldModal.vue'

const props = defineProps({
  config: Object,
  onboardingMode: { type: Boolean, default: false },
})

const faqTutorialLabel =
  'Todas as perguntas ficam na lista. Use os números ou «Anterior / Próxima» para saltar entre elas. «Adicionar pergunta» fica na caixa separada no final.'

const activeFaqIndex = ref(0)
const faqCount = computed(() => props.config.faqItems?.length ?? 0)

watch(faqCount, (n, prev) => {
  if (n > prev) activeFaqIndex.value = n - 1
  else if (activeFaqIndex.value >= n) activeFaqIndex.value = Math.max(0, n - 1)
})

function scrollToFaq(index) {
  const items = props.config.faqItems || []
  if (!items.length) return
  const i = Math.max(0, Math.min(index, items.length - 1))
  activeFaqIndex.value = i
  nextTick(() => {
    const el = document.getElementById(`faq-item-${items[i].id}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

function goPrevFaq() {
  scrollToFaq(activeFaqIndex.value - 1)
}

function goNextFaq() {
  scrollToFaq(activeFaqIndex.value + 1)
}

const notifyModalItemId = ref(null)
const notifyModalOpen = computed({
  get: () => notifyModalItemId.value != null,
  set: (v) => { if (!v) notifyModalItemId.value = null },
})
const notifyEditingItem = computed(() =>
  props.config.faqItems.find(i => i.id === notifyModalItemId.value) || null
)

const NOTIFY_EXAMPLE =
  '🔔 Atenção equipe!\nCliente: {whatsapp_cliente}\nMotivo: {resumo_conversa}\nResponda pelo app.'

const NOTIFY_VARS = [
  { key: 'whatsapp_cliente', label: '📲 WhatsApp do cliente' },
  { key: 'resumo_conversa', label: '📝 Resumo da conversa' },
]

function notifyPreview(text) {
  if (!text?.trim()) return 'Nenhuma mensagem de aviso configurada.'
  return text
    .replaceAll('{whatsapp_cliente}', '(11) 98765-4321')
    .replaceAll('{resumo_conversa}', 'Cliente pediu ajuda humana após a I.A. não conseguir responder.')
}

const ACTION_OPTS = [
  { value: 'respond', label: '💬 Responder' },
  { value: 'notify',  label: '🔔 Notificar equipe' },
  { value: 'both',    label: '↕️ Responder + Notificar' },
]

const SHOWS_ANSWER  = new Set(['respond', 'both'])
const SHOWS_NOTIFY  = new Set(['notify',  'both'])

let nextId = 1

async function addItem() {
  const newId = nextId++
  props.config.faqItems.push({
    id: newId,
    question:      '',
    actionType:    'respond',
    pause:         false,
    answer:        '',
    notifyTo:      [],
    notifyMessage: '',
    notifyOpen:    false,
  })
  activeFaqIndex.value = props.config.faqItems.length - 1
  await nextTick()
  scrollToFaq(activeFaqIndex.value)
  const el = document.querySelector(`#faq-item-${newId} .faq-item__question-input`)
  el?.focus()
}

function removeItem(id) {
  const idx = props.config.faqItems.findIndex(i => i.id === id)
  if (idx !== -1) props.config.faqItems.splice(idx, 1)
}

function toggleNotify(item, memberId) {
  if (!Array.isArray(item.notifyTo)) item.notifyTo = []
  const idx = item.notifyTo.indexOf(memberId)
  if (idx === -1) item.notifyTo.push(memberId)
  else item.notifyTo.splice(idx, 1)
}

function addInlineMember(item) {
  const newMember = { id: Date.now(), name: '', phone: '' }
  if (!props.config.teamMembers) props.config.teamMembers = []
  props.config.teamMembers.push(newMember)
  item.notifyTo.push(newMember.id)
}

</script>

<template>
  <div class="faq">
    <p v-if="!onboardingMode" class="faq__intro">
      Cada dúvida vira uma ferramenta da I.A. — configure a ação que ela deve tomar quando o cliente perguntar isso.
    </p>

    <p v-if="onboardingMode" class="faq__onboarding-note">{{ faqTutorialLabel }}</p>

    <div v-if="faqCount > 0" class="faq-nav-panel">
      <div class="faq-nav-panel__row">
        <span class="faq-nav-panel__title">{{ faqCount }} pergunta{{ faqCount > 1 ? 's' : '' }} cadastrada{{ faqCount > 1 ? 's' : '' }}</span>
        <div class="faq-nav-panel__arrows">
          <button
            type="button"
            class="faq-nav-btn"
            :disabled="activeFaqIndex <= 0"
            @click="goPrevFaq"
          >
            ← Pergunta anterior
          </button>
          <span class="faq-nav-panel__pos">#{{ activeFaqIndex + 1 }} de {{ faqCount }}</span>
          <button
            type="button"
            class="faq-nav-btn"
            :disabled="activeFaqIndex >= faqCount - 1"
            @click="goNextFaq"
          >
            Próxima pergunta →
          </button>
        </div>
      </div>
      <p class="faq-nav-panel__hint">Clique em um número para ir direto à pergunta. Role a lista para ver o conteúdo completo.</p>
      <div class="faq-nav-panel__chips" role="tablist" aria-label="Ir para pergunta">
        <button
          v-for="(item, idx) in config.faqItems"
          :key="'chip-' + item.id"
          type="button"
          role="tab"
          class="faq-nav-chip"
          :class="{ 'faq-nav-chip--active': idx === activeFaqIndex }"
          :aria-selected="idx === activeFaqIndex"
          :title="item.question?.trim() || `Pergunta ${idx + 1}`"
          @click="scrollToFaq(idx)"
        >
          {{ idx + 1 }}
        </button>
      </div>
    </div>

    <div class="faq-list-wrap">
    <TransitionGroup name="fade" tag="div" class="faq-list">
      <div
        v-for="(item, idx) in config.faqItems"
        :id="`faq-item-${item.id}`"
        :key="item.id"
        class="faq-item"
        :class="[
          `faq-item--color-${(idx % 4) + 1}`,
          { 'faq-item--nav-active': idx === activeFaqIndex },
        ]"
      >

        <!-- Header: número + pergunta + delete -->
        <div class="faq-item__header">
          <span class="badge-count">{{ String(idx + 1).padStart(2, '0') }}</span>
          <input
            v-model="item.question"
            class="faq-item__question-input"
            placeholder='Ex: "Quais são os horários?"'
          />
          <button type="button" class="btn-icon btn-icon--remove" @click="removeItem(item.id)" title="Remover">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <!-- Linha de controles: ação + pausar -->
        <div class="faq-item__controls">
          <div class="action-select-wrap">
            <label class="sr-only">Ação</label>
            <select v-model="item.actionType" class="action-select">
              <option v-for="opt in ACTION_OPTS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>

          <label class="pause-toggle" :class="{ 'pause-toggle--on': item.pause }">
            <input type="checkbox" v-model="item.pause" class="sr-only" />
            <span class="pause-toggle__track">
              <span class="pause-toggle__thumb" />
            </span>
            <span class="pause-toggle__label">⏸ Pausar I.A.</span>
          </label>
        </div>

        <!-- Sugestão de resposta para a I.A. (quando ação inclui resposta) -->
        <Transition name="fade">
          <div v-if="SHOWS_ANSWER.has(item.actionType)" class="answer-block">
            <label class="label">
              💡 Sugestão de resposta para a I.A.
              <span class="label__sub">A I.A. vai formular — dê uma dica de direção, não um texto fixo</span>
            </label>
            <textarea
              v-model="item.answer"
              rows="2"
              placeholder="Ex: Mencionar os horários disponíveis e convidar para agendar uma visita…"
            />
          </div>
        </Transition>

        <!-- Seção de notificação colapsável -->
        <Transition name="fade">
          <div v-if="SHOWS_NOTIFY.has(item.actionType)" class="notify-section">
            <button
              type="button"
              class="notify-section__toggle"
              @click="item.notifyOpen = !item.notifyOpen"
            >
              <span>🔔 Notificar equipe</span>
              <svg
                class="notify-section__chevron"
                :class="{ 'notify-section__chevron--open': item.notifyOpen }"
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
              <span v-if="(item.notifyTo || []).length" class="notify-section__count">
                {{ item.notifyTo.length }} selecionado{{ item.notifyTo.length > 1 ? 's' : '' }}
              </span>
            </button>

            <Transition name="slide-down">
              <div v-if="item.notifyOpen" class="notify-section__body">
                <label class="label">Mensagem enviada à equipe (WhatsApp)</label>
                <p class="notify-msg-lead">
                  Quando esta FAQ disparar um aviso, a equipe recebe este texto no WhatsApp.
                  <code v-pre>{whatsapp_cliente}</code> = número do cliente;
                  <code v-pre>{resumo_conversa}</code> = resumo automático do que foi falado.
                </p>
                <div class="notify-msg-summary">
                  <p class="notify-msg-summary__text">{{ notifyPreview(item.notifyMessage) }}</p>
                  <button type="button" class="btn-configure-notify" @click="notifyModalItemId = item.id">
                    Configurar mensagem de aviso
                  </button>
                </div>

                <label class="label" style="margin-top: 0.5rem;">Quem notificar</label>
                <div v-if="config.teamMembers?.length" class="notify-chips">
                  <button
                    v-for="member in config.teamMembers"
                    :key="member.id"
                    type="button"
                    class="notify-chip"
                    :class="{ 'notify-chip--active': (item.notifyTo || []).includes(member.id) }"
                    @click="toggleNotify(item, member.id)"
                  >
                    {{ member.name || '(sem nome)' }}
                  </button>
                </div>
                <p v-if="!config.teamMembers?.length" class="notify-empty">
                  Cadastre a equipe em «Equipe &amp; Contatos» para escolher destinatários.
                </p>
                <button type="button" class="btn-add-inline" @click="addInlineMember(item)">
                  + Adicionar contato
                </button>
              </div>
            </Transition>
          </div>
        </Transition>

      </div>
    </TransitionGroup>
    </div>

    <p v-if="!config.faqItems.length" class="faq__empty faq__empty--tutorial">
      Nenhuma pergunta ainda. Use a caixa «Nova pergunta» abaixo para criar a primeira.
    </p>

    <DidacticFieldModal
      v-if="notifyEditingItem"
      v-model:open="notifyModalOpen"
      v-model="notifyEditingItem.notifyMessage"
      title="Mensagem de aviso à equipe"
      subtitle="Esta mensagem é enviada por WhatsApp para as pessoas que você marcar abaixo, quando o cliente acionar esta FAQ."
      :example-text="NOTIFY_EXAMPLE"
      :variables="NOTIFY_VARS"
      :preview-vars="{
        whatsapp_cliente: '(11) 98765-4321',
        resumo_conversa: 'Cliente pediu ajuda humana após a I.A. não conseguir responder.',
      }"
    />

    <section class="faq-add-panel" aria-label="Adicionar nova pergunta frequente">
      <div class="faq-add-panel__inner">
        <div class="faq-add-panel__text">
          <strong class="faq-add-panel__title">Nova pergunta frequente</strong>
          <p class="faq-add-panel__desc">
            Cria um bloco novo na lista — não altera a pergunta que você está vendo acima.
          </p>
        </div>
        <button type="button" class="btn faq-add-panel__btn" @click="addItem">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Adicionar pergunta
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.faq { display: flex; flex-direction: column; gap: 0.65rem; }
.faq__intro { font-size: 0.78rem; color: var(--c-text-muted); line-height: 1.5; }
.faq__empty  { font-size: 0.8rem; color: var(--c-text-light); font-style: italic; }
.faq__onboarding-note {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--c-primary);
  background: var(--c-primary-dim);
  border-radius: 8px;
  padding: 0.5rem 0.65rem;
  margin: 0 0 0.5rem;
}
.faq-nav-panel {
  margin: 0.5rem 0 0.85rem;
  padding: 0.75rem 0.85rem;
  background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
  border: 1.5px solid #c7d2fe;
  border-radius: 12px;
}
.faq-nav-panel__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 0.75rem;
  margin-bottom: 0.45rem;
}
.faq-nav-panel__title {
  font-size: 0.8rem;
  font-weight: 800;
  color: #3730a3;
}
.faq-nav-panel__arrows {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.5rem;
}
.faq-nav-panel__pos {
  font-size: 0.72rem;
  font-weight: 700;
  color: #475569;
  padding: 0.2rem 0.45rem;
  background: #fff;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}
.faq-nav-panel__hint {
  font-size: 0.68rem;
  color: #64748b;
  margin: 0 0 0.5rem;
  line-height: 1.4;
}
.faq-nav-btn {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.35rem 0.55rem;
  border-radius: 8px;
  border: 1px solid #c7d2fe;
  background: #fff;
  color: #4338ca;
  cursor: pointer;
}
.faq-nav-btn:hover:not(:disabled) {
  background: #eef2ff;
}
.faq-nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.faq-nav-panel__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.faq-nav-chip {
  min-width: 2rem;
  height: 2rem;
  padding: 0 0.45rem;
  border-radius: 8px;
  border: 1.5px solid #cbd5e1;
  background: #fff;
  font-size: 0.75rem;
  font-weight: 800;
  color: #64748b;
  cursor: pointer;
}
.faq-nav-chip--active {
  border-color: var(--c-primary);
  background: var(--c-primary);
  color: #fff;
}
.faq-list-wrap {
  display: flex;
  flex-direction: column;
  margin-bottom: 0.25rem;
}
.faq-list    { display: flex; flex-direction: column; gap: 0.85rem; }

.faq-add-panel {
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 2px dashed #c7d2fe;
}
.faq-add-panel__inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1rem;
  padding: 0.85rem 1rem;
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  border-radius: 14px;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);
}
.faq-add-panel__title {
  display: block;
  font-size: 0.85rem;
  color: #0f172a;
  margin-bottom: 0.2rem;
}
.faq-add-panel__desc {
  font-size: 0.72rem;
  color: #64748b;
  margin: 0;
  line-height: 1.4;
  max-width: 28rem;
}
.faq-add-panel__btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 700 !important;
  padding: 0.55rem 1rem !important;
  background: linear-gradient(135deg, var(--c-primary), #6366f1) !important;
  color: #fff !important;
  border: none !important;
  border-radius: 10px !important;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
}
.faq-add-panel__btn:hover {
  filter: brightness(1.05);
}

.faq-item--nav-active {
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.35);
}

.faq__empty--tutorial {
  font-style: normal;
  font-weight: 600;
  color: var(--c-primary);
  background: var(--c-primary-dim);
  padding: 0.65rem 0.75rem;
  border-radius: 10px;
}

/* Acessibilidade: oculta label mas mantém para leitores de tela */
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; }

/* ── Item FAQ — base + separador + cores alternadas ── */
.faq-item {
  background: white;
  border: 1.5px solid var(--c-border);
  border-radius: 12px;
  padding: 0.75rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  transition: border-color 0.2s, box-shadow 0.2s;
  /* Separador visual entre itens ampliado */
  margin-bottom: 0;
  position: relative;
}
.faq-item:focus-within {
  border-color: #a5b4fc;
  box-shadow: 0 0 0 3px rgba(165,180,252,0.2);
}
/* Cores alternadas sutis por item */
.faq-item--color-1 { background: #ffffff; border-color: #e2e8f0; }
.faq-item--color-2 { background: #fafbff; border-color: #c7d2fe; }
.faq-item--color-3 { background: #fafff5; border-color: #bbf7d0; }
.faq-item--color-4 { background: #fffbf0; border-color: #fde68a; }
.faq-item--color-1:focus-within { border-color: #a5b4fc; }
.faq-item--color-2:focus-within { border-color: #818cf8; }
.faq-item--color-3:focus-within { border-color: #4ade80; }
.faq-item--color-4:focus-within { border-color: #fbbf24; }

/* Header: número + input + botão remover alinhados */
.faq-item__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.faq-item__question-input {
  flex: 1;
  font-size: 0.85rem;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--c-border);
  border-radius: 8px;
  font-family: inherit;
  color: var(--c-text);
  background: var(--c-bg);
  transition: border-color 0.2s;
}
.faq-item__question-input:focus {
  outline: none;
  border-color: var(--c-primary);
}
.btn-icon--remove {
  flex-shrink: 0;
  width: 26px; height: 26px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 6px;
  color: #94a3b8;
  transition: background 0.15s, color 0.15s;
}
.btn-icon--remove:hover { background: #fee2e2; color: #ef4444; }

/* ── Linha de controles (select + toggle pausar) ── */
.faq-item__controls {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
}

/* Select de ação */
.action-select-wrap { position: relative; }
.action-select {
  appearance: none;
  -webkit-appearance: none;
  background: var(--c-surface);
  border: 1.5px solid var(--c-border);
  border-radius: 8px;
  padding: 0.38rem 2rem 0.38rem 0.7rem;
  font-size: 0.78rem;
  font-family: inherit;
  font-weight: 600;
  color: var(--c-text);
  cursor: pointer;
  transition: border-color 0.2s;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.55rem center;
}
.action-select:focus { outline: none; border-color: var(--c-primary); }

/* Toggle Pausar */
.pause-toggle {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  cursor: pointer;
  user-select: none;
  margin-left: auto;
}
.pause-toggle__track {
  width: 32px; height: 17px;
  border-radius: 99px;
  background: #e2e8f0;
  position: relative;
  transition: background 0.2s;
  flex-shrink: 0;
}
.pause-toggle--on .pause-toggle__track { background: #f59e0b; }
.pause-toggle__thumb {
  position: absolute;
  top: 2px; left: 2px;
  width: 13px; height: 13px;
  border-radius: 50%;
  background: white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  transition: transform 0.2s;
}
.pause-toggle--on .pause-toggle__thumb { transform: translateX(15px); }
.pause-toggle__label {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--c-text-muted);
  white-space: nowrap;
}
.pause-toggle--on .pause-toggle__label { color: #b45309; }

/* ── Campo de sugestão de resposta ── */
.answer-block {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 0.75rem;
  margin-top: 0.2rem;
}

/* ── Label ── */
.label {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--c-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}
.label__sub {
  font-size: 0.67rem;
  text-transform: none;
  letter-spacing: 0;
  font-weight: 400;
  color: var(--c-text-light);
  font-style: italic;
}

/* ── Seção de notificação ── */
.notify-section {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
}
.notify-section__toggle {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  width: 100%;
  text-align: left;
  background: #f8fafc;
  border: none;
  padding: 0.5rem 0.75rem;
  font-size: 0.78rem;
  font-weight: 600;
  font-family: inherit;
  color: var(--c-text-muted);
  cursor: pointer;
  transition: background 0.15s;
}
.notify-section__toggle:hover { background: #f1f5f9; }
.notify-section__chevron {
  margin-left: auto;
  transition: transform 0.2s;
  flex-shrink: 0;
}
.notify-section__chevron--open { transform: rotate(180deg); }
.notify-section__count {
  font-size: 0.67rem;
  background: #dbeafe;
  color: #1d4ed8;
  padding: 0.1rem 0.45rem;
  border-radius: 99px;
  font-weight: 700;
}
.notify-section__body {
  padding: 0.65rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  background: white;
  border-top: 1px solid #e2e8f0;
}

.notify-msg-lead {
  font-size: 0.7rem;
  color: var(--c-text-muted);
  margin: 0;
  line-height: 1.45;
}
.notify-msg-lead code {
  font-size: 0.67rem;
  background: #f1f5f9;
  padding: 0.05rem 0.25rem;
  border-radius: 4px;
}
.notify-msg-summary {
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  padding: 0.55rem 0.65rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.notify-msg-summary__text {
  font-size: 0.8rem;
  color: #334155;
  line-height: 1.45;
  margin: 0;
  white-space: pre-wrap;
}
.btn-configure-notify {
  align-self: flex-start;
  font-family: inherit;
  font-size: 0.76rem;
  font-weight: 700;
  color: #1d4ed8;
  background: #eff6ff;
  border: 1.5px solid #93c5fd;
  border-radius: 8px;
  padding: 0.3rem 0.65rem;
  cursor: pointer;
}
.btn-configure-notify:hover { background: #dbeafe; }

.notify-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.notify-chip {
  font-size: 0.78rem;
  font-family: inherit;
  padding: 0.28rem 0.7rem;
  border-radius: 99px;
  border: 1.5px solid var(--c-border);
  background: var(--c-surface);
  color: var(--c-text-muted);
  cursor: pointer;
  transition: all var(--t-fast);
}
.notify-chip--active { border-color: var(--c-team); background: #fdf2f8; color: #9d174d; font-weight: 600; }
.notify-empty { font-size: 0.78rem; color: var(--c-text-light); font-style: italic; margin: 0; }
.btn-add-inline {
  font-size: 0.75rem;
  font-family: inherit;
  cursor: pointer;
  background: transparent;
  color: var(--c-primary);
  border: 1px dashed #c7d2fe;
  border-radius: 8px;
  padding: 0.28rem 0.7rem;
  transition: all var(--t-fast);
  align-self: flex-start;
}
.btn-add-inline:hover { background: var(--c-primary-dim); }

/* ── Animações ── */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s, transform 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-4px); }

.slide-down-enter-active { transition: all 0.22s ease; }
.slide-down-leave-active { transition: all 0.18s ease; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateY(-6px); max-height: 0; }
</style>
