<script setup>
/**
 * HelpAssistant.vue
 * Assistente flutuante que conhece o KAITS
 * Modo Wizard: propõe alterações no config com permissão
 */
import { ref, computed } from 'vue'

const props  = defineProps({ config: Object })
const emit   = defineEmits(['focus-section'])
const isOpen = ref(false)
const inputText   = ref('')
const isRecording = ref(false)
const isThinking  = ref(false)
const messages    = ref([
  { id: 0, from: 'ai', text: 'Olá! Sou especialista em KAITS. O que posso te ajudar a configurar?' }
])
const wizardProposal = ref(null)  // { text, action }
let recognition = null
let nextId = 1

// Base de conhecimento KAITS — respostas hardcoded por intenção
const knowledge = [
  { keys: ['faq', 'pergunta frequente', 'dúvida', 'resposta pronta'],
    answer: 'Para adicionar uma pergunta frequente, abra o card "Dúvidas frequentes (FAQ)" e clique em "+ Adicionar pergunta". Você define o que a I.A. deve responder ou quem deve ser notificado.',
    intent: 'faq' },
  { keys: ['personalidade', 'tom', 'jeito', 'comportamento', 'emoji', 'linguagem'],
    answer: 'A seção "Personalidade" define o tom de voz da I.A. Você pode usar os exemplos rápidos (Amigável, Formal, Especialista) ou escrever livremente.',
    intent: 'personality' },
  { keys: ['saudação', 'primeira mensagem', 'oi', 'olá', 'boas-vindas'],
    answer: 'A primeira mensagem está no card "Roteiro de conversa", no campo "Primeira mensagem enviada pela I.A.". Você pode personalizar com o nome da escola e emojis.' },
  { keys: ['turma', 'matéria', 'horário', 'consultar', 'buscar dado'],
    answer: 'Em "O que a I.A. pode consultar?", ative a ferramenta desejada. Quando marcada, você define o Gatilho (quando a I.A. deve usar aquela consulta).' },
  { keys: ['notificação', 'aviso', 'pessoa', 'equipe', 'contato', 'telefone'],
    answer: 'Primeiro cadastre sua equipe no card "Equipe & Contatos". Depois, quando criar uma resposta de FAQ, escolha "Notificar" e selecione quem deve receber o aviso.',
    intent: 'team' },
  { keys: ['chave', 'conexão', 'integração', 'token', 'api'],
    answer: 'A "Chave de Conexão" fica no último card. Peça à equipe KAITS o valor e cole lá. Isso permite que a I.A. leia seus dados em tempo real.' },
  { keys: ['roteiro', 'fluxo', 'jornada', 'conversa', 'regra'],
    answer: 'No card "Roteiro de conversa", além da saudação inicial, você pode adicionar Regras: define o que o cliente disse e o que a I.A. deve responder.  +  Regra de conversa.' },
  { keys: ['nome', 'assistente', 'chamar', 'sofia', 'como chama'],
    answer: 'Você pode dar um nome à sua assistente! No card "Personalidade", no campo "Nome da assistente", escreva o nome desejado (ex: Sofia, Ana...).' },
]

import { aiService } from '../services/api.js'

function sendMessage() {
  const text = inputText.value.trim()
  if (!text) return
  inputText.value = ''
  messages.value.push({ id: nextId++, from: 'user', text })

  isThinking.value = true
  // Chama a I.A Real no Backend (Modo Construtor)
  aiService.teachByInstruction(text).then(res => {
    isThinking.value = false
    if (res.status === 'proposal') {
      // IA propõe uma mudança, mas não aplica sozinha
      messages.value.push({ id: nextId++, from: 'ai', text: res.message })
      
      // Armazena a proposta para confirmação do usuário
      wizardProposal.value = {
        text: `Deseja que eu atualize: ${res.changes.join(', ')}?`,
        patch: res.patch,
        focus: res.focus_section
      }

      // Direciona o foco visual para o usuário ver onde será a mudança
      if (res.focus_section) {
        emit('focus-section', res.focus_section)
      }
    } else if (res.status === 'needs_more_info') {
      messages.value.push({ id: nextId++, from: 'ai', text: `🧐 ${res.message}` })
    } else {
      messages.value.push({ id: nextId++, from: 'ai', text: 'Não consegui identificar uma mudança clara. Pode detalhar melhor?' })
    }
  }).catch(err => {
    messages.value.push({ id: nextId++, from: 'ai', text: 'Tive um problema para processar sua alteração.' })
  })
}

