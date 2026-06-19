<script setup>
/**
 * TestChatModal.vue v3 — "Lúdico & Narrativo"
 * Split-screen: Chat (Esq) + Painel de Raciocínio da I.A. (Dir)
 */
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { aiService, api } from '../services/api.js'
import { devLog } from '../utils/devLog.js'
import AdvancedDocEditor from './modals/AdvancedDocEditor.vue'

const props = defineProps({ config: Object, modelValue: Boolean })
const emit  = defineEmits(['update:modelValue'])

const messages    = ref([])
const inputText   = ref('')
const isTyping    = ref(false)
const isRecording = ref(false)
const messagesEl  = ref(null)
const showReset   = ref(false)
const showTokenInput = ref(false)
const testKaitsToken = ref('')
const testUserIdentifier = ref('')
let   recognition = null

const sidebarDocId = ref(null)
const sidebarTarget = ref(null)
const showSidebar = ref(false)

function openInlineEditor(source) {
  sidebarDocId.value = source.docId
  sidebarTarget.value = { page: source.page, lineStart: source.lineStart }
  showSidebar.value = true
}
const showCorrect      = ref(false)
const correctText      = ref('')
const correctRecording = ref(false)
const correctMode      = ref(null) // 'text' | 'transfer' | 'delete'
let   correctRecog     = null

const activeAuditMsg = ref(null)
const showTeamPane   = ref(false)

// Dados temporários para o transbordo na correção
const transferMeta = ref({
  selectedMembers: [],
  attendantMsg: '',
  clientMsg: '',
  notifyClient: false,
  pauseAi: true,
  newMember: { name: '', phone: '' }
})


const iceBreakers = computed(() => {
  const list = []
  props.config.faqItems?.forEach(i  => { if (i.question) list.push(i.question) })
  props.config.scriptRules?.forEach(r => { if (r.trigger)  list.push(r.trigger) })
  if (list.length < 3) list.push('Quero informações sobre matrículas', 'Quais são os horários?')
  return list.slice(0, 4)
})

const isNew = computed(() => messages.value.length <= 1)
const name  = computed(() => props.config.assistantName || 'Assistente')

const kPersonality = computed(() => props.config.personality?.trim().length > 0 || props.config.assistantName?.trim().length > 0)
const kScript      = computed(() => props.config.greeting?.trim().length > 0 || props.config.scriptRules?.length > 0)
const kFaq         = computed(() => props.config.faqItems?.length > 0)
const kTools       = computed(() =>
  Object.entries(props.config.tools || {}).some(([key, value]) =>
    !key.endsWith('Triggers') &&
    !key.endsWith('Instructions') &&
    !key.endsWith('GovernanceInstructions') &&
    !key.endsWith('AllowedContacts') &&
    !key.endsWith('BlockedContacts') &&
    !key.endsWith('GovernanceMode') &&
    typeof value === 'boolean' &&
    value
  )
)

onMounted(() => {
  testKaitsToken.value = localStorage.getItem('test_kaits_api_token') || ''
  testUserIdentifier.value = localStorage.getItem('test_kaits_user_identifier') || ''
})

watch(testKaitsToken, (value) => {
  if (value?.trim()) localStorage.setItem('test_kaits_api_token', value.trim())
  else localStorage.removeItem('test_kaits_api_token')
})

watch(testUserIdentifier, (value) => {
  if (value?.trim()) localStorage.setItem('test_kaits_user_identifier', value.trim())
  else localStorage.removeItem('test_kaits_user_identifier')
})

function now() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function initChat() {
  activeAuditMsg.value = null
  showCorrect.value = false
  messages.value = [{ id: 0, from: 'ai', text: props.config.greeting || 'Olá! Como posso ajudar? 😊', time: now() }]
}

// ── SIMULAÇÃO REAL COM I.A. ───────────────────────────────────
async function simulateResponse(userMsg) {
  isTyping.value = true
  
  try {
    // Agora chama o serviço real de I.A. passando o histórico para manter o contexto
    // Filtramos apenas mensagens de usuário e I.A. (ignorando sistema)
    const history = messages.value
      .filter(m => m.from === 'ai' || m.from === 'user')
      .map(m => ({ from: m.from, text: m.text }))

    const responseData = await aiService.processChat(
      userMsg,
      history,
      testKaitsToken.value || null,
      testUserIdentifier.value || null
    )
    
    // Converte o formato do backend para o formato esperado pelo frontend do modal
    let response = responseData.text
    let auditSources = []
    let isTool = false
    
    if (responseData.audit) {
      if (responseData.audit.type === 'tool') {
        isTool = true
        auditSources.push({
          type: 'tool',
          headline: responseData.audit.headline,
          detail: responseData.audit.detail,
          source: responseData.audit.detail
        })
      } else if (responseData.audit.type === 'ai_chat') {
        auditSources.push({
          type: 'ai',
          headline: responseData.audit.headline,
          detail: responseData.audit.detail
        })
      }
    }

    isTyping.value = false
    const msgObj = { 
      id: Date.now(), 
      from: 'ai', 
      text: response, 
      time: now(), 
      auditSources, 
      isTool 
    }
    messages.value.push(msgObj)

    // Se for handover, mostra a notificação de sistema
    if (responseData.audit?.type === 'tool' && responseData.audit.headline.includes('humano')) {
      await new Promise(r => setTimeout(r, 600))
      messages.value.push({
        id: Date.now() + 1,
        from: 'system',
        type: 'handover',
        contact: responseData.audit.contact || 'Equipe',
        phone: 'WhatsApp',
        message: responseData.audit.notifyMsg || 'Um cliente precisa de você!',
        time: now()
      })
      showTeamPane.value = true
    }

    activeAuditMsg.value = msgObj

  } catch (error) {
    devLog.error('Erro na simulação de I.A:', error)
    isTyping.value = false
    messages.value.push({
      id: Date.now(),
      from: 'ai',
      text: 'Ops! Tive um problema técnico ao processar sua mensagem no simulador. Verifique sua conexão ou tente novamente.',
      time: now()
    })
  } finally {
    scrollBottom()
  }
}

