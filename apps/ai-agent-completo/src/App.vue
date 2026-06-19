<script setup>
/**
 * App.vue v7
 * Oculta o footer do onboarding se o TestChat ou Modal de Exit estiverem abertos.
 */
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import OnboardingModal from './components/OnboardingModal.vue'
import ConfigPanel     from './components/ConfigPanel.vue'
import PreviewPanel    from './components/PreviewPanel.vue'
import TestChatModal   from './components/TestChatModal.vue'
import HelpAssistant   from './components/HelpAssistant.vue'
// import { chatwootService } from './services/api.js'
// Chatwoot (aba Conversas + iframe) desativados — reative o import e o bloco em onMounted se precisar de novo.
import AdvancedDocEditor from './components/modals/AdvancedDocEditor.vue'
import { configService, authService, whatsappService } from './services/api.js'
import {
  consumeAccessTokenFromHash,
  createEmbedPostMessageHandler,
  isEmbeddedInIframe
} from './embed/embedAuth.js'
import { devLog } from './utils/devLog.js'
import { useSchoolRealtime } from './composables/useSchoolRealtime.js'
import { evaluateConfigCompletion } from './composables/useConfigCompletion.js'
import { microLabelsForSection } from './onboarding/microStepLabels.js'

const buildId = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev'

const showModal = ref(true)
const showTestChat = ref(false)
const showAdvancedEditor = ref(false)
const editorDocId = ref(null)
const editorTarget = ref(null)

const onboardingMode = ref(false)
const activeSection  = ref(null)
const stepsOrder = ['company', 'personality', 'team', 'faq', 'docs', 'tools']
const ONBOARDING_MICRO_STEPS = {
  company: 1,
  personality: 3,
  team: 2,
  faq: 1,
  docs: 1,
  tools: 1,
}
const currentStepIndex = ref(0)
const onboardingMicroStep = ref(0)
const currentStepId = computed(() => onboardingMode.value ? stepsOrder[currentStepIndex.value] : activeSection.value)

const showExitModal = ref(false)
const showWhatsAppModal = ref(false)
const showDisconnectConfirm = ref(false)
const showPotentialTip = ref(false)
/** URL `#whatsapp` ou `#/whatsapp` — página só QR (uma aba anónima por escola). */
const whatsappStandalone = ref(false)
const whatsappStatus = ref('desconectado') // 'conectado' | 'desconectado' | 'conectando'

// ── Chatwoot / iframe (código legado comentado; descomente para reativar a aba Conversas) ──
// const chatwootIframeNonce = ref(Date.now())
// const chatwootIframeSrc = 'https://chat.techfala.com.br'
// function refreshChatwootIframe() { chatwootIframeNonce.value = Date.now() }

function openExitModal() { showExitModal.value = true }
function cancelExit() { showExitModal.value = false }
function confirmExit() {
  showExitModal.value = false
  onboardingMode.value = false
  activeSection.value = null
}

function closeWhatsAppModal() {
  showWhatsAppModal.value = false
  showDisconnectConfirm.value = false
}

function markLocalConfigEdit() {
  lastLocalEditAt.value = Date.now()
}

const agentConfig = ref({
  assistantName: '', personality: '',
  greeting: 'Olá! Seja bem-vindo à [Nome da Escola] 😊 Como posso te ajudar?',
  companyContext: '',
  teamMembers: [], faqItems: [],
  fallbackContact: '', docs: [], fallbackMessage: '',
  tools: {
    consultCourses: false, consultCoursesTriggers: [],
    consultStages: false, consultStagesTriggers: [],
    consultClasses: false, consultClassesTriggers: [],
    consultClassSchedule: false, consultClassScheduleTriggers: [],
    consultPricing: false, consultPricingTriggers: [],
    listClassStudents: false, listClassStudentsTriggers: [],
    checkSchedule: false, checkScheduleTriggers: [],
    scheduleQ1: 'Qual o ano escolar?', scheduleQ2: 'Qual o turno?',
    getStudentDetails: false, getStudentDetailsTriggers: [],
    consultCourseProgram: false, consultCourseProgramTriggers: [],
    consultTeachers: false, consultTeachersTriggers: [],
    consultDocuments: false, consultDocumentsTriggers: [],
    enrollStudent: false, enrollStudentTriggers: [],
    checkFinancial: false, checkFinancialTriggers: [],
  },
  apiToken: '',
  isPaused: false,
})

const qrCodeBase64 = ref(null)
const waPairingCode = ref('')
const waQrHint = ref('')
const waAlreadyConnected = ref(false)
const isFetchingQR = ref(false)
const isCheckingWaConnection = ref(false)

/** loading | ready | support — até GET /me/config com sucesso */
const bootstrapStatus = ref('loading')
const connectionSupportHint = ref('')
/** Dentro do iframe: aguardando postMessage / fragment do portal */
const embedWaiting = ref(false)

/** Evita autosave quando config é aplicado via WebSocket (mesma aba recebe o broadcast). */
const suppressConfigAutosave = ref(false)
const lastLocalEditAt = ref(0)
const skipConfigRefreshUntil = ref(0)
const realtimeGuards = { lastLocalEditAt, skipRefreshUntil: skipConfigRefreshUntil }

useSchoolRealtime(agentConfig, bootstrapStatus, suppressConfigAutosave, realtimeGuards)

const isEmbedded = computed(() => isEmbeddedInIframe())
const headerZoom = ref(Number(localStorage.getItem('smart_header_zoom') || '1'))

function setHeaderZoom(nextZoom) {
  const normalized = Math.min(1.15, Math.max(0.9, Number(nextZoom.toFixed(2))))
  headerZoom.value = normalized
  localStorage.setItem('smart_header_zoom', String(normalized))
}

function changeHeaderZoom(delta) {
  setHeaderZoom(headerZoom.value + delta)
}

function resetHeaderZoom() {
  setHeaderZoom(1)
}

/** URL direta sem token: obrigatório slug + senha da escola (sem login demo partilhado). */
const loginSlug = ref('')
const loginPassword = ref('')
const loginBusy = ref(false)
const loginError = ref('')

/** Se true no build: fora do iframe, sem token → só tela de suporte (sem login slug/senha). */
const requireEmbedOnly = import.meta.env.VITE_REQUIRE_EMBED === 'true'

const EMBED_AUTH_WAIT_MS = 30000
let embedAuthTimer = null
/** referência para remover listener no unmount */
let embedMessageHandler = null

const WA_STATUS_POLL_MS = 30000
let waStatusIntervalId = null

/** Renova o QR na página `#whatsapp` ou no modal, enquanto não houver sessão aberta. */
const WA_QR_AUTO_REFRESH_MS = Number(import.meta.env.VITE_WHATSAPP_QR_REFRESH_MS) || 45000
let waQrAutoRefreshTimerId = null

function stopWaQrAutoRefresh() {
  if (waQrAutoRefreshTimerId) {
    clearInterval(waQrAutoRefreshTimerId)
    waQrAutoRefreshTimerId = null
  }
}

function maybeStartWaQrAutoRefresh() {
  stopWaQrAutoRefresh()
  if (bootstrapStatus.value !== 'ready') return
  const visible = whatsappStandalone.value || showWhatsAppModal.value
  if (!visible) return
  if (whatsappStatus.value === 'conectado' || waAlreadyConnected.value) return
  waQrAutoRefreshTimerId = setInterval(() => {
    if (bootstrapStatus.value !== 'ready') {
      stopWaQrAutoRefresh()
      return
    }
    if (whatsappStatus.value === 'conectado' || waAlreadyConnected.value) {
      stopWaQrAutoRefresh()
      return
    }
    if (isFetchingQR.value || isCheckingWaConnection.value) return
    void fetchWhatsAppQrData()
  }, WA_QR_AUTO_REFRESH_MS)
}

async function refreshWhatsAppStatus() {
  if (bootstrapStatus.value !== 'ready' || !localStorage.getItem('kaits_token')) return
  try {
    const r = await whatsappService.getStatus()
    whatsappStatus.value = r.connected ? 'conectado' : 'desconectado'
  } catch {
    whatsappStatus.value = 'desconectado'
  }
}

function startWaStatusPolling() {
  stopWaStatusPolling()
  void refreshWhatsAppStatus()
  waStatusIntervalId = setInterval(refreshWhatsAppStatus, WA_STATUS_POLL_MS)
}

function stopWaStatusPolling() {
  if (waStatusIntervalId) {
    clearInterval(waStatusIntervalId)
    waStatusIntervalId = null
  }
}

watch(bootstrapStatus, (s) => {
  if (s === 'ready') startWaStatusPolling()
  else stopWaStatusPolling()
})

watch(
  [bootstrapStatus, whatsappStandalone, showWhatsAppModal, whatsappStatus, waAlreadyConnected],
  () => {
    maybeStartWaQrAutoRefresh()
  }
)

function clearEmbedAuthTimer() {
  if (embedAuthTimer) {
    clearTimeout(embedAuthTimer)
    embedAuthTimer = null
  }
}

