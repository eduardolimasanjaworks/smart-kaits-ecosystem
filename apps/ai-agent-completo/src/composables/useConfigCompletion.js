/**
 * Potencial da ferramenta — só conta seções visíveis no painel (5 × 20%).
 * Cada ⭕/😊 do accordion segue os mesmos critérios.
 */

export const COMPLETION_SECTIONS = [
  {
    key: 'personality',
    label: 'Personalidade',
    showInAccordion: true,
    isDone(c) {
      return (
        c.assistantName.trim().length >= 2 &&
        c.personality.trim().length >= 12 &&
        c.greeting.trim().length >= 5
      )
    },
    pendingHint(c) {
      const missing = []
      if (c.assistantName.trim().length < 2) missing.push('nome da assistente')
      if (c.personality.trim().length < 12) missing.push('estilo de comunicação (mín. 12 caracteres)')
      if (c.greeting.trim().length < 5) missing.push('primeira mensagem ao cliente')
      return missing.length ? missing.join(' · ') : ''
    },
  },
  {
    key: 'company',
    label: 'Sobre a empresa',
    showInAccordion: false,
    isDone(c) {
      return c.companyContext.trim().length >= 20
    },
    pendingHint() {
      return 'descreva o negócio no bloco «Sobre a empresa» (mín. 20 caracteres)'
    },
  },
  {
    key: 'team',
    label: 'Equipe & Contatos',
    showInAccordion: true,
    isDone(c) {
      const hasMember = (c.teamMembers || []).some((m) => (m.name || '').trim().length >= 2)
      return hasMember && (c.fallbackContact || '').trim().length > 0
    },
    pendingHint(c) {
      const hasMember = (c.teamMembers || []).some((m) => (m.name || '').trim().length >= 2)
      if (!hasMember) return 'adicione ao menos 1 pessoa da equipe com nome'
      if (!(c.fallbackContact || '').trim()) {
        return 'escolha quem recebe a transferência quando a I.A. não souber responder'
      }
      return ''
    },
  },
  {
    key: 'faq',
    label: 'Dúvidas frequentes',
    showInAccordion: true,
    isDone(c) {
      return (c.faqItems || []).some(faqItemComplete)
    },
    pendingHint(c) {
      if (!(c.faqItems || []).length) {
        return 'adicione ao menos 1 pergunta frequente com ação definida'
      }
      const incomplete = (c.faqItems || []).filter((f) => !faqItemComplete(f))
      if (incomplete.length) {
        return 'complete pergunta + resposta ou notificação em cada item'
      }
      return ''
    },
  },
  {
    key: 'docs',
    label: 'Documentos base',
    showInAccordion: true,
    isDone(c) {
      return (c.docs || []).length > 0
    },
    pendingHint() {
      return 'envie ao menos 1 PDF ou documento na seção Documentos'
    },
  },
]

function faqItemComplete(f) {
  const q = (f.question || '').trim()
  if (q.length < 5) return false
  const type = f.actionType || 'respond'
  if (type === 'notify') return Array.isArray(f.notifyTo) && f.notifyTo.length > 0
  if (type === 'both') {
    return (f.answer || '').trim().length > 0 && Array.isArray(f.notifyTo) && f.notifyTo.length > 0
  }
  return (f.answer || '').trim().length > 0
}

export function evaluateConfigCompletion(config) {
  const c = config || {}
  const sections = COMPLETION_SECTIONS.map((def) => {
    const done = def.isDone(c)
    return {
      key: def.key,
      label: def.label,
      showInAccordion: def.showInAccordion,
      done,
      hint: done ? '' : def.pendingHint(c),
    }
  })
  const completedCount = sections.filter((s) => s.done).length
  const percent = Math.round((completedCount / sections.length) * 100)
  const status = Object.fromEntries(sections.map((s) => [s.key, s.done]))
  const hints = Object.fromEntries(
    sections.map((s) => [s.key, s.done ? '' : `${s.label} — ${s.hint}`])
  )
  const pending = sections.filter((s) => !s.done)
  return { sections, percent, status, hints, pending }
}
