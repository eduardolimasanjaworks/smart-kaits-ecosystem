import axios from 'axios'
import { getKaitsHostApiBearer, clearKaitsHostApiBearer } from '../embed/embedAuth.js'

// Criamos uma instância do axios configurada para o backend
export const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  }
})

// Interceptamos as requisições para adicionar o token JWT
api.interceptors.request.use(config => {
  const token = localStorage.getItem('kaits_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Serviços de Domínios ───────────────

export const authService = {
  async login(slug, password) {
    const res = await api.post('/auth/login', { slug, password })
    localStorage.setItem('kaits_token', res.data.access_token)
    return res.data
  },
  /**
   * Chamada típica do servidor do portal (não exponha EMBED_TRUST_SECRET no browser).
   * Retorno igual ao login — access_token já pode ir para #fragment ou postMessage.
   */
  async embedHandshake({ school_slug, ts, sig }) {
    const res = await api.post('/auth/embed-handshake', {
      school_slug,
      ts,
      sig,
    })
    localStorage.setItem('kaits_token', res.data.access_token)
    return res.data
  },
  logout() {
    localStorage.removeItem('kaits_token')
    clearKaitsHostApiBearer()
  },
  async memberLogin(schoolSlug, email, password) {
    const res = await api.post('/auth/member-login', {
      school_slug: schoolSlug,
      email,
      password,
    })
    localStorage.setItem('kaits_token', res.data.access_token)
    return res.data
  },
  async getSession() {
    const res = await api.get('/auth/session')
    return res.data
  },
}

export const membersService = {
  async list() {
    const res = await api.get('/schools/members')
    return res.data
  },
  async create(payload) {
    const res = await api.post('/schools/members', payload)
    return res.data
  },
  async remove(memberId) {
    await api.delete(`/schools/members/${memberId}`)
  },
}

export const configService = {
  async getConfig() {
    const res = await api.get('/me/config')
    return res.data
  },
  async saveConfig(configData) {
    const res = await api.put('/me/config', configData)
    return res.data
  }
}

export const documentsService = {
  async listDocuments() {
    const res = await api.get('/me/documents')
    return res.data
  },
  async uploadDocuments(files) {
    const formData = new FormData()
    files.forEach(f => formData.append('files', f))
    const res = await api.post('/me/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return res.data
  },
  async renameDocument(docId, newName) {
    const res = await api.patch(`/me/documents/${docId}`, { display_name: newName })
    return res.data
  },
  async deleteDocument(docId) {
    await api.delete(`/me/documents/${docId}`)
  },
  async updateManualContent(docId, text) {
    const res = await api.put(`/me/documents/${docId}/content`, { text })
    return res.data
  },
  async getFullText(docId) {
    const res = await api.get(`/me/documents/${docId}/full-text`)
    return res.data
  }
}

export const whatsappService = {
  /** Normalmente segundos; teto cobre webhook + duas rondas de poll + restart opcional no backend. */
  async getConnect() {
    const res = await api.get('/whatsapp/connect', { timeout: 120000 })
    return res.data
  },
  /** Evolution: `connected` true quando `state === open` na instância da escola. */
  async getStatus() {
    const res = await api.get('/whatsapp/status', { timeout: 25000 })
    return res.data
  },
  /** Evolution GET /instance/fetchInstances (só a instância desta escola). */
  async getInstanceMeta() {
    const res = await api.get('/whatsapp/instance')
    return res.data
  },
  /** Evolution PUT /instance/restart/{instance} */
  async restartInstance() {
    const res = await api.post('/whatsapp/restart')
    return res.data
  },
  /** Evolution DELETE /instance/logout/{instance} */
  async logoutInstance() {
    const res = await api.post('/whatsapp/logout')
    return res.data
  },
  /** Evolution DELETE /instance/delete/{instance} — só acesso principal. */
  async deleteInstance() {
    const res = await api.delete('/whatsapp/instance')
    return res.data
  },
  /** Evolution POST /chat/markMessageAsRead/{instance} */
  async markMessagesRead(readMessages) {
    const res = await api.post('/whatsapp/chat/mark-read', { readMessages })
    return res.data
  },
  /** Evolution POST /message/sendText/{instance} */
  async sendText(number, text) {
    const res = await api.post('/whatsapp/send-text', { number, text })
    return res.data
  },
}

export const aiService = {
  async processChat(text, history = [], kaitsToken = null, userIdentifier = null) {
    const payload = { text, history }
    if (kaitsToken) payload.kaits_token = kaitsToken
    if (userIdentifier) payload.user_identifier = userIdentifier
    const res = await api.post('/ai/chat', payload)
    return res.data
  },
  async teachByInstruction(text) {
    const res = await api.post('/ai/builder/text', { text })
    return res.data
  }
}
export const chatwootService = {
  async getSsoConfig() {
    const res = await api.get('/chatwoot/sso-config', {
      params: { v: Date.now() },
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0'
      }
    })
    return res.data
  }
}

/** Base URL da API REST do portal Kaits (documento pai / host). Ex.: https://app.kaits.com.br/api */
export function getKaitsPortalApiBase() {
  const raw = import.meta.env.VITE_KAITS_PORTAL_API_URL || ''
  return String(raw).replace(/\/$/, '')
}

/**
 * Chamadas à API do Kaits com o Bearer enviado pelo hospedeiro (postMessage `SMART_KAITS_KAITS_HOST_BEARER` ou hash).
 * Não usa o JWT Smart Kaits — só `kaits_host_api_bearer` no storage.
 */
export async function kaitsPortalFetch(path, options = {}) {
  const base = getKaitsPortalApiBase()
  if (!base) {
    throw new Error(
      'Defina VITE_KAITS_PORTAL_API_URL no build (ex. .env.local) para chamar a API do Kaits a partir do embed.'
    )
  }
  const bearer = getKaitsHostApiBearer()
  const rel = path.startsWith('/') ? path : `/${path}`
  const url = path.startsWith('http') ? path : `${base}${rel}`
  const headers = new Headers(options.headers || {})
  if (
    !headers.has('Content-Type') &&
    options.body !== undefined &&
    typeof options.body === 'string'
  ) {
    headers.set('Content-Type', 'application/json')
  }
  if (bearer) {
    headers.set('Authorization', `Bearer ${bearer}`)
  }
  return fetch(url, { ...options, headers })
}

export {
  getKaitsHostApiBearer,
  clearKaitsHostApiBearer,
  STORAGE_KAITS_HOST_API_BEARER,
} from '../embed/embedAuth.js'
