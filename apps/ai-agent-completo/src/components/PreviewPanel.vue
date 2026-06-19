<script setup>
/**
 * PreviewPanel.vue v5
 * Design do Roteiro bastante melhorado para clara divisão (separadores e caixas mais definidas).
 */
import { computed } from 'vue'

const props = defineProps({ config: Object, activeSection: String })

function isDimmed(sectionKey) { return props.activeSection && props.activeSection !== sectionKey }

const name = computed(() => props.config.assistantName || 'a I.A.')

const toolDefs = [
  { key: 'consultCourses', triggersKey: 'consultCoursesTriggers', emoji: '📚', label: 'consultar cursos', fields: ['curso', 'modalidade', 'objetivo'], sample: 'Hoje temos cursos como Inglês.' },
  { key: 'consultStages', triggersKey: 'consultStagesTriggers', emoji: '🪜', label: 'consultar estágios do curso', fields: ['estágio', 'abreviação', 'objetivo'], sample: 'Esse curso tem níveis como Básico e Intermediário.' },
  { key: 'consultClasses', triggersKey: 'consultClassesTriggers', emoji: '🏫', label: 'consultar turmas disponíveis', fields: ['turma', 'datas', 'ocupação'], sample: 'Encontrei a turma Sábados adultos 10-12.' },
  { key: 'consultClassSchedule', triggersKey: 'consultClassScheduleTriggers', emoji: '🕒', label: 'consultar horários da turma', fields: ['data', 'hora', 'professor'], sample: 'A turma tem aulas aos sábados às 10:00.' },
  { key: 'consultPricing', triggersKey: 'consultPricingTriggers', emoji: '💵', label: 'consultar valores da turma', fields: ['taxa', 'valor', 'parcelas'], sample: 'A taxa de matrícula está em R$ 200,00.' },
  { key: 'checkFinancial', triggersKey: 'checkFinancialTriggers', emoji: '💰', label: 'consultar ficha financeira do aluno', fields: ['status', 'valor', 'boleto'], sample: 'Encontrei uma parcela vencida no valor de R$ 350,00.' },
  { key: 'listClassStudents', triggersKey: 'listClassStudentsTriggers', emoji: '🧑‍🎓', label: 'consultar alunos da turma', fields: ['aluno', 'matrícula', 'turma'], sample: 'Na turma Inglês 3A encontrei alunos como João Silva.' },
  { key: 'searchStudent', triggersKey: 'searchStudentTriggers', emoji: '🔎', label: 'buscar aluno por nome ou matrícula', fields: ['nome', 'CPF', 'e-mail'], sample: 'Localizei o aluno João Silva.' },
  { key: 'getStudentDetails', triggersKey: 'getStudentDetailsTriggers', emoji: '🪪', label: 'abrir ficha completa do aluno', fields: ['responsáveis', 'telefones', 'endereços'], sample: 'A ficha mostra o aluno João Silva e seu responsável.' },
  { key: 'consultCourseProgram', triggersKey: 'consultCourseProgramTriggers', emoji: '🧠', label: 'consultar programa do curso', fields: ['tópico', 'conteúdo', 'livro'], sample: 'Esse curso trabalha temas como apresentações e conversação inicial.' },
  { key: 'consultTeachers', triggersKey: 'consultTeachersTriggers', emoji: '👨‍🏫', label: 'consultar professores', fields: ['nome', 'CPF', 'e-mails'], sample: 'Encontrei professores cadastrados como Ana Souza.' },
  { key: 'consultDocuments', triggersKey: 'consultDocumentsTriggers', emoji: '📄', label: 'consultar documentos emitidos', fields: ['documento', 'aluno', 'emissão'], sample: 'Localizei um documento emitido para o aluno.' },
  { key: 'enrollStudent', triggersKey: 'enrollStudentTriggers', emoji: '✍️', label: 'iniciar processo de matrícula', fields: ['nome', 'curso', 'contato'], sample: 'Já posso registrar o interesse no curso desejado.' },
]
const activeTools = computed(() => toolDefs.filter(t => props.config.tools[t.key]))

function notifyLabel(notifyTo) {
  if (!notifyTo?.length || !props.config.teamMembers?.length) return ''
  return notifyTo.map(id => {
    const m = props.config.teamMembers.find(x => x.id === id)
    return m?.name || '?'
  }).join(', ')
}