function send() {
  if (props.config.isPaused) return
  const text = inputText.value.trim()
  if (!text) return
  inputText.value = ''
  messages.value.push({ id: Date.now(), from: 'user', text, time: now() })
  scrollBottom()
  simulateResponse(text)
}

function sendIceBreaker(text) {
  if (props.config.isPaused || !isNew.value) return
  messages.value.push({ id: Date.now(), from: 'user', text, time: now() })
  scrollBottom()
  simulateResponse(text)
}

function scrollBottom() {
  nextTick(() => { if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight })
}

function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
}

function toggleRecording() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) return
  if (isRecording.value) { recognition?.stop(); isRecording.value = false; return }
  recognition = new SR()
  recognition.lang = 'pt-BR'; recognition.continuous = false
  recognition.onresult = e => { inputText.value = e.results[0][0].transcript; isRecording.value = false }
  recognition.onerror  = () => { isRecording.value = false }
  recognition.onend    = () => { isRecording.value = false }
  recognition.start(); isRecording.value = true
}

function toggleCorrectRecording() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) return
  if (correctRecording.value) { correctRecog?.stop(); correctRecording.value = false; return }
  correctRecog = new SR()
  correctRecog.lang = 'pt-BR'; correctRecog.continuous = false
  correctRecog.onresult = e => { correctText.value = e.results[0][0].transcript; correctRecording.value = false }
  correctRecog.onerror  = () => { correctRecording.value = false }
  correctRecog.onend    = () => { correctRecording.value = false }
  correctRecog.start(); correctRecording.value = true
}

function saveCorrection() {
  if (!correctText.value.trim()) return
  // Salva uma nova regra de FAQ baseada na mensagem que errou
  if (!props.config.faqItems) props.config.faqItems = []
  const original = activeAuditMsg.value?.text || ''
  props.config.faqItems.push({
    id: Date.now(),
    question: original.substring(0, 60),
    answer: correctText.value.trim(),
    actionType: 'respond',
    notifyTo: [],
    notifyMessage: '',
  })
  correctText.value = ''
  showCorrect.value = false
  // Feedback visual
  const lastMsg = messages.value[messages.value.length - 1]
  if (lastMsg) lastMsg.corrected = true
}

function deleteSource(msg) {
  const audit = msg?.audit
  if (!audit) return
  if (audit.type === 'faq' && audit.faqItem) {
    const idx = props.config.faqItems?.findIndex(f => f === audit.faqItem)
    if (idx > -1) props.config.faqItems.splice(idx, 1)
  } else if (audit.type === 'script' && audit.rule) {
    const idx = props.config.scriptRules?.findIndex(r => r === audit.rule)
    if (idx > -1) props.config.scriptRules.splice(idx, 1)
  }
  showCorrect.value = false
  activeAuditMsg.value = null
}

function addMemberFromPane() {
  const { name, phone } = transferMeta.value.newMember
  if (!name.trim()) return
  const id = Date.now()
  props.config.teamMembers.push({ id, name, phone })
  transferMeta.value.selectedMembers.push(name)
  transferMeta.value.newMember = { name: '', phone: '' }
  showTeamPane.value = false
}

function confirmTransfer() {
  showCorrect.value = false
  correctMode.value = null
  
  if (transferMeta.value.notifyClient && transferMeta.value.clientMsg) {
    messages.value.push({ 
      id: Date.now(), 
      from: 'ai', 
      text: transferMeta.value.clientMsg, 
      time: now(),
      isTool: true
    })
  }

  const names = transferMeta.value.selectedMembers.join(', ')
  messages.value.push({
    id: Date.now() + 1,
    from: 'system',
    type: 'handover',
    contact: names || 'Equipe',
    phone: '',
    message: transferMeta.value.attendantMsg || 'Novo cliente precisa de ajuda!',
    time: now()
  })
  
  scrollBottom()
}

watch(() => props.modelValue, v => { if (v) initChat() })

function closeTestChat() {
  emit('update:modelValue', false)
}

</script>

