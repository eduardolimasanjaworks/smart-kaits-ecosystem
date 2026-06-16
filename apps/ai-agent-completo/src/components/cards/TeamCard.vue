<script setup>
/**
 * cards/TeamCard.vue
 * "Quem é sua equipe?" — Cadastro de membros e configuração de handover
 */
import { ref, computed } from 'vue'
import DidacticFieldModal from '../DidacticFieldModal.vue'

const props = defineProps({
  config: Object,
  onboardingMode: { type: Boolean, default: false },
  onboardingMicroStep: { type: Number, default: 0 },
})

let nextId = 100

const modalAttendant = ref(false)
const modalClient = ref(false)

const previewVars = computed(() => ({
  whatsapp_cliente: '(11) 98765-4321',
  resumo_conversa:
    'Cliente perguntou sobre matrícula 2026; a I.A. não tinha o valor na base.',
  nome_atendente: props.config.fallbackContact || 'Maria',
}))

const EXAMPLE_ATTENDANT =
  '🔔 Novo atendimento!\nCliente: {whatsapp_cliente}\nResumo: {resumo_conversa}\nPor favor, responda pelo WhatsApp.'

const EXAMPLE_CLIENT =
  'Vou te encaminhar para {nome_atendente} da nossa equipe. Um momento! 😊'

const VAR_ATTENDANT = [
  { key: 'whatsapp_cliente', label: '📲 WhatsApp do cliente' },
  { key: 'resumo_conversa', label: '📝 Resumo da conversa' },
]

const VAR_CLIENT = [
  { key: 'nome_atendente', label: '👤 Nome do atendente' },
  { key: 'resumo_conversa', label: '📝 Resumo da conversa' },
]

function addMember() {
  props.config.teamMembers.push({ id: nextId++, name: '', phone: '' })
}

function removeMember(id) {
  props.config.teamMembers.splice(
    props.config.teamMembers.findIndex(m => m.id === id), 1
  )
  props.config.faqItems?.forEach(item => {
    if (item.notifyTo) item.notifyTo = item.notifyTo.filter(mid => mid !== id)
  })
  if (!props.config.teamMembers.find(m => m.name === props.config.fallbackContact)) {
    props.config.fallbackContact = ''
  }
}

function messagePreview(text) {
  if (!text?.trim()) return 'Nenhuma mensagem configurada ainda.'
  let out = text
  const map = previewVars.value
  out = out.replaceAll('{whatsapp_cliente}', map.whatsapp_cliente)
  out = out.replaceAll('{resumo_conversa}', map.resumo_conversa)
  out = out.replaceAll('{nome_atendente}', map.nome_atendente)
  return out.length > 120 ? out.slice(0, 117) + '…' : out
}
</script>

<template>
  <div class="team">
    <p v-if="onboardingMode" class="team-part-chip">
      Parte {{ onboardingMicroStep + 1 }} de 2 ·
      {{ onboardingMicroStep === 0 ? 'Pessoas da equipe' : 'Transferência para humano' }}
    </p>

    <p v-if="!onboardingMode" class="team__intro">
      Cadastre as pessoas da sua equipe. Esses contatos podem receber avisos quando a I.A. não souber responder.
    </p>

    <div v-show="!onboardingMode || onboardingMicroStep === 0">
    <TransitionGroup name="fade" tag="div" class="team-list">
      <div v-for="(member, idx) in config.teamMembers" :key="member.id" class="member-row">
        <span class="badge-count">{{ idx + 1 }}</span>
        <div class="member-row__fields">
          <input v-model="member.name" placeholder="Nome (ex: Maria)" />
          <input v-model="member.phone" placeholder="WhatsApp (ex: 11999001122)" type="tel" />
        </div>
        <button class="btn-icon" @click="removeMember(member.id)" title="Remover">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </TransitionGroup>

    <p v-if="!config.teamMembers.length" class="team__empty">Nenhum membro cadastrado ainda.</p>

    <button class="btn btn-add" @click="addMember">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      Adicionar pessoa da equipe
    </button>
    </div>

    <div
      v-if="config.teamMembers.length > 0"
      v-show="!onboardingMode || onboardingMicroStep === 1"
      class="handover-section"
    >
      <div class="handover-bg">

        <div class="hf-block">
          <label class="label hf-label">🤝 Eu não deduzo ou invento informações. Caso eu ainda não tenha aprendido algo, encaminho a pessoa pra quem?</label>
          <select v-model="config.fallbackContact" class="fallback-select">
            <option value="" disabled>Escolher um humano...</option>
            <option v-for="member in config.teamMembers" :key="member.id" :value="member.name">
              👤 {{ member.name || 'Sem nome' }}
            </option>
          </select>
        </div>

        <template v-if="config.fallbackContact">

          <div class="hf-block">
            <label class="label hf-label">📱 Mensagem para <strong>{{ config.fallbackContact }}</strong> (WhatsApp do atendente)</label>
            <p class="hf-lead">
              Quando a I.A. transferir, este texto é enviado para o WhatsApp de <strong>{{ config.fallbackContact }}</strong>.
              Use <code v-pre>{whatsapp_cliente}</code> para o número do cliente e <code v-pre>{resumo_conversa}</code> para o que foi conversado.
            </p>
            <div class="hf-summary">
              <p class="hf-summary__text">{{ messagePreview(config.fallbackMessage) }}</p>
              <button type="button" class="btn-configure-msg" @click="modalAttendant = true">
                Configurar mensagem
              </button>
            </div>
          </div>

          <div class="hf-block">
            <label class="label hf-label">💬 O que a I.A. diz ao <strong>cliente</strong> antes de transferir</label>
            <p class="hf-lead">
              O cliente vê esta mensagem no WhatsApp dele. Use <code v-pre>{nome_atendente}</code> para o nome de quem vai atender.
            </p>
            <div class="hf-summary">
              <p class="hf-summary__text">{{ messagePreview(config.fallbackUserMessage) }}</p>
              <button type="button" class="btn-configure-msg" @click="modalClient = true">
                Configurar mensagem
              </button>
            </div>
          </div>

          <div class="hf-block hf-toggle-block">
            <label class="toggle-row">
              <input type="checkbox" v-model="config.pauseAiOnHandover" class="toggle-input" />
              <span class="toggle-slider"></span>
              <div class="toggle-text">
                <strong>Pausar a I.A. após transferir</strong>
                <span>Enquanto {{ config.fallbackContact }} está respondendo, eu paro de falar automaticamente.</span>
              </div>
            </label>
          </div>

        </template>

      </div>
    </div>

    <DidacticFieldModal
      v-model:open="modalAttendant"
      v-model="config.fallbackMessage"
      title="Mensagem para o atendente"
      :subtitle="`Este texto vai para o WhatsApp de ${config.fallbackContact || 'quem você escolheu'} quando um cliente precisar de ajuda humana.`"
      :example-text="EXAMPLE_ATTENDANT"
      :variables="VAR_ATTENDANT"
      :preview-vars="previewVars"
    />

    <DidacticFieldModal
      v-model:open="modalClient"
      v-model="config.fallbackUserMessage"
      title="Mensagem para o cliente"
      subtitle="A I.A. envia isto ao cliente no WhatsApp dele, logo antes de passar o atendimento para um humano."
      :example-text="EXAMPLE_CLIENT"
      :variables="VAR_CLIENT"
      :preview-vars="previewVars"
    />

  </div>