function applyEmbedToken(token) {
  localStorage.setItem('kaits_token', token)
  embedWaiting.value = false
  clearEmbedAuthTimer()
  loadApplication()
}

/**
 * Captura o #access_token que chega via hashchange quando o portal define frame.src
 * com o hash (ex.: iframeOrigin + '/#access_token=...').
 * Isso cobre o caso em que o onMounted já terminou (sem token no hash) e o
 * portal só atribui o src mais tarde (ao clicar na aba Smart Kaits).
 */
function onHashChangeEmbed() {
  if (bootstrapStatus.value === 'ready') return
  const consumed = consumeAccessTokenFromHash()
  if (consumed) {
    embedWaiting.value = false
    clearEmbedAuthTimer()
    loadApplication()
  }
}

function hintFromBootstrapError(err) {
  if (!err?.response) {
    const code = err?.code
    if (code === 'ERR_NETWORK' || err?.message === 'Network Error') {
      return 'Não foi possível contatar o servidor. Verifique sua internet, firewall ou VPN.'
    }
    return 'Não foi possível iniciar a conexão com o sistema.'
  }
  const status = err.response.status
  if (status >= 500) {
    return 'O servidor está temporariamente indisponível. Aguarde alguns minutos e tente de novo.'
  }
  if (status === 401 || status === 403) {
    return 'Não foi possível validar o acesso (sessão ou credenciais).'
  }
  return `A resposta do servidor não pôde ser concluída (código ${status}).`
}

async function onAdvancedDocEditorSynced() {
  suppressConfigAutosave.value = true
  try {
    const data = await configService.getConfig()
    if (data && typeof data === 'object') {
      Object.assign(agentConfig.value, data)
    }
  } catch (e) {
    devLog.error('sync doc editor → config', e)
  } finally {
    await nextTick()
    suppressConfigAutosave.value = false
  }
}

async function loadApplication() {
  bootstrapStatus.value = 'loading'
  connectionSupportHint.value = ''
  embedWaiting.value = false
  clearEmbedAuthTimer()

  // ── DEV MOCK: pula auth e backend se VITE_DEV_MOCK=true ──────────────────
  if (import.meta.env.VITE_DEV_MOCK === 'true') {
    agentConfig.value = {
      ...agentConfig.value,
      assistantName: 'Sofia',
      personality: 'Amigável, objetiva e usa emojis com moderação 😊',
      greeting: 'Olá! Seja bem-vindo à Escola Demo 😊 Como posso te ajudar?',
      companyContext: 'Escola de educação infantil em São Paulo, atendemos crianças de 2 a 10 anos, referência em bilíngue desde 2010.',
      faqItems: [],
      teamMembers: [{ id: 1, name: 'Ana (coord.)', phone: '5511999990001' }],
      fallbackContact: '5511999990001',
    }
    bootstrapStatus.value = 'ready'
    showModal.value = false
    return
  }
  // ─────────────────────────────────────────────────────────────────────────

  try {
    const embedded = isEmbeddedInIframe()
    const hasToken = !!localStorage.getItem('kaits_token')

    if (!hasToken && embedded) {
      connectionSupportHint.value =
        'Esta tela precisa receber o acesso pelo portal KAITS (sessão automática). Abra o Smart Kaits pelo menu do sistema ou peça ao suporte para verificar a integração.'
      bootstrapStatus.value = 'support'
      return
    }

    if (!hasToken && !embedded) {
      bootstrapStatus.value = 'needs_login'
      return
    }

    let data
    try {
      data = await configService.getConfig()
    } catch (e) {
      if (e.response && (e.response.status === 403 || e.response.status === 401)) {
        localStorage.removeItem('kaits_token')
        if (embedded) {
          connectionSupportHint.value =
            'Não foi possível validar o acesso. Peça ao suporte para verificar o token enviado pelo portal.'
          bootstrapStatus.value = 'support'
        } else {
          loginError.value = 'Sessão inválida ou expirada. Entre novamente com slug e senha da escola.'
          bootstrapStatus.value = 'needs_login'
        }
        return
      }
      throw e
    }

    if (data && typeof data === 'object') {
      agentConfig.value = { ...agentConfig.value, ...data }
    }
    resetWhatsAppUiForNewSession()
    bootstrapStatus.value = 'ready'
    await nextTick()
    await refreshWhatsAppStatus()
    syncWhatsAppHashRoute()
    if (whatsappStandalone.value) {
      showModal.value = false
      onboardingMode.value = false
      await fetchWhatsAppQrData()
    } else {
      // Mantém o comportamento padrão para ambos (iframe ou direto)
      // Se precisar forçar algo específico para o portal no futuro, adicionamos aqui.
      activeSection.value = null
    }
  } catch (err) {
    devLog.error('[Smart Kaits] Falha ao conectar:', err)
    connectionSupportHint.value = hintFromBootstrapError(err)
    bootstrapStatus.value = 'support'
  }
}

/** Limpa QR/modal da escola anterior quando o JWT muda (outro slug, embed com novo token, etc.). */
function resetWhatsAppUiForNewSession() {
  showWhatsAppModal.value = false
  qrCodeBase64.value = null
  waPairingCode.value = ''
  waQrHint.value = ''
  waAlreadyConnected.value = false
  isFetchingQR.value = false
}

function normalizeQrDataUrl(raw) {
  if (!raw || typeof raw !== 'string') return null
  const t = raw.trim()
  if (t.startsWith('data:image')) return t
  if (t.startsWith('http://') || t.startsWith('https://')) return t
  return `data:image/png;base64,${t}`
}

function syncWhatsAppHashRoute() {
  const h = (window.location.hash || '').replace(/^#/, '').split('?')[0].toLowerCase()
  whatsappStandalone.value = h === 'whatsapp' || h === '/whatsapp'
}

function leaveWhatsAppStandalonePage() {
  const path = `${window.location.pathname}${window.location.search || ''}`
  window.history.replaceState(null, '', path)
  syncWhatsAppHashRoute()
}

function qrConnectShouldRetry(e) {
  const s = e?.response?.status
  return (
    s === 502 ||
    s === 503 ||
    s === 504 ||
    e?.code === 'ECONNABORTED' ||
    e?.code === 'ERR_NETWORK' ||
    e?.message === 'Network Error'
  )
}

/** Evita que uma chamada antiga encerre o overlay enquanto outra mais nova está ativa. */
let whatsappQrFetchGeneration = 0

/** Busca QR / estado WhatsApp (usado pelo modal e pela página `#whatsapp`). */
async function fetchWhatsAppQrData() {
  const gen = ++whatsappQrFetchGeneration
  waPairingCode.value = ''
  waQrHint.value = ''
  waAlreadyConnected.value = false
  qrCodeBase64.value = null
  await refreshWhatsAppStatus()
  if (gen !== whatsappQrFetchGeneration) return
  if (whatsappStatus.value === 'conectado') {
    waAlreadyConnected.value = true
    waQrHint.value =
      'WhatsApp já está conectado para esta escola. O número segue ativo até você desconectar no aparelho ou remover a instância.'
    return
  }
  isFetchingQR.value = true
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  /** Poucas tentativas: cada uma pode levar ~minuto no backend; mais que isso parece “infinito”. */
  const maxAttempts = 2
  try {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (gen !== whatsappQrFetchGeneration) return
      if (attempt > 0) await sleep(900 + attempt * 1100)
      if (gen !== whatsappQrFetchGeneration) return
      try {
        const res = await whatsappService.getConnect()
        if (gen !== whatsappQrFetchGeneration) return
        if (res.already_connected) {
          waAlreadyConnected.value = true
          whatsappStatus.value = 'conectado'
          waQrHint.value = String(res.message || 'WhatsApp já está conectado para esta escola.')
          return
        }
        if (res.status === 'success' || res.status === 'partial') {
          qrCodeBase64.value = normalizeQrDataUrl(res.qrcode)
          waPairingCode.value = (res.pairing_code && String(res.pairing_code)) || ''
          waQrHint.value = (res.message && String(res.message)) || ''
          if (!qrCodeBase64.value && waPairingCode.value) {
            waQrHint.value =
              waQrHint.value ||
              'Abra o WhatsApp no celular → Aparelhos conectados → Conectar um aparelho → Conectar com número de telefone, e use o código abaixo.'
          }
          return
        }
        if (res.status === 'error' || res.message) {
          waQrHint.value = String(res.message || res.detail || 'Resposta inválida do serviço de conexão WhatsApp.')
          return
        }
      } catch (e) {
        if (gen !== whatsappQrFetchGeneration) return
        const last = attempt === maxAttempts - 1
        if (qrConnectShouldRetry(e) && !last) {
          devLog.warn('fetchWhatsAppQrData: nova tentativa após erro temporário', attempt + 1, e)
          continue
        }
        throw e
      }
    }
  } catch (e) {
    devLog.error('Failed to fetch QR Code', e)
    const status = e?.response?.status
    if (e?.code === 'ECONNABORTED') {
      waQrHint.value =
        'Tempo esgotado ao gerar o QR. O proxy pode estar cortando antes do backend (veja timeout no Traefik) ou o serviço está lento — use Atualizar QR.'
    } else if (status === 503) {
      waQrHint.value =
        'Servidor ocupado com o banco de dados. Espere alguns segundos e use Atualizar QR.'
    } else if (status === 502 || status === 504) {
      waQrHint.value =
        'Proxy ou serviço demorou demais (502/504). Confira timeout do Traefik (até ~120s no /api) e tente de novo.'
    } else {
      waQrHint.value =
        'Não foi possível falar com o servidor. Verifique se a integração WhatsApp está no ar e se as variáveis de API estão corretas no backend.'
    }
  } finally {
    if (gen === whatsappQrFetchGeneration) {
      isFetchingQR.value = false
    }
  }
}

