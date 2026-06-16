import { watch, onUnmounted, nextTick } from 'vue'
import { configService } from '../services/api.js'

const EDIT_GUARD_MS = 2500

/**
 * WebSocket por escola: quando outro utilizador altera config ou documentos,
 * atualiza o estado local sem recarregar a página.
 *
 * `suppressConfigAutosaveRef`: quando true, o watch de autosave em App.vue não deve gravar —
 * evita loop PUT→broadcast→GET→assign→watch→PUT na mesma aba.
 *
 * `realtimeGuards` (opcional): { lastLocalEditAt, skipRefreshUntil } refs — evita sobrescrever
 * texto enquanto o utilizador digita ou logo após autosave local.
 */
export function useSchoolRealtime(
  agentConfig,
  bootstrapStatusRef,
  suppressConfigAutosaveRef = null,
  realtimeGuards = null
) {
  let ws = null
  let reconnectTimer = null
  let debounceTimer = null

  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (ws) {
      try {
        ws.close()
      } catch {
        /* noop */
      }
      ws = null
    }
  }

  function isUserEditingConfig() {
    const el = document.activeElement
    if (!el?.closest) return false
    if (!el.closest('.config-panel')) return false
    const tag = el.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
  }

  function shouldSkipConfigRefresh() {
    if (!realtimeGuards) return false
    const now = Date.now()
    if (realtimeGuards.skipRefreshUntil?.value > now) return true
    const lastEdit = realtimeGuards.lastLocalEditAt?.value || 0
    if (now - lastEdit < EDIT_GUARD_MS) return true
    if (isUserEditingConfig()) return true
    return false
  }

  function scheduleRefresh() {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(async () => {
      debounceTimer = null
      if (shouldSkipConfigRefresh()) return
      try {
        const data = await configService.getConfig()
        if (shouldSkipConfigRefresh()) return
        if (data && typeof data === 'object') {
          if (suppressConfigAutosaveRef) suppressConfigAutosaveRef.value = true
          Object.assign(agentConfig.value, data)
          await nextTick()
          if (suppressConfigAutosaveRef) suppressConfigAutosaveRef.value = false
        }
        window.dispatchEvent(new CustomEvent('smartkaits-sync'))
      } catch {
        /* falha silenciosa — utilizador já vê estado anterior */
      }
    }, 380)
  }

  function connect() {
    disconnect()
    if (bootstrapStatusRef.value !== 'ready') return
    const token = localStorage.getItem('kaits_token')
    if (!token) return

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${proto}//${window.location.host}/api/v1/ws?token=${encodeURIComponent(token)}`

    try {
      ws = new WebSocket(url)
    } catch {
      return
    }

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (
          msg.type === 'config_updated' ||
          msg.type === 'documents_updated' ||
          msg.type === 'team_updated'
        ) {
          scheduleRefresh()
        }
      } catch {
        /* payload inválido ignorado */
      }
    }

    ws.onclose = () => {
      ws = null
      if (
        bootstrapStatusRef.value === 'ready' &&
        localStorage.getItem('kaits_token')
      ) {
        reconnectTimer = setTimeout(connect, 4500)
      }
    }

    ws.onerror = () => {
      try {
        ws?.close()
      } catch {
        /* noop */
      }
    }
  }

  watch(
    bootstrapStatusRef,
    (s) => {
      if (s === 'ready') connect()
      else disconnect()
    },
    { immediate: true }
  )

  onUnmounted(() => {
    disconnect()
    if (debounceTimer) clearTimeout(debounceTimer)
  })

  return { connect, disconnect }
}