function approveWizard() {
  if (wizardProposal.value?.focus) {
    emit('focus-section', wizardProposal.value.focus)
  }
  messages.value.push({
    id: nextId++,
    from: 'ai',
    text: '✅ Anotado! Preencha os campos manualmente no painel à esquerda.',
  })
  wizardProposal.value = null
}

function denyWizard() {
  wizardProposal.value = null
  messages.value.push({ id: nextId++, from: 'ai', text: 'Sem problema! Me diga o que mais posso ajudar.' })
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
}

function toggleRecording() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) { alert('Use o Chrome para gravação de voz.'); return }
  if (isRecording.value) { recognition?.stop(); isRecording.value = false; return }
  recognition = new SR(); recognition.lang = 'pt-BR'; recognition.continuous = false
  recognition.onresult = e => { inputText.value = e.results[0][0].transcript; isRecording.value = false }
  recognition.onerror = recognition.onend = () => { isRecording.value = false }
  recognition.start(); isRecording.value = true
}
</script>

<template>
  <!-- Botão flutuante -->
  <button class="fab" @click="isOpen = !isOpen" :class="{ 'fab--open': isOpen }">
    <svg v-if="!isOpen" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
    <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
    <span v-if="!isOpen">Ajuda</span>
  </button>

  <!-- Painel deslizante -->
  <Transition name="slide-right">
    <div v-if="isOpen" class="assist-panel">

      <div class="assist-header">
        <div class="assist-header__info">
          <span class="assist-header__dot" />
          <div>
            <div class="assist-header__title">Assistente KAITS</div>
            <div class="assist-header__sub">Especialista em configuração</div>
          </div>
        </div>
      </div>

      <!-- Chat -->
      <div class="assist-messages">
        <div v-for="msg in messages" :key="msg.id"
             class="assist-msg" :class="msg.from === 'user' ? 'assist-msg--user' : 'assist-msg--ai'">
          {{ msg.text }}
        </div>
        <div v-if="isThinking" class="assist-msg assist-msg--ai assist-msg--thinking">
          <span class="dot"></span><span class="dot"></span><span class="dot"></span>
        </div>
      </div>

      <!-- Proposta wizard -->
      <Transition name="fade">
        <div v-if="wizardProposal" class="wizard-proposal">
          <p class="wizard-proposal__text">✨ {{ wizardProposal.text }}</p>
          <div class="wizard-proposal__actions">
            <button class="btn btn-primary" style="font-size:.78rem;padding:.4rem .8rem" @click="approveWizard">
              Ir ao campo
            </button>
            <button class="btn btn-ghost" style="font-size:.78rem;padding:.4rem .8rem" @click="denyWizard">
              Não, obrigado
            </button>
          </div>
        </div>
      </Transition>

      <!-- Input -->
      <div class="assist-input">
        <button class="chat-mic" :class="{ 'chat-mic--recording': isRecording }" @click="toggleRecording">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <rect x="9" y="2" width="6" height="11" rx="3"/>
            <path d="M19 10a7 7 0 0 1-14 0"/><line x1="12" y1="19" x2="12" y2="22"/>
          </svg>
        </button>
        <input v-model="inputText" @keydown="handleKey" placeholder="Pergunte ou grave..." />
        <button class="chat-send" @click="sendMessage">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* ── FAB ─────────────────────────────────────────────────── */