async function openWhatsAppModal() {
  showWhatsAppModal.value = true
  await fetchWhatsAppQrData()
  maybeStartWaQrAutoRefresh()
}

async function confirmWhatsAppConnected() {
  if (bootstrapStatus.value !== 'ready') return
  isCheckingWaConnection.value = true
  try {
    await refreshWhatsAppStatus()
    if (whatsappStatus.value === 'conectado') {
      waAlreadyConnected.value = true
      qrCodeBase64.value = null
      waPairingCode.value = ''
      waQrHint.value = 'WhatsApp conectado e validado para esta escola.'
      stopWaQrAutoRefresh()
      return
    }
    const res = await whatsappService.getConnect()
    if (res.already_connected) {
      whatsappStatus.value = 'conectado'
      waAlreadyConnected.value = true
      qrCodeBase64.value = null
      waPairingCode.value = ''
      waQrHint.value = String(res.message || 'Conexão confirmada.')
      stopWaQrAutoRefresh()
      return
    }
    waQrHint.value =
      'Ainda não detectamos a sessão aberta no WhatsApp. Confirme que escaneou o QR no aparelho certo e aguarde alguns segundos — ou use «Atualizar QR».'
  } catch (e) {
    devLog.error('confirmWhatsAppConnected', e)
    waQrHint.value = 'Não foi possível validar agora. Tente «Atualizar QR» ou verifique a rede.'
  } finally {
    isCheckingWaConnection.value = false
  }
}

const isDisconnectingWa = ref(false)

async function disconnectWhatsApp() {
  isDisconnectingWa.value = true
  waQrHint.value = ''
  try {
    await whatsappService.logoutInstance()
    // Resetar estado local
    whatsappStatus.value = 'desconectado'
    waAlreadyConnected.value = false
    qrCodeBase64.value = null
    waPairingCode.value = ''
    waQrHint.value = 'Número desconectado. Escaneie o QR abaixo para conectar outro número.'
    showDisconnectConfirm.value = false
    // Já busca novo QR automaticamente
    await fetchWhatsAppQrData()
    maybeStartWaQrAutoRefresh()
  } catch (e) {
    devLog.error('disconnectWhatsApp', e)
    waQrHint.value = 'Não foi possível desconectar agora. Tente novamente ou verifique o serviço.'
  } finally {
    isDisconnectingWa.value = false
  }
}

function onHashChangeWhatsApp() {
  syncWhatsAppHashRoute()
  if (bootstrapStatus.value === 'ready' && whatsappStandalone.value) {
    showModal.value = false
    onboardingMode.value = false
    void fetchWhatsAppQrData()
  }
}


function scheduleEmbedWaitOrFail() {
  embedWaiting.value = true
  bootstrapStatus.value = 'loading'
  connectionSupportHint.value = ''
  clearEmbedAuthTimer()
  embedAuthTimer = setTimeout(() => {
    embedAuthTimer = null
    embedWaiting.value = false
    if (!localStorage.getItem('kaits_token')) {
      connectionSupportHint.value =
        'Não recebemos o token de sessão do portal a tempo. Confirme que você abriu o Smart Kaits pelo sistema KAITS ou peça ao suporte para validar o embed e as origens permitidas.'
      bootstrapStatus.value = 'support'
    }
  }, EMBED_AUTH_WAIT_MS)
}

async function submitStandaloneLogin() {
  loginBusy.value = true
  loginError.value = ''
  try {
    await authService.login(loginSlug.value.trim(), loginPassword.value)
    loginPassword.value = ''
    await loadApplication()
  } catch {
    loginError.value = 'Slug ou senha incorretos. Confira com a equipe da sua escola ou com o suporte KAITS.'
  } finally {
    loginBusy.value = false
  }
}

function retryBootstrap() {
  consumeAccessTokenFromHash()
  if (localStorage.getItem('kaits_token')) {
    loadApplication()
    return
  }
  if (isEmbeddedInIframe()) {
    scheduleEmbedWaitOrFail()
    return
  }
  loginError.value = ''
  loadApplication()
}

function startBootstrap() {
  consumeAccessTokenFromHash()

  const embedded = isEmbeddedInIframe()
  const hasToken = !!localStorage.getItem('kaits_token')

  embedMessageHandler = createEmbedPostMessageHandler(
    (tok) => applyEmbedToken(tok),
    () => devLog.info('[embed] Bearer da API Kaits (hospedeiro) recebido e armazenado.')
  )
  window.addEventListener('message', embedMessageHandler)

  if (requireEmbedOnly && !embedded && !hasToken) {
    connectionSupportHint.value =
      'Este endereço só funciona dentro do portal KAITS (iframe com sessão). Abra o Smart Kaits pelo menu do sistema.'
    bootstrapStatus.value = 'support'
    return
  }

  if (hasToken) {
    loadApplication()
  } else if (embedded) {
    scheduleEmbedWaitOrFail()
  } else {
    loadApplication()
  }
}

onMounted(() => {
  document.documentElement.classList.toggle('REDACTED', isEmbeddedInIframe())
  syncWhatsAppHashRoute()
  window.addEventListener('hashchange', onHashChangeWhatsApp)
  window.addEventListener('hashchange', onHashChangeEmbed)
  startBootstrap()
})

onUnmounted(() => {
  document.documentElement.classList.remove('REDACTED')
  window.removeEventListener('hashchange', onHashChangeWhatsApp)
  window.removeEventListener('hashchange', onHashChangeEmbed)
  clearEmbedAuthTimer()
  stopWaStatusPolling()
  stopWaQrAutoRefresh()
  if (embedMessageHandler) {
    window.removeEventListener('message', embedMessageHandler)
    embedMessageHandler = null
  }
})

// Lógica de Persistência (Auto-Save)
const saveState = ref('salvo') // 'idle', 'saving', 'salvo'
let saveTimeout = null

watch(agentConfig, () => {
  if (bootstrapStatus.value !== 'ready') return
  if (suppressConfigAutosave.value) return
  saveState.value = 'saving'
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(async () => {
    try {
      await configService.saveConfig(agentConfig.value)
      skipConfigRefreshUntil.value = Date.now() + 1500
      saveState.value = 'salvo'
    } catch (e) {
      localStorage.setItem('kaits_agent_config', JSON.stringify(agentConfig.value))
      skipConfigRefreshUntil.value = Date.now() + 1500
      saveState.value = 'salvo'
    }
  }, 1000)
}, { deep: true })

const configCompletion = computed(() => evaluateConfigCompletion(agentConfig.value))

const completionStatus = computed(() => configCompletion.value.status)

const completionPercent = computed(() => configCompletion.value.percent)

const completionHintsForUi = computed(() => configCompletion.value.hints)

const potentialTipMain = computed(
  () => `Você está usando ${completionPercent.value}% do potencial da ferramenta`
)

const potentialTipPending = computed(() => configCompletion.value.pending)

const potentialTipSummary = computed(() => {
  const n = potentialTipPending.value.length
  if (n === 0) return 'Todas as áreas visíveis estão completas (😊 nos cards).'
  const pts = Math.round(100 / 5)
  return `Cada área vale ~${pts}%. Faltam ${n} para 100%:`
})

const ONBOARDING_STEP_META = {
  personality: {
    title: 'Personalidade da I.A.',
    desc: 'Nome, tom de voz e primeira mensagem para seus clientes.',
  },
  company: {
    title: 'Sobre a empresa',
    desc: 'Em uma frase: o que você faz e para quem.',
  },
  team: {
    title: 'Equipe & transferência',
    desc: 'Quem recebe o cliente quando a I.A. não souber responder.',
  },
  faq: {
    title: 'Dúvidas frequentes',
    desc: 'Perguntas comuns e o que a I.A. deve fazer em cada uma.',
  },
  docs: {
    title: 'Documentos base',
    desc: 'Materiais que a I.A. consulta antes de responder.',
  },
  tools: {
    title: 'Integrações (API)',
    desc: 'Habilite o que a I.A. pode consultar ou executar direto no sistema.',
  },
}