<template>
  <Transition name="fade">
    <div
      v-if="modelValue"
      class="chat-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="test-chat-title"
      @click.self="closeTestChat"
    >
      
      <div class="split-modal" :class="{ 'split-modal--with-editor': showSidebar }">

        <!-- 1. CHAT PANEL -->
        <div class="chat-modal">
          <div class="chat-header">
            <div class="chat-header__avatar">{{ name[0] }}</div>
            <div class="chat-header__info">
              <div id="test-chat-title" class="chat-header__name">{{ name }}</div>
              <div v-if="config.isPaused" class="chat-header__paused-tag">⏸️ PAUSADA</div>
              <div v-else class="chat-header__sub">simulação de conversa</div>
            </div>
            <div class="chat-header__actions">
              <button
                type="button"
                class="btn-token-toggle"
                :class="{ 'btn-token-toggle--active': !!testKaitsToken }"
                @click="showTokenInput = !showTokenInput"
                :title="testKaitsToken ? 'Token KAITS configurado para o teste' : 'Configurar token KAITS para o teste'"
              >
                Token KAITS
              </button>
              <button type="button" class="btn-exit-test" @click="closeTestChat">
                Sair do teste
              </button>
              <button class="btn-icon" @click="showReset = true" title="Reiniciar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              </button>
            </div>
          </div>

          <Transition name="fade">
            <div v-if="showTokenInput" class="token-panel">
              <div class="token-panel__grid">
                <div class="field-inline">
                  <label class="token-label">Token da API KAITS para o teste</label>
                  <input
                    v-model="testKaitsToken"
                    class="token-input"
                    type="password"
                    placeholder="Cole aqui o token da API da conta de teste"
                  >
                </div>
                <div class="field-inline">
                  <label class="token-label">Identificador do usuário no teste</label>
                  <input
                    v-model="testUserIdentifier"
                    class="token-input"
                    type="text"
                    placeholder="Ex: secretaria@smart.test ou CPF"
                  >
                </div>
              </div>
              <p class="token-help">
                Use esse campo quando quiser testar tools do KAITS com uma conta específica, sem depender do token principal da sessão.
              </p>
            </div>
          </Transition>

          <div class="chat-messages" ref="messagesEl">
            <div v-if="config.isPaused" class="chat-paused-banner">
              ⚠️ A I.A. está pausada para este contato ou globalmente. Ela não responderá o cliente.
            </div>
            <div v-for="msg in messages" :key="msg.id">
              <div v-if="msg.from === 'system' && msg.type === 'handover'" class="system-bubble-wrap">
                <div class="system-bubble handover-bubble">
                  <div class="plane-wrap"><span class="plane-emoji">✈️</span></div>
                  <div class="hb-body">
                    <div class="hb-title">Enviado p/ <strong>{{ msg.contact }}</strong>!</div>
                    <div class="hb-msg">"{{ msg.message }}"</div>
                  </div>
                </div>
              </div>
              <div v-else class="msg-wrapper" :class="{'msg-wrapper--ai': msg.from === 'ai'}">
                <div class="msg" :class="msg.from === 'user' ? 'msg--user' : 'msg--ai'">
                  <div class="msg__bubble" :class="{'msg__bubble--corrected': msg.corrected}">{{ msg.text }}</div>
                  <div class="msg__time">{{ msg.time }}</div>
                </div>
                <div v-if="msg.from === 'ai' && msg.auditSources?.length" class="msg-audit-trigger">
                  <button class="btn-audit-inline" :class="{'active': activeAuditMsg?.id === msg.id}"
                    @click="activeAuditMsg = msg; showCorrect = false">
                    💡 Como ela pensou isso?
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="chat-input" :class="{ 'chat-input--disabled': config.isPaused }">
            <textarea v-model="inputText" @keydown="handleKeydown" :placeholder="config.isPaused ? 'I.A. PAUSADA...' : 'Escreva aqui...'" :disabled="config.isPaused" rows="1"/>
            <button class="chat-send" @click="send" :disabled="!inputText.trim() || config.isPaused">Enviar</button>
          </div>
        </div>

        <!-- 2. KNOWLEDGE PANEL -->
        <div class="knowledge-panel">
          <button class="btn-close-modal" @click="emit('update:modelValue', false)">×</button>
          <Transition name="fade" mode="out-in">
            <div v-if="showCorrect && activeAuditMsg" class="k-panel">
              <button class="btn-back" @click="showCorrect = false">← Voltar</button>
              <h3>Como corrigir?</h3>
              <textarea v-model="correctText" rows="4" placeholder="Escreva a resposta correta..."/>
              <button class="btn-save-correct" @click="saveCorrection">✅ Ensinar resposta</button>
            </div>
            <div v-else-if="activeAuditMsg && activeAuditMsg.auditSources?.length" class="k-panel">
              <button class="btn-back" @click="activeAuditMsg = null">← Voltar p/ o Cérebro</button>
              <h3>Fontes consultadas:</h3>
              <div class="narrative-cards">
                <div v-for="(s, idx) in activeAuditMsg.auditSources" :key="idx" class="n-card" :class="'n-card--' + s.type">
                   <div class="n-card__label">{{ s.headline }}</div>
                   <p class="n-card__text">{{ s.detail }}</p>
                   <blockquote v-if="s.source || s.chunk" class="n-quote">"{{ s.source || s.chunk }}"</blockquote>
                   <button v-if="s.type === 'docs'" class="btn-goto-doc" @click="openInlineEditor(s)">
                     ✏️ Editar fonte paralelo
                   </button>
                </div>
              </div>
              <button class="btn-correct-cta" @click="showCorrect = true">✏️ Quero corrigir essa resposta</button>
            </div>
            <div v-else class="k-panel">
               <h3>Cérebro da {{ name }}</h3>
               <p>O que ela já sabe:</p>
               <ul class="knowledge-list">
                  <li v-if="kPersonality" class="k-item k-item--known">✅ Personalidade</li>
                  <li v-if="kScript" class="k-item k-item--known">✅ Regras do Roteiro</li>
                  <li v-if="kFaq" class="k-item k-item--known">✅ Dúvidas Frequentes</li>
                  <li v-if="kTools" class="k-item k-item--known">✅ Recursos de Ação</li>
               </ul>
            </div>
          </Transition>
        </div>

        <!-- 3. SIDEBAR EDITOR -->
        <aside v-if="showSidebar" class="sidebar-editor">
           <AdvancedDocEditor 
             :doc-id="sidebarDocId" 
             :initial-target="sidebarTarget"
             @close="showSidebar = false"
           />
        </aside>

      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* ── Overlay ─────────────────────────────────────────────── */