</template>

<style scoped>
.team { display: flex; flex-direction: column; gap: .65rem; }
.team-part-chip {
  font-size: 0.75rem;
  font-weight: 700;
  color: #0d9488;
  background: #f0fdfa;
  border-radius: 8px;
  padding: 0.4rem 0.6rem;
  margin: 0 0 0.15rem;
}
.team__intro { font-size: .8rem; color: var(--c-text-muted); }
.team__empty { font-size: .8rem; color: var(--c-text-light); font-style: italic; }
.team-list { display: flex; flex-direction: column; gap: .4rem; }

.member-row { display: flex; align-items: center; gap: .5rem; }
.member-row__fields { display: grid; grid-template-columns: 1fr 1fr; gap: .4rem; flex: 1; }

@media (max-width: 600px) {
  .member-row__fields { grid-template-columns: 1fr; }
}

.handover-section { margin-top: 1rem; border-top: 1px dashed var(--c-border); padding-top: 1rem; }
.handover-bg { background: #f0fdfa; border-left: 3px solid #14b8a6; padding: .9rem 1rem; border-radius: var(--r-sm); display: flex; flex-direction: column; gap: 1.1rem; }

.hf-block { display: flex; flex-direction: column; gap: .35rem; }
.hf-label { color: #0f766e; font-size: .82rem; text-transform: none; font-weight: 600; line-height: 1.4; margin: 0; }
.hf-label strong { color: #065f46; }
.hf-lead { font-size: .78rem; color: #0d9488; line-height: 1.45; margin: 0 0 0.25rem; }
.hf-lead code { font-size: .72rem; background: white; padding: 0.1rem 0.3rem; border-radius: 4px; }

.fallback-select { background: white; border-color: #99f6e4; color: #115e59; font-weight: 600; cursor: pointer; }
.fallback-select:focus { box-shadow: 0 0 0 3px rgba(20,184,166,.15); border-color: #14b8a6; }

.hf-summary {
  background: white;
  border: 1.5px solid #99f6e4;
  border-radius: 10px;
  padding: 0.65rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.hf-summary__text { font-size: 0.8rem; color: #334155; line-height: 1.45; margin: 0; white-space: pre-wrap; }
.btn-configure-msg {
  align-self: flex-start;
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  color: #0d9488;
  background: #f0fdfa;
  border: 1.5px solid #5eead4;
  border-radius: 8px;
  padding: 0.35rem 0.75rem;
  cursor: pointer;
}
.btn-configure-msg:hover { background: #ccfbf1; }

.hf-toggle-block { border-top: 1px dashed #99f6e4; padding-top: .85rem; margin-top: .25rem; }
.toggle-row { display: flex; align-items: flex-start; gap: .75rem; cursor: pointer; }
.toggle-input { display: none; }
.toggle-slider {
  position: relative; min-width: 40px; height: 22px; background: #cbd5e1;
  border-radius: 99px; transition: .2s; flex-shrink: 0; margin-top: 2px;
}
.toggle-slider::after {
  content: ''; position: absolute; top: 3px; left: 3px;
  width: 16px; height: 16px; background: white; border-radius: 50%; transition: .2s;
  box-shadow: 0 1px 4px rgba(0,0,0,.2);
}
.toggle-input:checked + .toggle-slider { background: #14b8a6; }
.toggle-input:checked + .toggle-slider::after { transform: translateX(18px); }
.toggle-text { display: flex; flex-direction: column; gap: .15rem; }
.toggle-text strong { font-size: .88rem; color: #0f766e; }
.toggle-text span { font-size: .78rem; color: #0d9488; }
</style>