const FAQ_ANSWER_TYPES = new Set(['respond', 'respond_pause', 'both', 'both_pause'])
const FAQ_NOTIFY_TYPES = new Set(['notify', 'notify_pause', 'both', 'both_pause'])

/** Compatível com itens antigos (só pauseAi + actionType legacy). */
function normalizeFaqAction(item) {
  let t = item.actionType || 'respond'
  if (item.pauseAi && !String(t).endsWith('_pause')) {
    if (t === 'respond') return 'respond_pause'
    if (t === 'notify') return 'notify_pause'
    if (t === 'both') return 'both_pause'
  }
  return t
}

function faqPreviewShowsAnswer(item) {
  return FAQ_ANSWER_TYPES.has(normalizeFaqAction(item))
}

function faqPreviewShowsNotify(item) {
  const t = normalizeFaqAction(item)
  if (!FAQ_NOTIFY_TYPES.has(t)) return false
  return Boolean(item.notifyTo?.length || (item.notifyMessage && String(item.notifyMessage).trim()))
}

function faqPreviewPauses(item) {
  return String(normalizeFaqAction(item)).endsWith('_pause')
}
</script>

<template>
  <section class="preview">
    <div class="preview__head">
      <span class="preview__badge">👁 Pré-visualização Mágica</span>
      <span class="preview__hint">Atualiza enquanto você digita →</span>
    </div>

    <div class="preview__doc">

      <!-- ══ Sobre a empresa -->
      <div class="block dimmable" :class="{ dimmed: isDimmed('company') }">
        <div class="block__heading">
          <span class="block__dot" style="background:#0ea5e9"/>
          <h3>Sobre a empresa</h3>
        </div>
        <div v-if="config.companyContext?.trim()" class="company-preview-box">
          {{ config.companyContext }}
        </div>
        <p v-else class="block__empty">← Descreva o negócio no bloco «Sobre a empresa» à esquerda</p>
      </div>

      <div class="big-divider dimmable" :class="{ dimmed: isDimmed('company') || isDimmed('personality') }" />

      <!-- ══ Personalidade -->
      <div class="block dimmable" :class="{ dimmed: isDimmed('personality') }">
        <div class="block__heading">
          <span class="block__dot" style="background:var(--c-personality)"/>
          <h3>Personalidade</h3>
        </div>
        <div class="personality-box" v-if="config.personality">
          <em>"{{ config.personality }}"</em>
        </div>
        <p v-else class="block__empty">← Defina como ela deve falar na esquerda</p>
      </div>

      <div class="big-divider dimmable" :class="{ dimmed: isDimmed('script') }" />

      <!-- ══ Roteiro -->
      <div class="block dimmable" :class="{ dimmed: isDimmed('script') }">
        <div class="block__heading">
          <span class="block__dot" style="background:var(--c-script)"/>
          <h3>Roteiro de Atendimento</h3>
        </div>

        <div v-if="config.greeting" class="bubble-initial">
          <span class="bubble-label">Saudação Inicial</span>
          <div>{{ config.greeting }}</div>
        </div>

        <div class="rules-list">
          <div v-for="(rule, idx) in config.scriptRules" :key="rule.id" class="rule-box">
            <div class="rule-box__when">
              <span class="badge-count">{{ idx + 1 }}</span>
              <strong>Se o cliente disser:</strong> "{{ rule.trigger || '...' }}"
            </div>
            <div class="rule-box__then">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:2px"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
              <strong>A I.A. vai responder:</strong> {{ rule.response || '...' }}
            </div>
          </div>
        </div>
        <p v-if="!config.scriptRules.length && !config.greeting" class="block__empty">← O roteiro fará a I.A. agir proativamente</p>
      </div>

      <div class="big-divider dimmable" :class="{ dimmed: isDimmed('faq') }" />

      <!-- ══ FAQ -->
      <div class="block dimmable" :class="{ dimmed: isDimmed('faq') }">
        <div class="block__heading">
          <span class="block__dot" style="background:var(--c-faq)"/>
          <h3>Dúvidas Frequentes</h3>
        </div>

        <div class="rules-list">
          <div v-for="(item, idx) in config.faqItems" :key="item.id" class="rule-box rule-box--faq">
            <div class="rule-box__when">
              <span class="badge-count">{{ idx + 1 }}</span>
              <strong>Dúvida:</strong> "{{ item.question || '...' }}"
            </div>
            <div class="rule-box__then" v-if="faqPreviewShowsAnswer(item)">
              <strong>Resposta:</strong> {{ item.answer || '...' }}
              <span v-if="faqPreviewPauses(item)" class="faq-pause-pill">⏸️ Pausa após</span>
            </div>
            <div class="rule-box__notify" v-if="faqPreviewShowsNotify(item)">
              <span class="notify-chip">🔔 Avisar equipe: {{ notifyLabel(item.notifyTo) }}</span>
              <p v-if="item.notifyMessage?.trim()" class="rule-box__notify-msg">{{ item.notifyMessage }}</p>
              <span v-if="faqPreviewPauses(item)" class="faq-pause-pill">⏸️ Pausa após</span>
            </div>
          </div>
        </div>
        <p v-if="!config.faqItems.length" class="block__empty">← Respostas para coisas óbvias (ex: endereço, horário)</p>
      </div>

      <div class="block dimmable" :class="{ dimmed: isDimmed('tools') }">
        <div class="block__heading">
          <span class="block__dot" style="background:var(--c-tools)"/>
          <h3>Poderes da I.A.</h3>
        </div>
        <div v-if="activeTools.length" class="tools-preview">
          <div v-for="tool in activeTools" :key="tool.key" class="tool-box">
            <div class="tool-box__title">{{ tool.emoji }} {{ tool.label }}</div>
            <div class="tool-box__fields">
              <span v-for="field in tool.fields" :key="field" class="tool-box__field">{{ field }}</span>
            </div>
            <div class="tool-box__chat">
              <div class="tool-box__bubble tool-box__bubble--user">
                <span class="tool-box__bubble-role">Pessoa</span>
                <p>“{{ (config.tools[tool.key + 'Instructions'] || 'Quando essa situação acontecer?').trim() }}”</p>
              </div>
              <div class="tool-box__bubble tool-box__bubble--ai">
                <span class="tool-box__bubble-role">I.A.</span>
                <p>{{ tool.sample }}</p>
              </div>
            </div>
            <div v-if="config.tools[tool.key + 'Instructions']" class="tool-box__usage">
              <strong>Quando usar:</strong> {{ config.tools[tool.key + 'Instructions'] }}
            </div>
            <div v-for="(trig, idx) in (config.tools[tool.triggersKey] || [])" :key="trig.id" class="tool-box__trigger">
              <span class="badge-count">{{ idx + 1 }}</span>
              <div style="flex:1">
                <div><strong>Sempre que:</strong> "{{ trig.condition || '...' }}"</div>
                <div style="color:var(--c-tools); margin-top:2px;">↳ <strong>{{ name }}</strong> usa este recurso automaticamente.</div>
              </div>
            </div>
          </div>
        </div>
        <p v-else class="block__empty">← Nenhuma integração ativada ainda</p>
      </div>

    </div>
  </section>