const onboardingStepMeta = computed(
  () => ONBOARDING_STEP_META[currentStepId.value] || ONBOARDING_STEP_META.personality
)

// XP GAMIFICATION
const totalXP = ref(0)
const showXpPop = ref(false)

watch(completionPercent, (newVal, oldVal) => {
  if (newVal > oldVal) {
    const gained = (newVal - oldVal) * 5 // 5 XP per 1%
    totalXP.value += gained
    showXpPop.value = true
    setTimeout(() => { showXpPop.value = false }, 1500)
  }
})

function microStepsCount(sectionId) {
  return ONBOARDING_MICRO_STEPS[sectionId] ?? 1
}

function maxMicroStepFor(sectionId) {
  return Math.max(0, microStepsCount(sectionId) - 1)
}

const onboardingMicroTotal = computed(() => microStepsCount(currentStepId.value))

const onboardingMicroLabels = computed(() =>
  microLabelsForSection(currentStepId.value)
)

const onboardingMicroTitle = computed(() => {
  const labels = onboardingMicroLabels.value
  if (!labels.length) return ''
  const i = Math.min(onboardingMicroStep.value, labels.length - 1)
  return labels[i]
})

const onboardingMacroLabel = computed(() => {
  if (!onboardingMode.value) return ''
  return `Etapa ${currentStepIndex.value + 1} de ${stepsOrder.length}`
})

const onboardingFooterHint = computed(() => {
  const total = onboardingMicroTotal.value
  const cur = onboardingMicroStep.value + 1
  const macro = onboardingMacroLabel.value
  const part = onboardingMicroTitle.value
  if (total <= 1) {
    return `${macro}: preencha e toque em «Próximo passo».`
  }
  if (cur < total) {
    return `${macro} · Parte ${cur}/${total} (${part}). «Próximo» abre a parte ${cur + 1} de ${total}.`
  }
  return `${macro} · Parte ${cur}/${total} (${part}). «Próximo» vai para a próxima etapa do guia.`
})

const onboardingCanGoBack = computed(() => {
  if (!onboardingMode.value) return false
  if (onboardingMicroStep.value > 0) return true
  return currentStepIndex.value > 0
})

const onboardingNextLabel = computed(() => {
  const section = currentStepId.value
  const atLastSection = currentStepIndex.value === stepsOrder.length - 1
  const atLastMicro = onboardingMicroStep.value >= maxMicroStepFor(section)
  if (atLastSection && atLastMicro) return 'Concluir guia'
  const total = onboardingMicroTotal.value
  const cur = onboardingMicroStep.value + 1
  if (total > 1 && cur < total) {
    return `Próxima parte (${cur + 1}/${total}) →`
  }
  return 'Próxima etapa →'
})

watch(currentStepId, () => {
  if (onboardingMode.value) onboardingMicroStep.value = 0
})

function startOnboarding() {
  onboardingMode.value = true
  onboardingMicroStep.value = 0
  currentStepIndex.value = 0
  showModal.value = false
}
function openTutorialFromHeader() {
  onboardingMode.value = true
  onboardingMicroStep.value = 0
  currentStepIndex.value = 0
  activeSection.value = null
  showExitModal.value = false
}
function nextStep() {
  saveState.value = 'saving' // Força feedback imediato ao avançar
  setTimeout(() => saveState.value = 'salvo', 1000)

  const section = currentStepId.value
  const maxMicro = maxMicroStepFor(section)
  if (onboardingMode.value && onboardingMicroStep.value < maxMicro) {
    onboardingMicroStep.value++
    return
  }
  onboardingMicroStep.value = 0
  if (currentStepIndex.value < stepsOrder.length - 1) currentStepIndex.value++
  else openExitModal()
}
function prevStep() {
  if (onboardingMode.value && onboardingMicroStep.value > 0) {
    onboardingMicroStep.value--
    return
  }
  onboardingMicroStep.value = 0
  if (currentStepIndex.value > 0) {
    currentStepIndex.value--
    onboardingMicroStep.value = maxMicroStepFor(stepsOrder[currentStepIndex.value])
  }
}
function handleSectionFocus(sectionId) { if (!onboardingMode.value) activeSection.value = sectionId }


function handleGotoDoc(payload) {
  showTestChat.value = false
  editorDocId.value = payload.docId
  editorTarget.value = { page: payload.page, lineStart: payload.lineStart }
  showAdvancedEditor.value = true
}

function openFullEditor(docId) {
  editorDocId.value = docId
  editorTarget.value = null
  showAdvancedEditor.value = true
}
</script>