.chat-overlay {
  position: fixed; inset: 0; z-index: 99999;
  background: rgba(15,15,30,.88);
  backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  padding: 2rem;
}

/* ── Split Container ─────────────────────────────────────── */
.split-modal {
  display: flex; width: 100%; max-width: 900px; height: 92vh; max-height: 720px;
  background: white; border-radius: var(--r-xl); overflow: hidden;
  box-shadow: 0 24px 80px rgba(0,0,0,.55);
  animation: popUp .3s cubic-bezier(.175,.885,.32,1.15);
}
@keyframes popUp { from { transform: scale(.93); opacity: 0; } to { transform: scale(1); opacity: 1; } }

/* ── Chat ─────────────────────────────────────────────────── */
.chat-modal {
  flex: 1 1 340px; min-width: 0;
  display: flex; flex-direction: column;
  background: #f5f5f7; border-right: 1px solid var(--c-border);
  position: relative;
}
.chat-header {
  display: flex; align-items: center; padding: .85rem 1rem; gap: .65rem;
  background: white; border-bottom: 1px solid var(--c-border); justify-content: space-between;
}
.chat-header__avatar {
  width: 38px; height: 38px; border-radius: 50%;
  background: var(--c-primary); color: white;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 1.1rem; flex-shrink: 0;
}
.chat-header__info { flex: 1; min-width: 0; }
.chat-header__name { font-weight: 600; font-size: .875rem; }
.chat-header__sub  { font-size: .72rem; color: var(--c-text-light); }

.chat-header__actions {
  display: flex;
  align-items: center;
  gap: .35rem;
  flex-shrink: 0;
}
.btn-exit-test {
  font-family: inherit;
  font-size: .78rem;
  font-weight: 700;
  padding: .45rem .75rem;
  border-radius: var(--r-md, 10px);
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #64748b;
  cursor: pointer;
  white-space: nowrap;
  transition: background .15s, border-color .15s, color .15s;
}
.btn-exit-test:hover {
  background: #fef2f2;
  border-color: #fecaca;
  color: #b91c1c;
}
.btn-exit-test:focus-visible {
  outline: 2px solid var(--c-primary);
  outline-offset: 2px;
}
@media (max-width: 520px) {
  .btn-exit-test { padding: .4rem .55rem; font-size: .72rem; }
}