</template>

<style scoped>
.preview { display: flex; flex-direction: column; background: #f8f8fb; border-left: 1.5px solid var(--c-border); overflow-y: auto; position: relative;}
.preview__head { position: sticky; top: 0; display: flex; align-items: center; justify-content: space-between; padding: .9rem 1.4rem; background: rgba(248,248,251,.95); backdrop-filter: blur(8px); border-bottom: 2px solid var(--c-border); z-index: 10; }
.preview__badge { font-size: .85rem; font-weight: 700; color: #111; }
.preview__hint  { font-size: .75rem; color: var(--c-primary); font-weight: 500; }
.preview__doc   { padding: 1.5rem 1.5rem 4rem; display: flex; flex-direction: column; gap: 1.8rem; }

.big-divider { height: 2px; width: 40%; background: var(--c-border); align-self: center; border-radius: 2px; margin: .5rem 0;}

.block { display: flex; flex-direction: column; gap: 1rem; }
.block__heading { display: flex; align-items: center; gap: .5rem; }
.block__dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.block__heading h3 { font-size: .85rem; text-transform: uppercase; letter-spacing: .08em; color: var(--c-text-muted); font-weight: 800; }

.block__empty { font-size: .82rem; color: var(--c-text-light); font-style: italic; background: #f1f1f5; padding: .6rem 1rem; border-radius: var(--r-md); border: 1px dashed #d1d1db; }

/* Styling elements to look like chat / clear boxes */
.company-preview-box {
  font-size: .92rem;
  line-height: 1.55;
  color: var(--c-text);
  background: white;
  padding: 1rem 1.25rem;
  border-radius: var(--r-md);
  border-left: 3px solid #0ea5e9;
  box-shadow: var(--shadow-sm);
  white-space: pre-wrap;
  word-break: break-word;
}

.personality-box { font-size: .95rem; line-height: 1.6; color: var(--c-text); background: white; padding: 1rem 1.25rem; border-radius: var(--r-md); border-left: 3px solid var(--c-personality); box-shadow: var(--shadow-sm);}

.bubble-initial { background: #f0fdf4; border: 1px solid #bbf7d0; box-shadow: var(--shadow-sm); border-radius: var(--r-md); padding: 1rem; position: relative; font-size: .95rem; line-height: 1.5; color: #166534; }
.bubble-label { position: absolute; top: -10px; left: 12px; background: #22c55e; color: white; font-size: .65rem; text-transform: uppercase; padding: .15rem .5rem; border-radius: 99px; font-weight: 700; letter-spacing:.05em;}

.rules-list { display: flex; flex-direction: column; gap: .8rem; }
.rule-box { background: white; border: 1px solid var(--c-border); box-shadow: 0 4px 6px -1px rgba(0,0,0,.03); border-radius: var(--r-md); padding: .85rem 1.1rem; display: flex; flex-direction: column; gap: .6rem; }
.rule-box__when { font-size: .9rem; color: var(--c-text); display: flex; gap: .4rem; flex-wrap: wrap; }
.rule-box__then { font-size: .88rem; color: var(--c-text-muted); background: #f9f9fb; padding: .5rem .75rem; border-radius: 4px; display: flex; align-items: flex-start; gap: .3rem; }

.rule-box--faq { border-left: 3px solid var(--c-faq); }
.rule-box__notify { margin-top: .2rem; display: flex; flex-direction: column; align-items: flex-start; gap: 0.35rem; }
.notify-chip { background: #fff1f2; color: #be123c; border: 1px solid #fecdd3; padding: .2rem .6rem; border-radius: 99px; font-size: .75rem; font-weight: 600; display: inline-flex; align-items: center;}
.rule-box__notify-msg { font-size: 0.78rem; color: #475569; margin: 0; line-height: 1.45; max-width: 100%; }
.faq-pause-pill {
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #991b1b;
  background: #fee2e2;
  border: 1px solid #fecaca;
  padding: 0.15rem 0.45rem;
  border-radius: 6px;
}

.tools-preview { display: flex; flex-direction: column; gap: .8rem; }
.tool-box { background: white; border: 1.5px solid #bfdbfe; border-radius: var(--r-md); padding: .85rem 1rem; box-shadow: var(--shadow-sm); }
.tool-box__title { font-size: .9rem; font-weight: 700; color: #1e3a8a; margin-bottom: .6rem; display: flex; align-items: center; gap: .4rem; }
.tool-box__fields { display: flex; flex-wrap: wrap; gap: .35rem; margin-bottom: .6rem; }
.tool-box__field { display: inline-flex; align-items: center; padding: .18rem .5rem; border-radius: 999px; background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; font-size: .72rem; font-weight: 700; }
.tool-box__chat { display: flex; flex-direction: column; gap: .45rem; margin-bottom: .5rem; }
.tool-box__bubble { display: flex; flex-direction: column; gap: .2rem; max-width: 92%; padding: .6rem .7rem; border-radius: 12px; }
.tool-box__bubble p { margin: 0; font-size: .8rem; line-height: 1.45; }
.tool-box__bubble-role { font-size: .63rem; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; }
.tool-box__bubble--user { align-self: flex-start; background: #f8fafc; border: 1px solid #dbeafe; color: #334155; }
.tool-box__bubble--user .tool-box__bubble-role { color: #1d4ed8; }
.tool-box__bubble--ai { align-self: flex-end; background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
.tool-box__bubble--ai .tool-box__bubble-role { color: #15803d; }
.tool-box__usage { font-size: .8rem; color: var(--c-text); background: #f8fafc; border-radius: 8px; padding: .55rem .65rem; margin-bottom: .5rem; line-height: 1.45; }
.tool-box__trigger { display: flex; align-items: flex-start; gap: .6rem; font-size: .85rem; background: #f8fafc; padding: .5rem; border-radius: 6px; }

</style>