<template>
  <!-- Falha de conexão / autenticação inicial -->
  <div v-if="bootstrapStatus === 'loading'" class="bootstrap-screen" aria-busy="true">
    <div class="bootstrap-card">
      <span class="bootstrap-logo-dot" aria-hidden="true" />
      <p class="bootstrap-title">Smart Kaits</p>
      <p class="bootstrap-sub">{{ embedWaiting ? 'Aguardando sessão enviada pelo portal…' : 'Conectando ao servidor…' }}</p>
      <div class="save-spinner bootstrap-spinner" />
    </div>
  </div>

  <div v-else-if="bootstrapStatus === 'needs_login'" class="bootstrap-screen">
    <div class="bootstrap-card bootstrap-card--wide">
      <span class="bootstrap-logo-dot" aria-hidden="true" />
      <p class="bootstrap-title">Entrar — Smart Kaits</p>
      <p class="bootstrap-sub">
        Abrir o link do Smart Kaits <strong>direto no browser</strong> (fora do portal KAITS) <strong>não entra sozinho</strong>:
        é preciso o <strong>slug</strong> da escola e a <strong>senha</strong> que a KAITS forneceu.
        Dentro do <strong>portal KAITS</strong> (iframe), o acesso é feito pelo portal com o token de sessão — sem partilhar senha aqui.
      </p>
      <form class="login-gate" @submit.prevent="submitStandaloneLogin">
        <label class="login-gate__label" for="REDACTED">Slug da escola</label>
        <input
          id="REDACTED"
          v-model="loginSlug"
          type="text"
          class="login-gate__input"
          autocomplete="username"
          placeholder="ex.: minha-escola"
          required
        />
        <label class="login-gate__label" for="REDACTED">Senha</label>
        <input
          id="REDACTED"
          v-model="loginPassword"
          type="password"
          class="login-gate__input"
          autocomplete="current-password"
          placeholder="Senha da escola"
          required
        />
        <p v-if="loginError" class="login-gate__err" role="alert">{{ loginError }}</p>
        <button type="submit" class="btn btn-primary login-gate__submit" :disabled="loginBusy">
          {{ loginBusy ? 'Entrando…' : 'Entrar' }}
        </button>
      </form>
      <p class="bootstrap-foot">Problema com credenciais? Fale com o suporte KAITS com o nome da sua escola.</p>
      <p v-if="whatsappStandalone" class="login-gate__wa-hint">
        Com <code>#whatsapp</code> no URL, após entrar vais direto à página de QR desta escola. Para <strong>duas contas WhatsApp</strong> ao mesmo tempo: duas
        <strong>janelas anónimas</strong> — numa entra <code>login1</code>, noutra <code>login2</code> (senha <code>senha123</code> em ambas).
      </p>
    </div>
  </div>

  <div v-else-if="bootstrapStatus === 'support'" class="bootstrap-screen bootstrap-screen--support">
    <div class="bootstrap-card bootstrap-card--wide">
      <span class="bootstrap-logo-dot bootstrap-logo-dot--muted" aria-hidden="true" />
      <h1 class="bootstrap-heading">Não conseguimos conectar</h1>
      <p class="bootstrap-lead">
        A ferramenta não pôde sincronizar com o sistema. Isso costuma ser rede, manutenção ou permissão de acesso.
      </p>
      <p v-if="connectionSupportHint" class="bootstrap-hint">{{ connectionSupportHint }}</p>
      <p class="bootstrap-support-copy">
        Entre em contato com o <strong>suporte KAITS</strong> para liberar o acesso ou verificar o ambiente.
      </p>
      <div class="bootstrap-actions">
        <button type="button" class="btn btn-primary" @click="retryBootstrap">Tentar novamente</button>
      </div>

      <p class="bootstrap-foot">Se o problema continuar, informe o horário e o navegador que você usou — isso agiliza o diagnóstico.</p>
    </div>
  </div>

  <div v-else class="app-when-ready" :class="{ 'app-when-ready--embedded': isEmbedded }">
  <div v-if="whatsappStandalone" class="whatsapp-standalone">
    <header class="whatsapp-standalone__header">
      <div class="whatsapp-standalone__brand">
        <span class="app-header__dot" aria-hidden="true" />
        <div>
          <h1 class="whatsapp-standalone__title">Conexão WhatsApp</h1>
          <p class="whatsapp-standalone__slug">Sessão desta escola — instância separada por login.</p>
        </div>
      </div>
      <button type="button" class="btn btn-ghost" @click="leaveWhatsAppStandalonePage">← Configuração</button>
    </header>
    <div class="qr-modal whatsapp-standalone__card">
      <h3>{{ waAlreadyConnected ? 'WhatsApp conectado' : 'Conectar WhatsApp' }}</h3>
      <p v-if="!waAlreadyConnected">Aponte a câmera do celular para o QR (ou use o código de pareamento).</p>
      <p v-if="waQrHint" class="qr-hint-text">{{ waQrHint }}</p>
      <div v-if="waAlreadyConnected" class="wa-connected-section">
        <div class="qr-connected-banner">
          <span class="wa-connected-banner__dot" />
          {{ waQrHint || 'WhatsApp ativo — a I.A. está recebendo mensagens por este número.' }}
        </div>
        <div v-if="!showDisconnectConfirm" class="wa-disconnect-row">
          <button type="button" class="btn-disconnect" :disabled="isDisconnectingWa" @click="showDisconnectConfirm = true">
            🔌 Trocar / desconectar número
          </button>
        </div>
        <Transition name="fade">
          <div v-if="showDisconnectConfirm" class="wa-disconnect-confirm">
            <p class="wa-disconnect-confirm__text">⚠️ Tem certeza? A I.A. vai parar de responder até conectar um novo número.</p>
            <div class="wa-disconnect-confirm__actions">
              <button type="button" class="btn btn-ghost" :disabled="isDisconnectingWa" @click="showDisconnectConfirm = false">Cancelar</button>
              <button type="button" class="btn-disconnect btn-disconnect--confirm" :disabled="isDisconnectingWa" @click="disconnectWhatsApp">
                <span v-if="isDisconnectingWa" class="wa-spinner" />
                {{ isDisconnectingWa ? 'Desconectando…' : '✓ Sim, desconectar' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
      <div v-if="waPairingCode" class="pairing-box">
        <span class="pairing-label">Código de pareamento</span>
        <code class="pairing-code">{{ waPairingCode }}</code>
      </div>
      <div v-if="!waAlreadyConnected" class="qr-placeholder">
        <div v-if="isFetchingQR" class="qr-loading-overlay">
          <div class="save-spinner"></div>
          <span>Gerando QR Code…</span>
        </div>
        <img v-if="qrCodeBase64" :src="qrCodeBase64" alt="WhatsApp QR Code" />
        <div v-else-if="!isFetchingQR && !waPairingCode && !waQrHint" class="qr-error">Falha ao carregar QR Code</div>
      </div>
      <div v-if="!waAlreadyConnected" class="qr-hint">A I.A. desta escola responde clientes por este número após conectar.</div>
      <div v-if="!waAlreadyConnected" class="whatsapp-actions">
        <button
          type="button"
          class="btn btn-primary whatsapp-standalone__refresh"
          :disabled="isFetchingQR || isCheckingWaConnection"
          @click="fetchWhatsAppQrData"
        >
          {{ isFetchingQR ? 'Atualizando…' : 'Atualizar QR' }}
        </button>
        <button
          type="button"
          class="btn btn-ghost whatsapp-standalone__confirm"
          :disabled="isFetchingQR || isCheckingWaConnection"
          @click="confirmWhatsAppConnected"
        >
          {{ isCheckingWaConnection ? 'Validando…' : 'Já conectei, validar agora' }}
        </button>
      </div>
    </div>
  </div>
  <template v-else>
  <div class="top-progress-bg">
    <div class="top-progress-fill" :style="{ width: completionPercent + '%' }"></div>
  </div>

  <Transition name="fade">
    <OnboardingModal v-if="showModal" @start="startOnboarding" />
  </Transition>

  <Transition name="fade">
    <div v-if="showExitModal" class="custom-exit-overlay">
      <div class="custom-exit-card">
        <h3>Pular para a configuração livre?</h3>
        
        <div class="phase-box">
          <p class="gentle-text">Você pode explorar a configuração livremente no seu próprio ritmo! ✨</p>
          <div class="exit-alert-box" style="margin: .5rem 0;">
            <p style="margin-bottom: 6px;">Lembrete rápido:</p>
            • O botão do <strong>Tutorial</strong> está sempre visível no <strong>topo</strong> da tela.<br/>
            • A bolha de <strong>Ajuda</strong> fica no <strong>canto inferior direito</strong>.
          </div>
        </div>

        <div class="exit-actions">
          <button class="btn btn-ghost" @click="cancelExit">Ah, quero continuar guiado</button>
          <button type="button" class="btn btn-primary" @click="confirmExit">
            Entendido, configurar livremente
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <!-- TEST CHAT MODAL -->
  <TestChatModal v-model="showTestChat" :config="agentConfig" @goto-doc="handleGotoDoc" />

  <!-- ADVANCED DOC EDITOR (Modo Google Docs) -->
  <AdvancedDocEditor 
    v-if="showAdvancedEditor" 
    :doc-id="editorDocId" 
    :initial-target="editorTarget"
    @close="showAdvancedEditor = false"
    @updated="onAdvancedDocEditorSynced"
  />

  <header
    class="app-header"
    :class="{
      'glow-header': showExitModal,
      'app-header--embed': isEmbedded,
      'app-header--onboarding': onboardingMode,
      'app-header--tutorial-dim': onboardingMode && !showExitModal && !showModal
    }"
    :style="{ '--header-zoom': headerZoom }"
  >
    <div class="app-header__brand">
      <span class="app-header__dot" />
      <span class="app-header__title">Smart Kaits <span class="badge-beta">PRO</span></span>
      <span class="build-stamp" :title="'Build ' + buildId">v{{ buildId }}</span>
    </div>

    <!-- Banner persuasivo: oculto no guia e no embed (iframe estreito) -->
    <div v-if="completionPercent < 30 && !onboardingMode && !isEmbedded" class="persuasion-banner">
      ⚡️ <strong>Faltam apenas 3 minutos</strong> para sua I.A. começar a atender!
    </div>

    <div v-if="!onboardingMode || showExitModal" class="tutorial-incentive">
      <button type="button" class="btn btn-primary btn-tutorial-large" @click="openTutorialFromHeader">
        🎓 Tutorial
      </button>
    </div>

    <div class="app-header__actions">
      <!-- Auto Save indicator (discreto) -->
      <Transition name="fade">
        <span v-if="saveState === 'saving'" class="save-indicator save-indicator--saving">
          <span class="save-spinner"></span>
        </span>
      </Transition>

      <!-- XP Tracker -->
      <div class="xp-badge">
        <span class="xp-icon" :class="{'wobble-star': showXpPop}">🌟</span>
        <span class="xp-value">{{ totalXP }} XP</span>
        <Transition name="slide-up-fade">
          <span v-if="showXpPop" class="xp-pop">+XP! 🎉</span>
        </Transition>
      </div>

      <!-- PROGRESS -->
      <div class="header-progress-wrap">
        <button
          type="button"
          class="header-progress"
          :title="potentialTipMain"
          @click="showPotentialTip = !showPotentialTip"
        >
          🚀 {{ completionPercent }}%
          <span class="header-progress__info" aria-hidden="true">ⓘ</span>
        </button>
        <Transition name="fade">
          <div v-if="showPotentialTip" class="potential-tip-pop" role="dialog" aria-label="Potencial da ferramenta">
            <strong>{{ potentialTipMain }}</strong>
            <p class="potential-tip-pop__summary">{{ potentialTipSummary }}</p>
            <ul v-if="potentialTipPending.length" class="potential-tip-pop__list">
              <li v-for="item in potentialTipPending" :key="item.key">
                <span class="potential-tip-pop__badge">⭕</span>
                <span class="potential-tip-pop__label">{{ item.label }}</span>
                <span class="potential-tip-pop__hint">{{ item.hint }}</span>
              </li>
            </ul>
            <p v-else class="potential-tip-pop__done">Parabéns — potencial máximo nesta escola. 🎉</p>
            <p class="potential-tip-pop__legend">😊 no card = critério desta lista atendido</p>
          </div>
        </Transition>
      </div>

      <!-- AI PAUSE TOGGLE -->
      <div class="pause-control" :class="{ 'pause-control--active': agentConfig.isPaused }" title="Pausar I.A. Globalmente">
        <span class="pause-label">{{ agentConfig.isPaused ? 'PAUSADA' : 'I.A. ATIVA' }}</span>
        <label class="pause-switch">
          <input type="checkbox" v-model="agentConfig.isPaused">
          <span class="pause-slider"></span>
        </label>
      </div>

      <!-- WHATSAPP STATUS/CONN -->
      <div class="connection-status" :class="'connection-status--' + whatsappStatus" @click="openWhatsAppModal" style="cursor:pointer" title="Conectar WhatsApp">
        <span class="status-dot"></span>
        <span class="status-text">{{ whatsappStatus === 'conectado' ? 'WhatsApp' : 'Conectar' }}</span>
      </div>

      <div class="header-zoom" aria-label="Ajuste de zoom do cabeçalho">
        <button type="button" class="header-zoom__btn" title="Diminuir zoom do cabeçalho" @click="changeHeaderZoom(-0.05)">A-</button>
        <button type="button" class="header-zoom__value" title="Voltar ao zoom padrão" @click="resetHeaderZoom">{{ Math.round(headerZoom * 100) }}%</button>
        <button type="button" class="header-zoom__btn" title="Aumentar zoom do cabeçalho" @click="changeHeaderZoom(0.05)">A+</button>
      </div>

      <button class="btn btn-test btn-fun" @click="showTestChat = true" style="padding: .4rem .8rem; font-size: .8rem;">
        Simular Chat 💬
      </button>
    </div>
  </header>

  <!-- WHATSAPP QR MODAL -->
  <Transition name="fade">
    <div v-if="showWhatsAppModal" class="chat-overlay">
      <div class="qr-modal" role="dialog" aria-modal="true" aria-labelledby="qr-modal-title" @click.stop>
        <button type="button" class="btn-close-modal" aria-label="Fechar QR Code" @click="closeWhatsAppModal">×</button>
        <h3 id="qr-modal-title">{{ waAlreadyConnected ? 'WhatsApp conectado' : 'Conectar WhatsApp' }}</h3>
        <p v-if="!waAlreadyConnected">Aponte sua câmera para sincronizar as conversas.</p>
        <p v-if="waQrHint" class="qr-hint-text">{{ waQrHint }}</p>
        <div v-if="waAlreadyConnected" class="wa-connected-section">
          <div class="qr-connected-banner">
            <span class="wa-connected-banner__dot" />
            {{ waQrHint || 'WhatsApp ativo — a I.A. está recebendo mensagens por este número.' }}
          </div>

          <!-- Botão desconectar com confirmação inline -->
          <div v-if="!showDisconnectConfirm" class="wa-disconnect-row">
            <button
              type="button"
              class="btn-disconnect"
              :disabled="isDisconnectingWa"
              @click="showDisconnectConfirm = true"
            >
              🔌 Trocar / desconectar número
            </button>
          </div>

          <Transition name="fade">
            <div v-if="showDisconnectConfirm" class="wa-disconnect-confirm">
              <p class="wa-disconnect-confirm__text">
                ⚠️ Tem certeza? A I.A. vai parar de responder até você conectar um novo número.
              </p>
              <div class="wa-disconnect-confirm__actions">
                <button
                  type="button"
                  class="btn btn-ghost"
                  :disabled="isDisconnectingWa"
                  @click="showDisconnectConfirm = false"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  class="btn-disconnect btn-disconnect--confirm"
                  :disabled="isDisconnectingWa"
                  @click="disconnectWhatsApp"
                >
                  <span v-if="isDisconnectingWa" class="wa-spinner" />
                  {{ isDisconnectingWa ? 'Desconectando…' : '✓ Sim, desconectar' }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
        <div v-if="waPairingCode" class="pairing-box">
          <span class="pairing-label">Código de pareamento</span>
          <code class="pairing-code">{{ waPairingCode }}</code>
        </div>
        <div v-if="!waAlreadyConnected" class="qr-placeholder">
          <div v-if="isFetchingQR" class="qr-loading-overlay">
            <div class="save-spinner"></div>
            <span>Gerando QR Code…</span>
          </div>
          <img v-if="qrCodeBase64" :src="qrCodeBase64" alt="WhatsApp QR Code" />
          <div v-else-if="!isFetchingQR && !waPairingCode && !waQrHint" class="qr-error">Falha ao carregar QR Code</div>
        </div>
        <div v-if="!waAlreadyConnected" class="qr-hint">Isso permitirá que a {{ agentConfig.assistantName || 'I.A.' }} responda seus clientes automaticamente.</div>
        <div v-if="!waAlreadyConnected" class="whatsapp-actions">
          <button
            type="button"
            class="btn btn-primary"
            :disabled="isFetchingQR || isCheckingWaConnection"
            @click="fetchWhatsAppQrData"
          >
            {{ isFetchingQR ? 'Atualizando…' : 'Atualizar QR' }}
          </button>
          <button
            type="button"
            class="btn btn-ghost"
            :disabled="isFetchingQR || isCheckingWaConnection"
            @click="confirmWhatsAppConnected"
          >
            {{ isCheckingWaConnection ? 'Validando…' : 'Já conectei, validar agora' }}
          </button>
        </div>
        <div class="qr-modal__footer">
          <button type="button" class="qr-modal__close-btn" @click="closeWhatsAppModal">
            Fechar
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <main
    class="app-layout"
    :class="{
      'app-layout--blurred': showModal || showTestChat,
      'app-layout--with-footer': onboardingMode && !isEmbedded,
      'app-layout--onboarding': onboardingMode,
      'app-layout--embedded': isEmbedded
    }"
  >
    <ConfigPanel
      :config="agentConfig"
      :active-section="currentStepId"
      :onboarding-mode="onboardingMode"
      :onboarding-step-title="onboardingStepMeta.title"
      :onboarding-step-desc="onboardingStepMeta.desc"
      :onboarding-micro-step="onboardingMicroStep"
      :onboarding-micro-total="onboardingMicroTotal"
      :onboarding-micro-labels="onboardingMicroLabels"
      :onboarding-micro-title="onboardingMicroTitle"
      :onboarding-macro-label="onboardingMacroLabel"
      :completion-status="completionStatus"
      :completion-hints="completionHintsForUi"
      @section-focus="handleSectionFocus"
      @local-edit="markLocalConfigEdit"
      @open-editor="openFullEditor"
    />
    <PreviewPanel v-if="!onboardingMode" :config="agentConfig" :active-section="currentStepId" />
  </main>

  <!-- Rodapé do tutorial (após o main no DOM; fixo no embed) -->
  <Transition name="slide">
    <footer
      v-if="onboardingMode"
      class="onboarding-footer"
      :class="{
        'onboarding-footer--hidden': showTestChat || showExitModal,
        'onboarding-footer--embed': isEmbedded
      }"
    >
      <button
        type="button"
        class="btn btn-ghost btn-prev-step"
        :class="{ 'btn-prev-step--hidden': !onboardingCanGoBack }"
        @click="prevStep"
      >
        ← Passo Anterior
      </button>

      <div class="onboarding-nav-center">
        <div class="nav-dots">
          <span
            v-for="n in stepsOrder.length"
            :key="n"
            class="nav-dot"
            :class="{ 'nav-dot--active': n - 1 === currentStepIndex, 'nav-dot--done': n - 1 < currentStepIndex }"
          />
        </div>
        <strong class="onboarding-footer__hint">{{ onboardingFooterHint }}</strong>
        <div v-if="onboardingMicroTotal > 1" class="nav-micro-dots" role="list" aria-label="Partes desta etapa">
          <span
            v-for="n in onboardingMicroTotal"
            :key="'micro-' + n"
            role="listitem"
            class="nav-micro-dot"
            :class="{
              'nav-micro-dot--active': n - 1 === onboardingMicroStep,
              'nav-micro-dot--done': n - 1 < onboardingMicroStep,
            }"
            :title="onboardingMicroLabels[n - 1] || ''"
          />
        </div>
      </div>

      <button type="button" class="btn btn-next-step" @click="nextStep">
        {{ onboardingNextLabel }}
      </button>

      <div class="divider" />
      <button type="button" class="btn btn-ghost" style="color:#ef4444;" @click="openExitModal">Sair do guia</button>
    </footer>
  </Transition>

  <div :class="{'glow-help': showExitModal}">
    <HelpAssistant v-if="!onboardingMode || showExitModal" :config="agentConfig" @focus-section="handleSectionFocus" />
  </div>
  </template>
  </div>
