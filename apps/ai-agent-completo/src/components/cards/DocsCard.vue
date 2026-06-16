<script setup>
/**
 * cards/DocsCard.vue
 * Upload e gerenciamento de base de conhecimento da I.A. (RAG simulado)
 */
import { ref } from 'vue'
import { documentsService } from '../../services/api.js'
import { devLog } from '../../utils/devLog.js'

const props = defineProps({ config: Object })

const dragActive = ref(false)
const fileInput  = ref(null)
const isUploading = ref(false)

function triggerUpload() {
  fileInput.value?.click()
}

function handleDrop(e) {
  dragActive.value = false
  if (e.dataTransfer?.files) {
    processFiles(Array.from(e.dataTransfer.files))
  }
}

function handleFileSelect(e) {
  if (e.target.files) {
    processFiles(Array.from(e.target.files))
  }
}

async function processFiles(files) {
  if (!files.length) return
  isUploading.value = true
  
  try {
    const uploadedDocs = await documentsService.uploadDocuments(files)
    
    if (!props.config.docs) props.config.docs = []
    
    // Mapeia os documentos reais vindos do backend para o formato da UI
    const mappedDocs = uploadedDocs.map(d => ({
      id: d.id,
      name: d.display_name,
      size: d.size_display,
      ext: d.extension,
      status: 'processed' // Indica que já está no Qdrant
    }))
    
    props.config.docs.push(...mappedDocs)
  } catch (error) {
    devLog.error('Erro no upload de documentos:', error)
    alert('Erro ao processar arquivos. Verifique se o formato é suportado.')
  } finally {
    isUploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

const emit = defineEmits(['open-editor'])

async function removeDoc(id) {
  try {
    await documentsService.deleteDocument(id)
    props.config.docs = props.config.docs.filter(d => d.id !== id)
  } catch (error) {
    devLog.error('Erro ao excluir documento:', error)
  }
}

async function renameDoc(doc) {
  try {
    await documentsService.renameDocument(doc.id, doc.name)
  } catch (error) {
    devLog.error('Erro ao renomear documento:', error)
  }
}
</script>

<template>
  <div class="docs">
    <p class="docs__intro">
      Deseja me treinar usando seus próprios arquivos? Faça o upload de PDFs, apostilas, Txts ou tabelas Word. Lerei todos pra aprender rápido!
    </p>

    <!-- Upload Zone -->
    <div 
      class="upload-zone" 
      :class="{ 'upload-zone--active': dragActive }"
      @dragenter.prevent="dragActive = true"
      @dragleave.prevent="dragActive = false"
      @dragover.prevent
      @drop.prevent="handleDrop"
    >
      <div class="upload-zone__content">
        <template v-if="!isUploading">
          <span class="upload-icon">📂</span>
          <strong style="color:var(--c-primary); margin-bottom:.2rem;">Clique ou arraste arquivos aqui</strong>
          <span style="font-size:.7rem; color:var(--c-text-muted);">PDF, DOCX, TXT (Max 10MB)</span>
          
          <button class="btn btn-primary btn-upload-3d" @click="triggerUpload" style="margin-top:1rem;">
             <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
             Selecione os Arquivos
          </button>
        </template>
        <template v-else>
          <div class="upload-spinner"></div>
          <strong style="color:var(--c-primary); margin-top:1rem;">Processando e Indexando...</strong>
          <span style="font-size:.7rem; color:var(--c-text-muted);">Sua I.A. está lendo os documentos.</span>
        </template>
      </div>
      <input type="file" ref="fileInput" multiple style="display:none;" @change="handleFileSelect" accept=".pdf,.doc,.docx,.txt" />
    </div>

    <!-- Lista de Documentos -->
    <TransitionGroup name="fade" tag="div" class="docs-list">
      <div v-for="doc in config.docs" :key="doc.id" class="doc-item-wrapper">
        <div class="doc-item">
          <div class="doc-item__icon">{{ doc.ext }}</div>
          <div class="doc-item__info">
            <input v-model="doc.name" class="doc-input" aria-label="Nome do arquivo" @blur="renameDoc(doc)" @keyup.enter="$event.target.blur()" />
            <div class="doc-status-row">
              <span class="doc-size">{{ doc.size }}</span>
              <span v-if="doc.status === 'processed'" class="status-badge status-badge--success">Indexado</span>
            </div>
          </div>
          <div class="doc-actions">
            <button class="btn-text-edit" @click="$emit('open-editor', doc.id)" title="Abrir em tela cheia">
              ✏️ Abrir Editor Avançado
            </button>
            <button class="btn-icon" @click="removeDoc(doc.id)" title="Excluir arquivo">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      </div>
    </TransitionGroup>

  </div>
</template>

<style scoped>
.docs { display: flex; flex-direction: column; gap: 1rem; }
.docs__intro { font-size: .85rem; color: var(--c-text); background:#f0fdfa; border-left:3px solid #14b8a6; padding:.5rem .8rem; border-radius: var(--r-sm); }

/* Dropzone */
.upload-zone { border: 2.5px dashed #cbd5e1; border-radius: var(--r-md); background: #f8fafc; padding: 2rem 1rem; transition: all 0.2s; cursor: pointer; text-align: center;}
.upload-zone--active { border-color: var(--c-primary); background: #eef2ff; transform: scale(1.02); }
.upload-zone__content { display: flex; flex-direction: column; align-items: center; pointer-events: none;}
.upload-spinner { width: 30px; height: 30px; border: 3px solid #e2e8f0; border-top-color: var(--c-primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.upload-icon { font-size: 2.2rem; margin-bottom: .5rem; pointer-events: none;}

/* Botão 3D Importar */
.btn-upload-3d { 
  background: linear-gradient(to bottom, #8b5cf6, #6d28d9); 
  border-bottom: 4px solid #4c1d95; pointer-events: all;
  box-shadow: 0 4px 10px rgba(109,40,217,.3); transition: 0.1s;
}
.btn-upload-3d:active { transform: translateY(3px); border-bottom-width: 1px; }

/* Lista de Arquivos */
.docs-list { display: flex; flex-direction: column; gap: .5rem; margin-top:.5rem;}
.doc-item { display: flex; align-items: center; gap: .6rem; padding: .5rem .8rem; background: white; border: 1px solid var(--c-border); border-radius: var(--r-sm); box-shadow: var(--shadow-sm); }
.doc-item__icon { background: #e2e8f0; color: #475569; font-size: .65rem; font-weight: 800; padding: .2rem .4rem; border-radius: 4px; }
.doc-item__info { display: flex; flex-direction: column; flex: 1; }
.doc-input { border: none; font-size: .8rem; font-weight: 600; color: var(--c-text); padding: 0; background: transparent; width: 100%; outline: none; }
.doc-input:focus { color: var(--c-primary); text-decoration: underline; }
.doc-size { font-size: .65rem; color: var(--c-text-light); }
.doc-status-row { display: flex; align-items: center; gap: .5rem; }
.status-badge { font-size: 0.6rem; padding: 2px 6px; border-radius: 10px; font-weight: bold; text-transform: uppercase; }
.status-badge--success { background: #dcfce7; color: #166534; }
.doc-actions { display: flex; align-items: center; gap: .6rem; }
.btn-text-edit { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px; padding: .3rem .6rem; font-size: .7rem; font-weight: 700; color: #475569; cursor: pointer; transition: all .2s; }
.btn-text-edit:hover { background: #e2e8f0; color: var(--c-primary); }

.doc-editor-pane { margin-top: .4rem; padding: 1rem; background: #fff; border: 1.5px solid #e2e8f0; border-radius: 8px; box-shadow: inset 0 2px 4px rgba(0,0,0,.02); animation: slideDown .2s ease-out; }
.editor-header { margin-bottom: .8rem; display: flex; flex-direction: column; gap: .15rem; }
.editor-header strong { font-size: .8rem; color: #1e293b; }
.editor-header span { font-size: .7rem; color: #64748b; }
.editor-textarea { width: 100%; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: .75rem; font-size: .82rem; color: #334155; font-family: inherit; line-height: 1.6; outline: none; transition: border-color .2s; }
.editor-textarea:focus { border-color: var(--c-primary); }
.editor-footer { margin-top: .6rem; display: flex; justify-content: space-between; align-items: center; }
.editor-tip { font-size: .7rem; font-weight: 600; color: #fbbf24; }
.btn-save-text { padding: .4rem .8rem; font-size: .75rem; background: linear-gradient(to right, #14b8a6, #0d9488); border: none; }
.btn-save-text:disabled { opacity: 0.6; filter: grayscale(1); }

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
