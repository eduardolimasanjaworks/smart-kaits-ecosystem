<script setup>
/**
 * cards/AuditCard.vue
 * Exibe o histórico de todas as ações da ferramenta (Auditoria).
 */
import { ref, onMounted } from 'vue'
import { api } from '../../services/api.js'
import { devLog } from '../../utils/devLog.js'

const logs = ref([])
const loading = ref(false)

async function loadLogs() {
  loading.value = true
  try {
    const res = await api.get('/me/audit/logs')
    logs.value = res.data
  } catch (e) {
    logs.value = []
    const st = e?.response?.status
    if (st !== 403 && st !== 401) {
      devLog.error('Erro ao carregar auditoria', e)
    }
  } finally {
    loading.value = false
  }
}

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit' })
}

onMounted(() => {
  loadLogs()
})
</script>

<template>
  <div class="audit">
    <div class="audit-header">
       <span class="audit-title">Histórico de Alterações</span>
       <button class="btn-refresh" @click="loadLogs" :disabled="loading">
         {{ loading ? '...' : '🔄 Atualizar' }}
       </button>
    </div>

    <div v-if="logs.length === 0 && !loading" class="audit-empty">
      Nenhuma ação registrada ainda.
    </div>

    <div class="audit-list">
      <div v-for="log in logs" :key="log.id" class="audit-item">
        <div class="audit-item__time">{{ formatDate(log.created_at) }}</div>
        <div class="audit-item__content">
          <div class="audit-item__main">
            <span class="audit-badge" :data-action="log.action">{{ log.action }}</span>
            <span class="audit-target">{{ log.target }}</span>
          </div>
          <p class="audit-detail">{{ log.detail }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.audit { display: flex; flex-direction: column; gap: 1rem; }
.audit-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: .5rem; }
.audit-title { font-size: .85rem; font-weight: 700; color: #1e293b; }
.btn-refresh { background: transparent; border: none; font-size: .7rem; color: var(--c-primary); font-weight: 600; cursor: pointer; }

.audit-list { display: flex; flex-direction: column; gap: .75rem; max-height: 400px; overflow-y: auto; padding-right: .5rem; }
.audit-item { display: flex; gap: .8rem; align-items: flex-start; }
.audit-item__time { font-size: .65rem; color: #94a3b8; width: 60px; flex-shrink: 0; line-height: 1.4; }
.audit-item__content { flex: 1; }
.audit-item__main { display: flex; align-items: center; gap: .5rem; margin-bottom: .2rem; }

.audit-badge { font-size: .6rem; font-weight: 800; text-transform: uppercase; padding: .15rem .45rem; border-radius: 4px; background: #f1f5f9; color: #475569; }
.audit-badge[data-action="config_update"] { background: #dcfce7; color: #166534; }
.audit-badge[data-action="doc_upload"] { background: #e0f2fe; color: #075985; }
.audit-badge[data-action="doc_edit"] { background: #fef9c3; color: #854d0e; }

.audit-target { font-size: .75rem; font-weight: 600; color: #334155; }
.audit-detail { font-size: .7rem; color: #64748b; line-height: 1.4; margin: 0; }

.audit-empty { text-align: center; font-size: .8rem; color: #94a3b8; padding: 2rem 0; }
</style>
