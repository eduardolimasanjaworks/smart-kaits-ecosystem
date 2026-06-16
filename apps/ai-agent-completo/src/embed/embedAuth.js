/**
 * Ponte de autenticação quando o Smart Kaits roda dentro de um iframe (ex.: KAITS).
 * — Fragmento #access_token=… ou #kaits_token=… (não vai para logs HTTP do servidor de páginas)
 * — Fragmento opcional #…&kaits_host_bearer=… (Bearer do portal para a API do Kaits; preferir postMessage)
 * — postMessage: SMART_KAITS_AUTH (JWT Smart Kaits) e SMART_KAITS_KAITS_HOST_BEARER (Bearer API Kaits)
 */

/** localStorage: token Bearer fornecido pela página hospedeira para chamadas à API REST do Kaits (além do JWT Smart Kaits). */
export const STORAGE_KAITS_HOST_API_BEARER = 'kaits_host_api_bearer'

export function getKaitsHostApiBearer() {
  return localStorage.getItem(STORAGE_KAITS_HOST_API_BEARER) || ''
}

export function setKaitsHostApiBearer(token) {
  if (token && typeof token === 'string') {
    localStorage.setItem(STORAGE_KAITS_HOST_API_BEARER, token)
  }
}

export function clearKaitsHostApiBearer() {
  localStorage.removeItem(STORAGE_KAITS_HOST_API_BEARER)
}

/**
 * Lê JWT Smart Kaits e, no mesmo hash, opcionalmente o Bearer do hospedeiro (API Kaits).
 * Limpa o hash da barra de endereço se houver access_token.
 */
export function consumeAccessTokenFromHash() {
  const raw = window.location.hash?.replace(/^#/, '') || ''
  if (!raw) return false
  const params = new URLSearchParams(raw)
  const hostBearer =
    params.get('kaits_host_bearer') || params.get('host_kaits_bearer') || params.get('kaits_api_bearer')
  if (hostBearer && hostBearer.length > 0) {
    setKaitsHostApiBearer(hostBearer)
  }
  const token = params.get('access_token') || params.get('kaits_token')
  if (!token || token.length < 20) {
    if (hostBearer) {
      const clean = `${window.location.pathname}${window.location.search || ''}`
      window.history.replaceState(null, '', clean)
      return false
    }
    return false
  }
  localStorage.setItem('kaits_token', token)
  const clean = `${window.location.pathname}${window.location.search || ''}`
  window.history.replaceState(null, '', clean)
  return true
}

export function getEmbedAllowedOrigins() {
  const raw = import.meta.env.VITE_EMBED_ALLOWED_ORIGINS || ''
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

/**
 * Listener seguro: só aceita origens na allowlist (produção deve sempre configurar).
 *
 * @param {(jwt: string) => void} onSmartKaitsJwt — JWT de sessão Smart Kaits.
 * @param {(bearer: string) => void} [onHostKaitsApiBearer] — opcional: Bearer para API REST do Kaits (hospedeiro).
 */
export function createEmbedPostMessageHandler(onSmartKaitsJwt, onHostKaitsApiBearer) {
  return function handleEmbedMessage(ev) {
    const allowed = getEmbedAllowedOrigins()
    if (allowed.length && !allowed.includes(ev.origin)) {
      return
    }
    const d = ev.data
    if (!d || typeof d !== 'object') return

    if (d.type === 'SMART_KAITS_KAITS_HOST_BEARER' || d.type === 'KAITS_HOST_API_BEARER') {
      const bearer = d.token ?? d.bearer
      if (typeof bearer !== 'string' || !bearer.length) return
      setKaitsHostApiBearer(bearer)
      onHostKaitsApiBearer?.(bearer)
      return
    }

    const okType = d.type === 'SMART_KAITS_AUTH' || d.type === 'KAITS_EMBED_TOKEN'
    if (!okType) return
    const tok = d.access_token || d.token
    if (typeof tok !== 'string' || tok.length < 20) return
    onSmartKaitsJwt(tok)
  }
}

export function isEmbeddedInIframe() {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

/**
 * Pede ao hospedeiro (página que embute o iframe) colocar o iframe em tela cheia.
 * O botão «Tela cheia» fica só no Smart Kaits; o pai só implementa este listener.
 *
 * Contrato postMessage: `{ type: 'SMART_KAITS_REQUEST_FULLSCREEN' }`
 * Origem: validar contra a origem do build do Smart Kaits (ex. https://aiagent…).
 */
export function requestParentFullscreen() {
  if (!isEmbeddedInIframe()) return false
  const origins = getEmbedAllowedOrigins()
  const targets = origins.length ? origins : ['*']
  let sent = false
  for (const target of targets) {
    try {
      window.parent.postMessage({ type: 'SMART_KAITS_REQUEST_FULLSCREEN' }, target)
      sent = true
    } catch {
      /* tenta próxima origem */
    }
  }
  return sent
}
