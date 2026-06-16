<script setup>
/**
 * AdvancedDocEditor.vue
 * Editor premium estilo "Google Docs" para revisão de base de conhecimento.
 * Suporta paginação, numeração de linhas e auto-jump para trechos.
 */
import { ref, onMounted, nextTick } from 'vue'
import { documentsService } from '../../services/api.js'
import { devLog } from '../../utils/devLog.js'

const props = defineProps({
  docId: String,
  initialTarget: Object // { page, lineStart }
})

const emit = defineEmits(['close', 'updated'])

const loading = ref(true)
const docName = ref('')
const pages = ref([])
const isSaving = ref(false)

async function loadFullDoc() {
  loading.value = true
  try {
    const res = await documentsService.getFullText(props.docId)
    docName.value = res.name
    pages.value   = res.pages
    
    if (props.initialTarget) {
      await nextTick()
      jumpToTarget()
    }
  } catch (e) {
    devLog.error(e)
  } finally {
    loading.value = false
  }
}

function jumpToTarget() {
  const { page, lineStart } = props.initialTarget
  const el = document.getElementById(`line-${page}-${lineStart}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('line-highlight')
    setTimeout(() => el.classList.remove('line-highlight'), 3000)
  }
}

async function saveChanges() {
  isSaving.value = true
  try {
    // Reconstruímos o texto consolidado para o chunker
    const fullText = pages.value.map(p => p.lines.join('\n')).join('\n')
    await documentsService.updateManualContent(props.docId, fullText)
    await documentsService.renameDocument(props.docId, docName.value)
    emit('updated')
    emit('close')
  } catch (e) {
    alert('Erro ao salvar documentos.')
  } finally {
    isSaving.value = false
  }
}

onMounted(() => {
  loadFullDoc()
})
</script>

<template>
  <div class="advanced-editor">
    <!-- Header Estilo Docs -->
    <header class="editor-header">
      <div class="header-left">
        <span class="back-btn" @click="emit('close')">←</span>
        <div class="file-name-wrapper">
          <input v-model="docName" class="doc-name-input" placeholder="Nome do documento" />
          <span class="save-status">{{ isSaving ? 'Salvando...' : 'Salvo no Smart Kaits' }}</span>
        </div>
      </div>
      <div class="header-actions">
         <button class="btn btn-primary" :disabled="isSaving" @click="saveChanges">
           {{ isSaving ? 'Sincronizando...' : 'Concluir e Re-indexar' }}
         </button>
         <button class="btn-icon-close" @click="emit('close')">✕</button>
      </div>
    </header>

    <!-- Área Principal de Edição -->
    <main class="editor-viewport">
      <div v-if="loading" class="editor-loading">
        <div class="spinner"></div>
        <p>Lendo e organizando páginas...</p>
      </div>

      <div v-else class="pages-container">
        <div 
          v-for="page in pages" 
          :key="page.page" 
          class="page-sheet"
          :data-page="page.page"
        >
          <div class="page-header">Página {{ page.page }}</div>
          
          <div class="page-content">
            <div v-for="(line, idx) in page.lines" :key="idx" 
                 :id="`line-${page.page}-${idx + 1}`"
                 class="line-row">
              <span class="line-number">{{ idx + 1 }}</span>
              <div 
                contenteditable="true" 
                class="line-text"
                @blur="(e) => page.lines[idx] = e.target.innerText"
              >{{ line }}</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.advanced-editor {
  position: fixed; inset: 0; background: #f8f9fa; z-index: 99999;
  display: flex; flex-direction: column; animation: slideUp .4s ease-out;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

/* Header */
.editor-header {
  height: 64px; background: white; border-bottom: 1px solid #dadce0;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 1.5rem; flex-shrink: 0;
}
.header-left { display: flex; align-items: center; gap: 1rem; }
.back-btn { font-size: 1.5rem; color: #5f6368; cursor: pointer; padding: 4px 8px; border-radius: 50%; }
.back-btn:hover { background: #f1f3f4; }

.file-name-wrapper { display: flex; flex-direction: column; }
.doc-name-input { 
  border: 1px solid transparent; font-size: 1.15rem; font-weight: 600; 
  color: #202124; padding: 2px 4px; border-radius: 4px; width: fit-content;
}
.doc-name-input:hover { border-color: #dadce0; }
.doc-name-input:focus { border-color: var(--c-primary); outline: none; background: white; }
.save-status { font-size: .7rem; color: #70757a; margin-left: 4px; }

.header-actions { display: flex; align-items: center; gap: 1rem; }
.btn-icon-close { background: transparent; border: none; font-size: 1.2rem; cursor: pointer; color: #5f6368; }

/* Viewport */
.editor-viewport { flex: 1; overflow-y: auto; padding: 2rem 0; scroll-behavior: smooth; }
.pages-container { display: flex; flex-direction: column; align-items: center; gap: 2rem; }

/* Página Estilo Google Docs */
.page-sheet {
  background: white; width: 210mm; min-height: 297mm;
  box-shadow: 0 1px 3px rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15);
  padding: 2.5rem 3rem; position: relative;
}
.page-header {
  position: absolute; top: 1rem; right: 1.5rem;
  font-size: .7rem; font-weight: 700; color: #dadce0; text-transform: uppercase;
}

/* Linhas */
.line-row { display: flex; align-items: flex-start; gap: 1.5rem; margin-bottom: 2px; }
.line-number {
  width: 24px; text-align: right; font-size: .7rem; color: #bdc1c6;
  user-select: none; margin-top: 4px; flex-shrink: 0;
}
.line-text {
  flex: 1; min-height: 1.5rem; font-size: .95rem; line-height: 1.5; color: #3c4043;
  outline: none; word-break: break-all;
}
.line-text:focus { background: #f8f9ff; box-shadow: 0 0 0 2px #e8eaff; border-radius: 2px; }

.line-highlight { animation: highlightRow 3s ease-out; }
@keyframes highlightRow {
  0% { background: #fef3c7; box-shadow: 0 0 15px #fde68a; }
  100% { background: transparent; }
}

.editor-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #5f6368; }
.spinner { width: 32px; height: 32px; border: 4px solid #f3f3f3; border-top: 4px solid var(--c-primary); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 1rem; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
</style>