</template>

<style scoped>
.app-when-ready { min-height: 100vh; }
.app-when-ready--embedded {
  min-height: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.bootstrap-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: linear-gradient(165deg, #eef0ff 0%, #f4f4f6 45%, #fafafa 100%);
}
.bootstrap-screen--support {
  background: linear-gradient(165deg, #fef2f2 0%, #f8fafc 50%, #f1f5f9 100%);
}
.bootstrap-card {
  background: #fff;
  border-radius: 20px;
  padding: 2rem 1.75rem;
  max-width: 380px;
  width: 100%;
  text-align: center;
  box-shadow: var(--shadow-md, 0 4px 16px rgba(0,0,0,.1));
  border: 1px solid #e2e8f0;
}
.bootstrap-card--wide { max-width: 520px; }
.bootstrap-logo-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--c-primary);
  margin-bottom: 0.75rem;
}
.bootstrap-logo-dot--muted { opacity: 0.85; }
.bootstrap-title {
  font-weight: 800;
  font-size: 1.15rem;
  color: var(--c-text, #111117);
  margin-bottom: 0.35rem;
}
.bootstrap-sub { font-size: 0.9rem; color: #64748b; margin-bottom: 1rem; }
.bootstrap-spinner { margin: 0.5rem auto 0; }

.bootstrap-heading {
  font-size: 1.35rem;
  font-weight: 800;
  color: #b91c1c;
  margin-bottom: 0.75rem;
  line-height: 1.25;
}
.bootstrap-lead {
  font-size: 0.95rem;
  color: #334155;
  line-height: 1.55;
  margin-bottom: 0.75rem;
}
.bootstrap-hint {
  font-size: 0.82rem;
  color: #64748b;
  background: #f8fafc;
  border-radius: 10px;
  padding: 0.65rem 0.85rem;
  margin-bottom: 1rem;
  text-align: left;
  border-left: 3px solid var(--c-primary);
}
.bootstrap-support-copy {
  font-size: 0.95rem;
  color: #0f172a;
  line-height: 1.5;
  margin-bottom: 1.25rem;
}
.bootstrap-actions {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  align-items: stretch;
}
.bootstrap-actions .btn { justify-content: center; text-decoration: none; }
.bootstrap-foot {
  margin-top: 1.25rem;
  font-size: 0.75rem;
  color: #94a3b8;
  line-height: 1.45;
}

.login-gate {
  margin-top: 1rem;
  text-align: left;
}
.login-gate__label {
  display: block;
  font-size: 0.72rem;
  font-weight: 700;
  color: #64748b;
  margin-top: 0.65rem;
  margin-bottom: 0.25rem;
}
.login-gate__input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.55rem 0.65rem;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  font-size: 0.9rem;
}
.login-gate__err {
  font-size: 0.82rem;
  color: #b91c1c;
  margin: 0.65rem 0 0;
}
.login-gate__submit {
  width: 100%;
  margin-top: 1rem;
  justify-content: center;
}

.header-progress-wrap { position: relative; }
.header-progress {
  font-family: inherit;
  font-size: .75rem;
  font-weight: 800;
  color: #15803d;
  background: #f0fdf4;
  padding: .25rem .7rem;
  border-radius: 99px;
  border: 1px solid #bbf7d0;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.5);
  white-space: nowrap;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}
.header-progress:hover { background: #dcfce7; }
.header-progress__info { font-size: 0.65rem; opacity: 0.85; }
.potential-tip-pop {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 200;
  min-width: 260px;
  max-width: 320px;
  background: white;
  border: 1px solid #bbf7d0;
  border-radius: 10px;
  padding: 0.65rem 0.75rem;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.72rem;
  color: #334155;
  line-height: 1.4;
  text-align: left;
}
.potential-tip-pop strong { color: #15803d; font-size: 0.78rem; }
.potential-tip-pop__summary { margin: 0; font-weight: 600; color: #475569; }
.potential-tip-pop__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.potential-tip-pop__list li {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.15rem 0.4rem;
  padding: 0.35rem 0.4rem;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}
.potential-tip-pop__badge { grid-row: span 2; align-self: start; }
.potential-tip-pop__label { font-weight: 700; color: #0f172a; font-size: 0.73rem; }
.potential-tip-pop__hint { grid-column: 2; font-size: 0.68rem; color: #64748b; }
.potential-tip-pop__done { margin: 0; font-weight: 600; color: #15803d; }
.potential-tip-pop__legend { margin: 0.15rem 0 0; font-size: 0.65rem; color: #94a3b8; }
.xp-badge { display: flex; align-items: center; gap: .3rem; background: linear-gradient(180deg, #fffbeb, #fef3c7); border: 1px solid #fde047; box-shadow: 0 2px 6px rgba(217, 119, 6, 0.1), inset 0 1px 0 white; padding: .25rem .7rem; border-radius: 99px; font-weight: 800; color: #b45309; font-size: .75rem; transition: transform 0.2s; white-space: nowrap; }
.xp-icon { font-size: .95rem; filter: drop-shadow(0 1px 2px rgba(217,119,6,0.3)); }

.badge-beta { font-size: .65rem; background: linear-gradient(135deg, #ef4444, #f43f5e); color: white; padding: .1rem .4rem; border-radius: 6px; font-weight: 900; vertical-align: middle; margin-left: .3rem; box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3); }

.persuasion-banner {
  position: absolute; left: 50%; transform: translateX(-50%);
  background: #fdf4ff; border: 1px solid #e9d5ff; color: #7e22ce;
  padding: .3rem 1rem; border-radius: 99px; font-size: .75rem;
  box-shadow: 0 4px 12px rgba(168,85,247,.1);
}

.connection-status { display: flex; align-items: center; gap: .4rem; font-size: .75rem; font-weight: 700; padding: .25rem .75rem; border-radius: 99px; background: #f8fafc; border: 1px solid #cbd5e1; box-shadow: inset 0 1px 0 white, 0 1px 2px rgba(15,23,42,0.04); color: #334155; transition: .2s; }
.connection-status:hover { background: #f1f5f9; border-color: #94a3b8; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; background: #94a3b8; }
.connection-status--conectado .status-dot { background: #22c55e; box-shadow: 0 0 10px #22c55e; }
.connection-status--desconectado .status-dot { background: #ef4444; }

.pause-control { display: flex; align-items: center; gap: .55rem; padding: .25rem .75rem; border-radius: 99px; background: #f8fafc; border: 1px solid #cbd5e1; box-shadow: inset 0 1px 0 white, 0 1px 2px rgba(15,23,42,0.04); }
.pause-label { font-size: .6rem; font-weight: 800; color: #64748b; }
.pause-switch { width: 28px; height: 14px; position: relative; }
.pause-switch input { opacity: 0; width: 0; height: 0; }
.pause-slider { position: absolute; cursor: pointer; inset: 0; background-color: #10b981; transition: .4s; border-radius: 34px; }
.pause-slider:before { position: absolute; content: ""; height: 10px; width: 10px; left: 2px; bottom: 2px; background-color: white; transition: .4s; border-radius: 50%; }
input:checked + .pause-slider { background-color: #ef4444; }
input:checked + .pause-slider:before { transform: translateX(14px); }

/* Modal WhatsApp: mesma classe que TestChatModal, mas estilos lá são scoped — precisamos do overlay aqui */
.chat-overlay {
  position: fixed;
  inset: 0;
  z-index: 100000;
  background: rgba(15, 15, 30, 0.88);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  box-sizing: border-box;
}

/* QR MODAL */
.qr-modal {
  background: white; border-radius: 20px; padding: 2rem 1.75rem 1.65rem; width: min(380px, calc(100vw - 2rem));
  display: flex; flex-direction: column; align-items: center; text-align: center;
  position: relative; box-shadow: 0 20px 50px rgba(0,0,0,.3);
}
.qr-modal .btn-close-modal {
  position: absolute;
  top: 0.75rem;
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
  z-index: 2;
}
.qr-modal .btn-close-modal:hover { background: #e2e8f0; color: #0f172a; }
.qr-modal h3 { font-size: 1.25rem; margin-bottom: .4rem; }
.qr-placeholder {
  position: relative;
  background: #f8fafc;
  padding: 0.75rem;
  border-radius: 12px;
  margin-bottom: 1rem;
  border: 2px dashed #cbd5e1;
  width: min(260px, 72vw);
  height: min(260px, 72vw);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
}
.qr-placeholder img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.qr-loading-overlay { display: flex; flex-direction: column; align-items: center; gap: 1rem; color: var(--c-primary); font-weight: 600; }
.qr-error { color: #ef4444; font-weight: 600; font-size: 0.9rem; }
.qr-hint-text { font-size: 0.82rem; color: #475569; line-height: 1.45; margin: 0 0 0.65rem; text-align: left; }
.pairing-box {
  width: 100%;
  margin-bottom: 0.75rem;
  padding: 0.65rem 0.85rem;
  border-radius: 10px;
  background: #f0fdf4;
  border: 1px solid #86efac;
  text-align: center;
}
.pairing-label { display: block; font-size: 0.65rem; font-weight: 800; color: #166534; text-transform: uppercase; margin-bottom: 0.25rem; }
.pairing-code { font-size: 1.35rem; font-weight: 900; letter-spacing: 0.12em; color: #14532d; }
.qr-connected-banner {
  width: 100%;
  padding: 0.85rem 1rem;
  border-radius: 12px;
  background: #ecfdf5;
  border: 1px solid #6ee7b7;
  color: #065f46;
  font-weight: 700;
  font-size: 0.9rem;
  text-align: center;
}

.login-gate__wa-hint {
  margin-top: 1rem;
  font-size: 0.78rem;
  color: #475569;
  text-align: left;
  line-height: 1.5;
  padding: 0.65rem 0.85rem;
  background: #f0fdf4;
  border-radius: 10px;
  border: 1px solid #86efac;
}
.login-gate__wa-hint code {
  font-size: 0.72rem;
  background: #fff;
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
}

.whatsapp-standalone {
  min-height: 100vh;
  padding: 1.25rem 1.5rem 2rem;
  background: linear-gradient(165deg, #eef0ff 0%, #f8fafc 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
}
.whatsapp-standalone__header {
  width: 100%;
  max-width: 520px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}
.whatsapp-standalone__brand {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  text-align: left;
}
.whatsapp-standalone__title {
  font-size: 1.15rem;
  font-weight: 800;
  margin: 0 0 0.25rem;
  color: #0f172a;
}
.whatsapp-standalone__slug {
  font-size: 0.78rem;
  color: #64748b;
  margin: 0;
  max-width: 280px;
}
.whatsapp-standalone__card {
  width: 100%;
  max-width: 380px;
  margin-top: 0.25rem;
  box-sizing: border-box;
}
.whatsapp-standalone__refresh {
  margin-top: 1rem;
  width: 100%;
}
.whatsapp-standalone__confirm {
  margin-top: 0.55rem;
  width: 100%;
}
.whatsapp-actions {
  width: 100%;
  margin-top: 0.35rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

/* EXIT OVERLAY */
.custom-exit-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 9999; display: flex; align-items: center; justify-content: center; }
.custom-exit-card { background: white; border-radius: 16px; padding: 2rem; width: 90%; max-width: 450px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); }
.exit-input { width: 100%; padding: .8rem; border-radius: 8px; border: 2px solid #e2e8f0; font-size: .95rem; outline: none; background: #f8fafc; margin-top: 1rem;}

/* Coluna de config mais larga (~62/38); no guia prioriza ainda mais o formulário */
.app-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(280px, 1fr);
  height: calc(100vh - 60px);
  max-width: 100vw;
  transition: filter var(--t-med);
}
.app-layout--onboarding {
  grid-template-columns: minmax(0, 1fr);
  min-height: 0;
  position: relative;
  z-index: 10;
}
.app-layout--embedded {
  flex: 1;
  min-height: 0;
  height: auto;
  max-height: none;
}
.app-layout--with-footer { padding-bottom: 80px; }
.app-layout--blurred { filter: blur(8px); pointer-events: none; }

.app-header {
  height: 64px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  padding: 0 1.5rem;
  justify-content: space-between;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(226, 232, 240, 0.8);
  box-shadow: 0 4px 24px -6px rgba(15, 23, 42, 0.08);
  position: sticky;
  top: 0;
  z-index: 140;
  font-size: calc(1rem * var(--header-zoom, 1));
}
.app-header--embed {
  height: auto;
  min-height: 52px;
  padding: 0.45rem 0.75rem;
  flex-wrap: wrap;
  gap: 0.35rem 0.5rem;
  row-gap: 0.25rem;
}
.app-header--embed .app-header__brand {
  flex: 1 1 auto;
  min-width: 120px;
}
.app-header--embed .app-header__actions {
  flex: 1 1 100%;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.35rem 0.5rem;
}
.app-header--embed .app-header__title {
  font-size: 0.92rem;
}
.app-header--embed .header-progress-wrap,
.app-header--embed .xp-badge,
.app-header--embed .connection-status,
.app-header--embed .btn-test,
.app-header--embed .header-zoom {
  font-size: 0.7rem;
}
.app-header--onboarding {
  z-index: 138;
}
.app-header--tutorial-dim .app-header__brand,
.app-header--tutorial-dim .persuasion-banner,
.app-header--tutorial-dim .tutorial-incentive,
.app-header--tutorial-dim .save-indicator,
.app-header--tutorial-dim .xp-badge,
.app-header--tutorial-dim .header-progress-wrap,
.app-header--tutorial-dim .pause-control,
.app-header--tutorial-dim .connection-status,
.app-header--tutorial-dim .btn-test {
  filter: blur(16px) saturate(0.8);
  opacity: 0.3;
  pointer-events: none;
  user-select: none;
}
.app-header--onboarding .btn-test {
  display: none;
}
.app-header__actions { display: flex; align-items: center; justify-content: flex-end; gap: .85rem; flex-wrap: wrap; min-width: 0; }
.app-header__brand { display: flex; align-items: center; gap: .6rem; min-width: 0; }
.app-header__dot {
  width: calc(10px * var(--header-zoom, 1));
  height: calc(10px * var(--header-zoom, 1));
  border-radius: 50%;
  background: linear-gradient(135deg, var(--c-primary), #818cf8);
  box-shadow: 0 0 10px rgba(79, 70, 229, 0.45);
}
.app-header__title {
  font-weight: 800;
  font-size: clamp(0.92rem, calc(0.9rem + 0.2vw), 1.05rem);
  letter-spacing: -0.02em;
  color: #0f172a;
  white-space: nowrap;
}
.build-stamp {
  margin-left: 0.35rem;
  font-size: calc(0.62rem * var(--header-zoom, 1));
  font-weight: 700;
  color: #64748b;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  padding: 0.12rem 0.4rem;
  border-radius: 4px;
  vertical-align: middle;
  letter-spacing: 0.02em;
}

.tutorial-incentive { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.btn-unfocus-header {
  font-size: 0.72rem !important;
  font-weight: 700;
  padding: 0.35rem 0.65rem !important;
  color: #64748b !important;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}
.btn-unfocus-header:hover { color: #0f172a !important; background: #f8fafc; }

.header-zoom {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem;
  border: 1px solid #dbeafe;
  border-radius: 999px;
  background: #f8fbff;
  flex-shrink: 0;
}
.header-zoom__btn,
.header-zoom__value {
  appearance: none;
  border: none;
  background: transparent;
  color: #334155;
  font: inherit;
  font-size: 0.76rem;
  font-weight: 700;
  line-height: 1;
  padding: 0.35rem 0.45rem;
  border-radius: 999px;
  cursor: pointer;
}
.header-zoom__btn:hover,
.header-zoom__value:hover {
  background: #e0e7ff;
  color: #312e81;
}
.header-zoom__value { min-width: 52px; }

@media (max-width: 1180px) {
  .app-header {
    height: auto;
    min-height: 64px;
    padding: 0.6rem 1rem;
    flex-wrap: wrap;
    gap: 0.6rem 0.75rem;
  }
  .app-header__brand,
  .tutorial-incentive,
  .app-header__actions {
    width: 100%;
  }
  .app-header__actions {
    justify-content: flex-start;
    gap: 0.6rem;
  }
}

@media (max-width: 760px) {
  .app-header {
    padding: 0.55rem 0.75rem;
  }
  .app-header__title {
    white-space: normal;
    line-height: 1.15;
  }
  .build-stamp {
    display: none;
  }
  .xp-badge,
  .header-progress-wrap,
  .pause-control,
  .connection-status,
  .header-zoom,
  .btn-test {
    width: 100%;
  }
  .header-zoom {
    justify-content: center;
  }
}

.qr-modal__footer {
  width: 100%;
  margin-top: 1.15rem;
  padding-top: 1rem;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: center;
  align-items: center;
}
.qr-modal__close-btn {
  appearance: none;
  cursor: pointer;
  padding: 0.7rem 2.25rem;
  border-radius: 999px;
  font-size: 0.92rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #1e293b;
  background: linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%);
  border: 1px solid #cbd5e1;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}
.qr-modal__close-btn:hover {
  color: #0f172a;
  border-color: #94a3b8;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.14);
  transform: translateY(-1px);
}
.qr-modal__close-btn:active {
  transform: translateY(0);
  box-shadow: 0 1px 6px rgba(15, 23, 42, 0.12);
}
.qr-modal__close-btn:focus-visible {
  outline: 2px solid var(--c-primary, #4f46e5);
  outline-offset: 3px;
}

/* ── Desconectar WhatsApp ── */
.wa-connected-section {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  margin: 1rem 0;
}
.wa-disconnect-row {
  display: flex;
  justify-content: center;
}
.btn-disconnect {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 1rem;
  background: white;
  color: #ef4444;
  border: 1px solid #fecaca;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-disconnect:hover:not(:disabled) {
  background: #fef2f2;
  border-color: #fca5a5;
}
.btn-disconnect:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.wa-disconnect-confirm {
  background: #fff1f2;
  border: 1px solid #fecdd3;
  border-radius: 10px;
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.wa-disconnect-confirm__text {
  font-size: 0.78rem;
  color: #be123c;
  margin: 0;
  line-height: 1.4;
  text-align: center;
}
.wa-disconnect-confirm__actions {
  display: flex;
  justify-content: center;
  gap: 0.6rem;
}
.btn-disconnect--confirm {
  background: #ef4444;
  color: white;
  border-color: #ef4444;
}
.btn-disconnect--confirm:hover:not(:disabled) {
  background: #dc2626;
  border-color: #dc2626;
  color: white;
}
.wa-spinner {
  display: inline-block;
  width: 12px; height: 12px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
</style>

<style>
/**
 * Portal KAITS (iframe): não mostrar mini-chat por etapa nem overlays que conflitam com layout estreito.
 * Mantém fallback CSS caso o markup volte a incluir .step-chat.
 */
html.REDACTED .step-chat {
  display: none !important;
}
</style>