.fab {
  position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 300;
  display: flex; align-items: center; gap: .45rem;
  background: var(--c-primary); color: white;
  border: none; border-radius: 99px;
  padding: .65rem 1rem; cursor: pointer;
  font-family: inherit; font-size: .8125rem; font-weight: 600;
  box-shadow: 0 4px 20px rgba(91,95,207,.4);
  transition: all var(--t-fast);
  animation: fabPulse 3s infinite;
}
.fab:hover { background: var(--c-primary-dark); transform: translateY(-2px); }
.fab--open { padding: .65rem; animation: none; }
@keyframes fabPulse { 0%,100%{box-shadow:0 4px 20px rgba(91,95,207,.4)} 50%{box-shadow:0 4px 28px rgba(91,95,207,.7)} }

/* ── Panel ───────────────────────────────────────────────── */
.assist-panel {
  position: fixed; top: 0; right: 0; bottom: 0; z-index: 299;
  width: 340px; display: flex; flex-direction: column;
  background: white; border-left: 1px solid var(--c-border);
  box-shadow: -8px 0 32px rgba(0,0,0,.1);
}

.assist-header {
  padding: .9rem 1rem; border-bottom: 1px solid var(--c-border);
  background: var(--c-primary-dim);
}
.assist-header__info { display: flex; align-items: center; gap: .65rem; }
.assist-header__dot {
  width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
  background: #22c55e; box-shadow: 0 0 8px #22c55e;
}
.assist-header__title { font-weight: 600; font-size: .875rem; }
.assist-header__sub   { font-size: .72rem; color: var(--c-text-muted); }

/* ── Messages ────────────────────────────────────────────── */
.assist-messages {
  flex: 1; overflow-y: auto; padding: .85rem;
  display: flex; flex-direction: column; gap: .55rem;
}
.assist-msg {
  max-width: 86%; padding: .55rem .8rem;
  border-radius: 14px; font-size: .82rem; line-height: 1.5;
}
.assist-msg--ai {
  align-self: flex-start; background: #f4f4f8; color: var(--c-text);
  border-bottom-left-radius: 4px;
}
.assist-msg--user {
  align-self: flex-end; background: var(--c-primary); color: white;
  border-bottom-right-radius: 4px;
}
.assist-msg--thinking { display: flex; gap: 3px; padding: .4rem .6rem; }
.assist-msg--thinking .dot { width: 5px; height: 5px; background: #94a3b8; border-radius: 50%; animation: thinking 1.4s infinite; }
.assist-msg--thinking .dot:nth-child(2) { animation-delay: 0.2s; }
.assist-msg--thinking .dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes thinking { 0%,100% { transform: translateY(0); opacity: 0.4; } 50% { transform: translateY(-4px); opacity: 1; } }

/* ── Wizard proposal ─────────────────────────────────────── */
.wizard-proposal {
  margin: 0 .85rem .75rem;
  background: #fffbeb; border: 1.5px solid #fde68a;
  border-radius: var(--r-md); padding: .75rem;
  display: flex; flex-direction: column; gap: .6rem;
}
.wizard-proposal__text { font-size: .82rem; font-weight: 500; color: #78350f; }
.wizard-proposal__actions { display: flex; gap: .45rem; }

/* ── Input ───────────────────────────────────────────────── */
.assist-input {
  display: flex; align-items: center; gap: .4rem;
  padding: .65rem .85rem; border-top: 1px solid var(--c-border);
}
.assist-input input {
  flex: 1; border-radius: 99px; padding: .4rem .8rem;
  background: var(--c-bg); border-color: transparent;
  font-size: .82rem; min-height: 0;
}
.chat-mic, .chat-send {
  width: 32px; height: 32px; border-radius: 50%; border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  transition: all var(--t-fast);
}
.chat-mic { background: var(--c-bg); color: var(--c-text-muted); }
.chat-mic--recording { background: #fee2e2; color: #dc2626; animation: pulse 1s infinite; }
.chat-send { background: var(--c-primary); color: white; }
.chat-send:hover { background: var(--c-primary-dark); }
@keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.1)} }
</style>