.btn-token-toggle {
  font-family: inherit;
  font-size: .75rem;
  font-weight: 700;
  color: #1d4ed8;
  background: #eff6ff;
  border: 1.5px solid #bfdbfe;
  border-radius: 999px;
  padding: .42rem .7rem;
  cursor: pointer;
  white-space: nowrap;
  transition: .15s;
}
.btn-token-toggle:hover { background: #dbeafe; border-color: #93c5fd; }
.btn-token-toggle--active { background: #dcfce7; border-color: #86efac; color: #166534; }

.token-panel {
  background: #f8fbff;
  border-bottom: 1px solid #dbeafe;
  padding: .85rem 1rem .95rem;
  display: flex;
  flex-direction: column;
  gap: .65rem;
}
.token-panel__grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: .75rem;
}
.field-inline { display: flex; flex-direction: column; gap: .32rem; }
.token-label {
  font-size: .75rem;
  font-weight: 700;
  color: #334155;
}
.token-input {
  width: 100%;
  border-radius: 10px;
  border: 1.5px solid #cbd5e1;
  background: white;
  padding: .65rem .8rem;
  font-family: inherit;
  font-size: .85rem;
}
.token-input:focus {
  outline: none;
  border-color: var(--c-primary);
  box-shadow: 0 0 0 3px rgba(91,95,207,.1);
}
.token-help {
  margin: 0;
  font-size: .76rem;
  line-height: 1.45;
  color: #64748b;
}
@media (max-width: 720px) {
  .token-panel__grid { grid-template-columns: 1fr; }
}

.chat-messages {
  flex: 1; overflow-y: auto; padding: 1.25rem 1rem;
  display: flex; flex-direction: column; gap: .85rem;
}
.msg-wrapper { display: flex; flex-direction: column; width: 100%; }
.msg-wrapper--ai { align-items: flex-start; }

.msg { display: flex; flex-direction: column; max-width: 85%; }
.msg--user { align-self: flex-end; align-items: flex-end; }
.msg--ai   { align-self: flex-start; align-items: flex-start; }
.msg__bubble {
  padding: .65rem .95rem; border-radius: 16px; font-size: .95rem; line-height: 1.5;
  word-break: break-word; box-shadow: 0 1px 2px rgba(0,0,0,.05);
}
.msg--ai   .msg__bubble { background: white; color: var(--c-text); border-bottom-left-radius: 4px; border: 1px solid #e2e8f0; }
.msg--user .msg__bubble { background: var(--c-primary); color: white; border-bottom-right-radius: 4px; }
.msg__bubble--corrected { outline: 2px solid #4ade80; }
.msg__time { font-size: .65rem; color: var(--c-text-light); margin-top: 3px; padding: 0 .2rem; }

/* Botão "Como ela pensou isso?" */
.msg-audit-trigger { margin-top: 3px; }
.btn-audit-inline {
  background: transparent; color: var(--c-text-light); border: none; font-size: .68rem;
  display: flex; align-items: center; gap: .3rem; cursor: pointer; transition: .15s;
  padding: .2rem .45rem; border-radius: 4px; font-family: inherit;
}
.btn-audit-inline:hover { background: #e0e7ff; color: var(--c-primary); }
.btn-audit-inline.active { background: var(--c-primary-dim); color: var(--c-primary); font-weight: 700; }

/* Balão de Handover com Avião */
.system-bubble-wrap { display: flex; justify-content: center; }
.system-bubble { max-width: 90%; border-radius: 16px; padding: .8rem 1rem; margin: .25rem 0; }
.handover-bubble {
  background: linear-gradient(135deg, #f0fdf4, #dcfce7); border: 2px solid #86efac;
  display: flex; align-items: flex-start; gap: .75rem;
  box-shadow: 0 6px 24px rgba(74,222,128,.2);
  animation: slideInSys .5s cubic-bezier(.175,.885,.32,1.15);
}
@keyframes slideInSys { from { opacity:0; transform: translateY(12px) scale(.95);} to { opacity:1; transform: none;}}

/* Avião animado */
.plane-wrap { position: relative; width: 36px; height: 36px; flex-shrink: 0; }
.plane-emoji {
  position: absolute; font-size: 1.6rem; animation: flyPlane 1.2s cubic-bezier(.25,.46,.45,.94) forwards;
  transform-origin: center;
}
@keyframes flyPlane {
  0%  { transform: translate(-20px, 20px) rotate(-35deg) scale(0.5); opacity:0; }
  40% { transform: translate(0px, 0px) rotate(-20deg) scale(1.2); opacity:1; }
  70% { transform: translate(6px, -4px) rotate(-15deg) scale(1); opacity:1; }
  100%{ transform: translate(4px, -2px) rotate(-18deg) scale(1); opacity:1; }
}

.hb-body { flex: 1; font-size: .85rem; color: #166534; display: flex; flex-direction: column; gap: .2rem; }
.hb-title { font-size: .9rem; font-weight: 600; color: #14532d; }
.hb-title strong { color: #052e16; }
.hb-phone { font-size: .75rem; font-family: monospace; color: #166534; }
.hb-msg { margin-top: .3rem; font-style: italic; color: #15803d; font-size: .8rem; background: white; padding: .4rem .6rem; border-radius: 8px; border: 1px dashed #86efac; }
.hb-time { font-size: .6rem; color: #4ade80; flex-shrink: 0; margin-top: 2px; }

/* Typing */
.msg__bubble--typing { display: flex; gap: .4rem; align-items: center; padding: .8rem 1rem; }
.msg__bubble--typing span { width: 6px; height: 6px; border-radius: 50%; background: #aaa; animation: bounce 1s infinite; display: block; }
.msg__bubble--typing span:nth-child(2) { animation-delay: .2s; }
.msg__bubble--typing span:nth-child(3) { animation-delay: .4s; }
@keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-4px)} }

/* Ice Breakers */
.ice-breakers { margin-top: .5rem; }
.ice-breakers__label { font-size: .75rem; color: var(--c-text-light); margin-bottom: .5rem; }
.ice-breakers__chips { display: flex; flex-wrap: wrap; gap: .4rem; }
.ice-chip {
  font-size: .8rem; font-family: inherit; cursor: pointer;
  background: white; color: var(--c-primary);
  border: 1.5px solid #c7d2fe; border-radius: 99px;
  padding: .4rem .85rem; transition: all var(--t-fast);
}
.ice-chip:hover { background: var(--c-primary); color: white; }

/* Input */
.chat-input {
  display: flex; align-items: flex-end; gap: .6rem;
  padding: 1rem; background: white; border-top: 1px solid var(--c-border);
}
.chat-input__text {
  flex: 1; min-height: 48px; max-height: 120px; resize: none;
  border-radius: 24px; padding: .65rem 1.1rem; font-size: 1rem;
  background: #f4f4f6; border-color: transparent;
}
.chat-input__text:focus { border-color: var(--c-primary); outline: none; background: white; box-shadow: 0 0 0 3px rgba(91,95,207,.1); }
.chat-mic, .chat-send {
  width: 44px; height: 44px; border-radius: 50%; border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all var(--t-fast); flex-shrink: 0; margin-bottom: 2px;
}
.chat-mic { background: var(--c-bg); color: var(--c-text-muted); }
.chat-mic:hover { background: #fee2e2; color: #dc2626; }
.chat-mic--recording { background: #fee2e2; color: #dc2626; animation: pulse 1s infinite; }
.chat-send { background: var(--c-primary); color: white; }
.chat-send:hover:not(:disabled) { background: var(--c-primary-dark); }
.chat-send:disabled { opacity: .4; cursor: not-allowed; }
@keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.1)} }

.reset-confirm {
  position: absolute; top: 70px; left: 50%; transform: translateX(-50%);
  background: white; border: 1px solid var(--c-border); border-radius: var(--r-md); padding: .75rem 1rem;
  display: flex; align-items: center; gap: .5rem; box-shadow: var(--shadow-md); font-size: .85rem; font-weight: 500; z-index: 10;
}

/* ── Painel Direito ──────────────────────────────────────── */
.knowledge-panel {
  flex: 0 0 380px; max-width: 380px;
  background: white; padding: 0;
  display: flex; flex-direction: column;
  position: relative; overflow: hidden;
}
.btn-close-modal {
  position: absolute; top: 1rem; right: 1rem; background: transparent; border: none; cursor: pointer;
  color: #94a3b8; padding: .5rem; border-radius: 50%; transition: background .2s; z-index: 5;
}
.btn-close-modal:hover { background: #f1f5f9; color: #0f172a; }

/* Painel genérico */
.k-panel {
  flex: 1; overflow-y: auto; padding: 2rem 1.75rem;
  display: flex; flex-direction: column; gap: 1.5rem;
}
.btn-back {
  font-size: .8rem; color: var(--c-primary); font-weight: 700; cursor: pointer;
  display: inline-block; padding: .2rem 0; border: none; background: none; font-family: inherit;
}
.btn-back:hover { text-decoration: underline; }

/* ─── CÉREBRO (default) ─── */
.brain-header { display: flex; flex-direction: column; align-items: flex-start; padding-top: 2rem; }
.brain-emoji { font-size: 2.5rem; margin-bottom: .5rem; }
.brain-header h3 { font-size: 1.3rem; font-weight: 800; color: #1e293b; margin: 0 0 .3rem; }
.brain-header p  { font-size: .9rem; color: #64748b; }

.knowledge-list { list-style: none; display: flex; flex-direction: column; gap: .85rem; }
.k-item { display: flex; align-items: flex-start; gap: .85rem; padding: .9rem 1rem; border-radius: var(--r-md); }
.k-item--known { background: #f0fdf4; border: 1px solid #bbf7d0; }
.k-item--missing { background: #fff1f2; border: 1px dashed #fecdd3; }
.k-icon { font-size: 1.3rem; line-height: 1; flex-shrink: 0; }
.k-text { display: flex; flex-direction: column; gap: .15rem; }
.k-item--known .k-text strong { color: #166534; font-size: .95rem; }
.k-item--known .k-text span { color: #15803d; font-size: .8rem; }
.k-item--missing .k-text strong { color: #9f1239; font-size: .95rem; }
.k-item--missing .k-text span { color: #be123c; font-size: .8rem; }
.brain-tip { background: #fefce8; border: 1px dashed #fde047; border-radius: var(--r-md); padding: .85rem 1rem; font-size: .85rem; color: #713f12; margin-top: auto; }

/* ─── NARRATIVA LÚDICA ─── */
.narrative-header { display: flex; flex-direction: column; align-items: flex-start; padding-top: 2rem; }
.narrative-emoji { font-size: 2.2rem; margin-bottom: .5rem; }
.narrative-header h3 { font-size: 1.15rem; font-weight: 800; color: #1e293b; line-height: 1.4; margin: 0; }
.narrative-header h3 em { font-style: normal; color: var(--c-primary); }

.narrative-cards { display: flex; flex-direction: column; gap: 1rem; }

/* Cada cartão narrativo */
.n-card {
  display: flex; gap: .85rem; padding: 1.1rem 1rem;
  border-radius: var(--r-md); box-shadow: var(--shadow-sm);
}
.n-card__icon { font-size: 1.8rem; flex-shrink: 0; line-height: 1; }
.n-card__body { display: flex; flex-direction: column; gap: .45rem; }
.n-card__label { font-size: .68rem; font-weight: 800; text-transform: uppercase; letter-spacing: .07em; }
.n-card__text  { font-size: .9rem; color: #334155; line-height: 1.5; }
.n-card__text strong { font-weight: 700; }

/* Cores por tipo */
.n-card--faq     { background: #fffbeb; border: 2px solid #fde047; }
.n-card--faq     .n-card__label { color: #854d0e; }
.n-card--script  { background: #f0fdf4; border: 2px solid #86efac; }
.n-card--script  .n-card__label { color: #166534; }
.n-card--docs    { background: #eff6ff; border: 2px solid #93c5fd; }
.n-card--docs    .n-card__label { color: #1e40af; }
.n-card--tool    { background: #fdf4ff; border: 2px solid #d8b4fe; }
.n-card--tool    .n-card__label { color: #7e22ce; }
.n-card--fallback { background: #fff1f2; border: 2px dashed #fca5a5; }
.n-card--fallback .n-card__label { color: #9f1239; }

.n-quote {
  font-size: .9rem; font-style: italic; line-height: 1.5; padding: .6rem .9rem;
  border-radius: 8px; margin: 0;
}
.n-quote--faq    { background: #fef9c3; border-left: 3px solid #facc15; color: #78350f; }
.n-quote--script { background: #dcfce7; border-left: 3px solid #4ade80; color: #14532d; }
.n-quote--docs   { background: #dbeafe; border-left: 3px solid #60a5fa; color: #1e3a8a; font-family: Georgia, serif; }

.n-doc-badge {
  display: inline-flex; align-items: center; gap: .3rem;
  background: #dbeafe; color: #1d4ed8; font-size: .78rem; font-weight: 700;
  padding: .25rem .65rem; border-radius: 99px; border: 1px solid #93c5fd;
}

/* ─── ESTILOS DO SELETOR AVANÇADO ─── */
.correct-editor--transfer { display: flex; flex-direction: column; gap: 1.25rem; }
.ce-section { display: flex; flex-direction: column; gap: .5rem; }
.ce-row-header { display: flex; align-items: center; justify-content: space-between; }
.btn-link-sm { background: none; border: none; color: var(--c-primary); font-size: .78rem; font-weight: 700; cursor: pointer; padding: 0; text-decoration: underline; }
.btn-link-sm:hover { color: var(--c-primary-dark); }

.ce-members-grid { display: flex; flex-wrap: wrap; gap: .5rem; }
.ce-member-chip {
  display: flex; align-items: center; gap: .4rem; padding: .4rem .7rem;
  background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 99px;
  font-size: .82rem; cursor: pointer; transition: all .2s;
}
.ce-member-chip:hover { border-color: var(--c-primary); }
.ce-member-chip--active { background: var(--c-primary-dim); border-color: var(--c-primary); color: var(--c-primary); }
.ce-member-chip input { display: none; }

.ce-toggle-row { display: flex; align-items: center; gap: .6rem; font-size: .85rem; color: #334155; cursor: pointer; }
.ce-toggle-row strong { color: var(--c-primary); }
.ce-toggle-row input { width: 16px; height: 16px; cursor: pointer; accent-color: var(--c-primary); }

.correct-textarea--sm { font-size: .82rem; padding: .65rem; }

/* ─── TERCEIRA JANELA (TEAM PANE) ─── */
.team-pane {
  position: absolute; top: 0; right: -320px; bottom: 0;
  width: 320px; background: white; border-left: 1px solid var(--c-border);
  box-shadow: 10px 0 40px rgba(0,0,0,0.2); z-index: 100;
  padding: 1.5rem; display: flex; flex-direction: column;
}
.split-modal { overflow: visible !important; } /* Permite ver a janela saindo */

.btn-close-pane {
  position: absolute; top: 1rem; right: 1rem;
  background: #f1f5f9; border: none; width: 28px; height: 28px;
  border-radius: 50%; font-size: 1.2rem; cursor: pointer; color: #64748b;
}

.team-pane-header { margin-bottom: 2rem; }
.tp-emoji { font-size: 2rem; display: block; margin-bottom: .5rem; }
.team-pane-header h3 { font-size: 1.15rem; margin: 0; color: #0f172a; }
.team-pane-header p { font-size: .85rem; color: #64748b; margin: .3rem 0 0; }

.tp-form { display: flex; flex-direction: column; gap: 1.25rem; }
.tp-field { display: flex; flex-direction: column; gap: .4rem; }
.tp-field label { font-size: .8rem; font-weight: 700; color: #334155; }
.tp-field input { padding: .75rem; border: 1.5px solid #e2e8f0; border-radius: 8px; font-size: .9rem; }
.tp-field input:focus { border-color: var(--c-primary); outline: none; box-shadow: 0 0 0 3px var(--c-primary-dim); }

.btn-save-pane {
  background: var(--c-secondary); color: white; border: none;
  padding: .85rem; border-radius: 8px; font-weight: 700; cursor: pointer;
  margin-top: 1rem; transition: transform .2s;
}
.btn-save-pane:hover { transform: translateY(-2px); }
.btn-save-pane:disabled { opacity: .5; transform: none; cursor: not-allowed; }

/* Transição lateral */
.slide-left-enter-active, .slide-left-leave-active { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.slide-left-enter-from, .slide-left-leave-to { opacity: 0; transform: translateX(-30px); }

.n-handover-preview {
  display: flex; flex-direction: column; gap: .3rem; margin-top: .2rem;
}
.n-hp-label { font-size: .75rem; color: #7e22ce; font-weight: 600; }
.n-hp-msg {
  font-style: italic; font-size: .88rem; background: white;
  padding: .5rem .75rem; border-radius: 8px; color: #581c87;
  border: 1px solid #e9d5ff;
}

.btn-correct-cta {
  margin-top: auto;
  display: flex; align-items: center; justify-content: center; gap: .5rem;
  background: linear-gradient(135deg, #f97316, #ec4899);
  color: white; font-family: inherit; font-size: .95rem; font-weight: 700;
  border: none; border-radius: var(--r-md); padding: .85rem 1.5rem;
  cursor: pointer; border-bottom: 4px solid #c2410c;
  transition: .1s; box-shadow: 0 6px 20px rgba(249,115,22,.3);
}
.btn-correct-cta:hover { filter: brightness(1.05); transform: translateY(-2px); }
.btn-correct-cta:active { transform: translateY(2px); border-bottom-width: 1px; }

/* ─── PAINEL DE CORREÇÃO ─── */
.correct-header { display: flex; flex-direction: column; padding-top: 1.5rem; }
.correct-emoji { font-size: 2rem; margin-bottom: .5rem; }
.correct-header h3 { font-size: 1.2rem; font-weight: 800; color: #1e293b; margin: 0 0 .3rem; }
.correct-header p  { font-size: .9rem; color: #64748b; line-height: 1.4; }

.correct-delete-zone { background: #fff1f2; border: 1px dashed #fca5a5; border-radius: var(--r-md); padding: .85rem; }
.correct-delete-label { font-size: .8rem; color: #9f1239; font-weight: 600; margin-bottom: .5rem; }
.btn-delete-source {
  font-family: inherit; font-size: .85rem; font-weight: 600; color: #dc2626;
  background: white; border: 1.5px solid #fca5a5; border-radius: var(--r-sm);
  padding: .45rem .85rem; cursor: pointer; transition: .15s; width: 100%;
}
.btn-delete-source:hover { background: #fee2e2; }

.correct-editor { display: flex; flex-direction: column; gap: .75rem; }
.correct-lbl { font-size: .8rem; font-weight: 700; color: var(--c-text-muted); }
.correct-textarea {
  width: 100%; border-radius: var(--r-md); border: 1.5px solid var(--c-border);
  padding: .75rem 1rem; font-family: inherit; font-size: .95rem; resize: vertical; min-height: 100px;
}
.correct-textarea:focus { border-color: var(--c-primary); box-shadow: 0 0 0 3px rgba(91,95,207,.1); outline: none; }

.correct-actions { display: flex; gap: .75rem; }
.btn-mic-correct {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: .4rem;
  background: #f8fafc; border: 1.5px solid var(--c-border); border-bottom-width: 3px;
  border-radius: var(--r-sm); padding: .6rem; font-family: inherit; font-size: .82rem;
  font-weight: 600; cursor: pointer; color: var(--c-text-muted); transition: .1s;
}
.btn-mic-correct:hover { border-color: var(--c-primary); color: var(--c-primary); }
.btn-mic-correct.recording { background: #fee2e2; color: #dc2626; border-color: #fca5a5; animation: pulse 1s infinite; }
.btn-mic-correct:active { transform: translateY(2px); border-bottom-width: 1px; }

.btn-save-correct {
  flex: 1.5; display: flex; align-items: center; justify-content: center; gap: .5rem;
  background: linear-gradient(135deg, #22c55e, #16a34a); color: white;
  border: none; border-bottom: 3px solid #15803d; border-radius: var(--r-sm);
  padding: .65rem; font-family: inherit; font-size: .9rem; font-weight: 700;
  cursor: pointer; transition: .1s; box-shadow: 0 4px 12px rgba(34,197,94,.3);
}
.btn-save-correct:hover { filter: brightness(1.05); }
.btn-save-correct:active { transform: translateY(2px); border-bottom-width: 1px; }
.btn-save-correct:disabled { opacity: .4; cursor: not-allowed; }

/* Cartões de opção de correção */
.correct-option {
  display: flex; align-items: center; gap: .85rem; padding: .9rem 1rem;
  border: 2px solid var(--c-border); border-radius: var(--r-md);
  cursor: pointer; transition: .15s; background: white;
}
.correct-option:hover { border-color: var(--c-primary); background: #f8f9ff; }
.correct-option--active { border-color: var(--c-primary) !important; background: var(--c-primary-dim) !important; }
.correct-option--danger:hover { border-color: #fca5a5; background: #fff1f2; }
.correct-option--danger.correct-option--active { border-color: #fca5a5 !important; background: #fff1f2 !important; }
.co-icon { font-size: 1.5rem; flex-shrink: 0; }
.co-body { flex: 1; display: flex; flex-direction: column; gap: .1rem; }
.co-body strong { font-size: .9rem; color: #1e293b; font-weight: 700; }
.co-body span    { font-size: .78rem; color: #64748b; }
.co-check { font-size: 1rem; flex-shrink: 0; }

.correct-select {
  width: 100%; border-radius: var(--r-md); border: 1.5px solid var(--c-border);
  padding: .65rem 1rem; font-family: inherit; font-size: .95rem;
}
.correct-select:focus { border-color: var(--c-primary); outline: none; }
.correct-warn { font-size: .8rem; color: #92400e; background: #fef3c7; padding: .5rem .75rem; border-radius: 6px; }
.delete-warn { font-size: .88rem; color: #9f1239; background: #fff1f2; padding: .65rem .85rem; border-radius: 6px; border: 1px dashed #fca5a5; }

.btn-cancel-correct {
  flex: 1; font-family: inherit; font-size: .88rem; font-weight: 600; cursor: pointer;
  background: #f1f5f9; border: 1.5px solid var(--c-border); border-radius: var(--r-sm);
  padding: .65rem; color: var(--c-text-muted); transition: .1s;
}
.btn-cancel-correct:hover { background: #e2e8f0; }
.btn-delete-confirm {
  flex: 1.5; font-family: inherit; font-size: .88rem; font-weight: 700; cursor: pointer;
  background: #dc2626; color: white; border: none; border-bottom: 3px solid #991b1b;
  border-radius: var(--r-sm); padding: .65rem; transition: .1s;
}
.btn-delete-confirm:hover { background: #b91c1c; }
.btn-delete-confirm:active { transform: translateY(2px); border-bottom-width: 1px; }
.btn-goto-doc {
  margin-top: .8rem; align-self: flex-start;
  background: white; border: 1.5px solid var(--c-primary); color: var(--c-primary);
  padding: .45rem .9rem; border-radius: 99px; font-size: .8rem; font-weight: 700;
  cursor: pointer; transition: all .2s;
}
.btn-goto-doc:hover { background: var(--c-primary); color: white; transform: scale(1.05); }
.chat-header__paused-tag { font-size: .6rem; font-weight: 800; color: #ef4444; background: #fee2e2; padding: .1rem .4rem; border-radius: 4px; margin-top: 2px; }

.chat-paused-banner { 
  background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; 
  font-size: .75rem; font-weight: 700; padding: .6rem .8rem; border-radius: 8px;
  margin-bottom: 1rem; text-align: center; border-left: 4px solid #ef4444;
}

.chat-input--disabled { opacity: 0.6; pointer-events: none; }
</style>
