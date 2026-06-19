<script setup>
/**
 * cards/ToolsCard.vue v9 — Tools mais didáticas, práticas e separadas por ação real
 */
const props = defineProps({ config: Object })

const toolDefs = [
  {
    key: 'consultCourses',
    emoji: '📚',
    label: 'Consultar cursos',
    audience: 'Atendimento',
    description: 'Mostra os cursos cadastrados no KAITS.',
    reads: 'Lê nomes dos cursos, abreviações, objetivo e modalidade.',
    exampleUse: 'Se você quiser que alguém saiba quais cursos a escola oferece, ative esta função.',
    questionExample: 'Exemplo de leitura: "Quais cursos vocês têm disponíveis hoje?"',
    governanceHint: 'Na maioria dos casos, essa consulta pode ficar disponível para todos.',
    triggersKey: 'consultCoursesTriggers',
    usagePlaceholder: 'Ex: use quando perguntarem quais cursos existem, quais modalidades há ou quando a pessoa quiser conhecer a oferta da escola.',
  },
  {
    key: 'consultStages',
    emoji: '🪜',
    label: 'Consultar estágios ou níveis do curso',
    audience: 'Atendimento',
    description: 'Mostra os estágios, níveis ou módulos ligados a um curso.',
    reads: 'Lê nome do estágio, abreviação, objetivo e modalidade do estágio.',
    exampleUse: 'Se você quiser explicar os níveis de um curso, como básico, intermediário ou avançado, ative esta função.',
    questionExample: 'Exemplo de leitura: "Quais níveis existem no curso de inglês?"',
    governanceHint: 'Na maioria dos casos, essa consulta pode ficar disponível para todos.',
    triggersKey: 'consultStagesTriggers',
    usagePlaceholder: 'Ex: use quando a pessoa perguntar pelos níveis, estágios ou etapas de um curso específico.',
  },
  {
    key: 'consultClasses',
    emoji: '🏫',
    label: 'Consultar turmas disponíveis',
    audience: 'Atendimento',
    description: 'Mostra as turmas disponíveis de um estágio ou curso.',
    reads: 'Lê nome da turma, limite, ocupação, datas, coordenador, modalidade e período letivo.',
    exampleUse: 'Se você quiser que alguém saiba quais turmas estão disponíveis, use esta função.',
    questionExample: 'Exemplo de leitura: "Quais turmas de inglês intermediário estão disponíveis?"',
    governanceHint: 'Na maioria dos casos, essa consulta pode ficar disponível para todos.',
    triggersKey: 'consultClassesTriggers',
    usagePlaceholder: 'Ex: use quando perguntarem por vagas, período letivo ou quais turmas estão disponíveis.',
  },
  {
    key: 'consultClassSchedule',
    emoji: '🕒',
    label: 'Consultar horários e aulas de uma turma',
    audience: 'Atendimento',
    description: 'Mostra a agenda da turma e as aulas cadastradas.',
    reads: 'Lê nome da aula, data, hora, duração, professor, sala, link da sala e modalidade.',
    exampleUse: 'Se você quiser que um aluno saiba quais são os horários da turma, use esta função.',
    questionExample: 'Exemplo de leitura: "Quais são os horários da turma de terça e quinta?"',
    governanceHint: 'Você pode deixar essa consulta disponível para todos ou restringir à equipe, conforme seu processo.',
    triggersKey: 'consultClassScheduleTriggers',
    usagePlaceholder: 'Ex: use quando a pessoa perguntar sobre grade, calendário, horários ou aulas de uma turma específica.',
  },
  {
    key: 'consultPricing',
    emoji: '💵',
    label: 'Consultar valores de uma turma',
    audience: 'Atendimento',
    description: 'Mostra valores, matrícula, material e mensalidades da turma.',
    reads: 'Lê nome da taxa, tipo, valor, desconto, antecipação e quantidade de parcelas.',
    exampleUse: 'Se você quiser responder sobre mensalidade, taxa de matrícula ou preço do curso, use esta função.',
    questionExample: 'Exemplo de leitura: "Qual é o valor da turma de inglês noturno?"',
    governanceHint: 'Se o valor não deve aparecer para qualquer pessoa, restrinja os contatos abaixo.',
    triggersKey: 'consultPricingTriggers',
    usagePlaceholder: 'Ex: use quando perguntarem preço, mensalidade, matrícula, taxa, material didático ou parcelamento.',
  },
  {
    key: 'checkFinancial',
    emoji: '💰',
    label: 'Consultar ficha financeira do aluno',
    audience: 'Equipe interna',
    description: 'Consulta pendências, pagamentos, boletos e lançamentos financeiros do aluno.',
    reads: 'Lê status do pagamento, vencimento, descrição, valor, curso, turma, link do boleto e linha digitável.',
    exampleUse: 'Se você quiser que um funcionário consulte pelo WhatsApp a situação financeira de um aluno, use esta função.',
    questionExample: 'Exemplo de leitura: "Veja se o aluno João tem boleto vencido e me passe o link."',
    governanceHint: 'Geralmente deve ficar restrita à equipe financeira ou secretaria.',
    triggersKey: 'checkFinancialTriggers',
    usagePlaceholder: 'Ex: use quando a secretaria pedir para verificar pendências, boletos, pagamentos vencidos ou ficha financeira de um aluno.',
  },
  {
    key: 'listClassStudents',
    emoji: '🧑‍🎓',
    label: 'Consultar alunos de uma turma',
    audience: 'Equipe interna',
    description: 'Lista as matrículas e os alunos vinculados a uma turma.',
    reads: 'Lê número da matrícula, nome do aluno, curso, estágio, turma e movimentações da matrícula.',
    exampleUse: 'Se você quiser que um funcionário consulte por WhatsApp quais são os alunos de determinada turma, use esta função.',
    questionExample: 'Exemplo de leitura: "Me traga os alunos matriculados na turma 3A de inglês."',
    governanceHint: 'Geralmente deve ficar restrita à secretaria, coordenação ou equipe pedagógica.',
    triggersKey: 'listClassStudentsTriggers',
    usagePlaceholder: 'Ex: use quando a equipe pedir a lista de alunos de uma turma, movimentações de matrícula ou conferência de turma.',
  },
  {
    key: 'searchStudent',
    emoji: '🔎',
    label: 'Buscar aluno por nome, CPF ou matrícula',
    audience: 'Equipe interna',
    description: 'Faz a busca inicial de alunos cadastrados.',
    reads: 'Lê nome, CPF, RG, e-mails e dados básicos do aluno encontrado.',
    exampleUse: 'Se você quiser localizar rapidamente um aluno pelo nome, CPF, e-mail ou matrícula, use esta função.',
    questionExample: 'Exemplo de leitura: "Procure o aluno João Silva pelo CPF."',
    governanceHint: 'Geralmente deve ficar restrita à equipe.',
    triggersKey: 'searchStudentTriggers',
    usagePlaceholder: 'Ex: use quando a equipe precisar localizar cadastro de aluno pelo nome, CPF, RG, e-mail ou matrícula.',
  },
  {
    key: 'getStudentDetails',
    emoji: '🪪',
    label: 'Ver ficha completa de um aluno',
    audience: 'Equipe interna',
    description: 'Mostra a ficha detalhada de um aluno já identificado.',
    reads: 'Lê dados cadastrais, documentos, e-mails, telefones, endereços, matrículas e responsáveis.',
    exampleUse: 'Se você quiser abrir a ficha completa de um aluno já encontrado, use esta função.',
    questionExample: 'Exemplo de leitura: "Abra a ficha completa do aluno de ID 123."',
    governanceHint: 'Deixe restrita à equipe, pois lê dados pessoais.',
    triggersKey: 'getStudentDetailsTriggers',
    usagePlaceholder: 'Ex: use quando a equipe precisar ver a ficha completa, os responsáveis ou o histórico de matrículas de um aluno específico.',
  },
  {
    key: 'consultCourseProgram',
    emoji: '🧠',
    label: 'Consultar programa do curso',
    audience: 'Atendimento',
    description: 'Mostra o conteúdo programático do curso ou estágio.',
    reads: 'Lê título do tópico, tempo, livro, unidade, página, conteúdo, tarefas e objetivos.',
    exampleUse: 'Se você quiser explicar o que será ensinado em um curso, use esta função.',
    questionExample: 'Exemplo de leitura: "O que é estudado no curso de inglês avançado?"',
    governanceHint: 'Na maioria dos casos, essa consulta pode ficar disponível para todos.',
    triggersKey: 'consultCourseProgramTriggers',
    usagePlaceholder: 'Ex: use quando perguntarem conteúdo do curso, programa, temas estudados, livros ou objetivos de aprendizagem.',
  },
  {
    key: 'consultTeachers',
    emoji: '👨‍🏫',
    label: 'Consultar professores',
    audience: 'Equipe interna',
    description: 'Mostra os professores habilitados da escola.',
    reads: 'Lê nome do professor, CPF, RG e e-mails cadastrados.',
    exampleUse: 'Se você quiser que alguém da coordenação consulte os professores cadastrados, use esta função.',
    questionExample: 'Exemplo de leitura: "Quais professores estão cadastrados para essa unidade?"',
    governanceHint: 'Normalmente deve ficar restrita à equipe.',
    triggersKey: 'consultTeachersTriggers',
    usagePlaceholder: 'Ex: use quando a coordenação ou secretaria precisar consultar professores cadastrados.',
  },
  {
    key: 'consultDocuments',
    emoji: '📄',
    label: 'Consultar documentos emitidos',
    audience: 'Equipe interna',
    description: 'Busca documentos emitidos para aluno ou matrícula.',
    reads: 'Lê nome do documento, aluno, curso/turma, matrícula e data de emissão.',
    exampleUse: 'Se você quiser que a secretaria localize um documento já emitido, use esta função.',
    questionExample: 'Exemplo de leitura: "Procure os documentos emitidos para a matrícula 20240015."',
    governanceHint: 'Normalmente deve ficar restrita à secretaria.',
    triggersKey: 'consultDocumentsTriggers',
    usagePlaceholder: 'Ex: use quando a equipe precisar localizar declaração, contrato ou outro documento emitido.',
  },
  {
    key: 'enrollStudent',
    emoji: '✍️',
    label: 'Iniciar pré-matrícula',
    audience: 'Atendimento',
    description: 'Inicia o fluxo de interesse ou pré-matrícula para um novo aluno.',
    reads: 'Lê os dados informados pelo cliente para encaminhar a intenção de matrícula.',
    exampleUse: 'Se você quiser iniciar o atendimento de matrícula de um novo aluno, use esta função.',
    questionExample: 'Exemplo de leitura: "Quero matricular minha filha no curso de inglês."',
    governanceHint: 'Você pode deixar essa ação com o atendimento ou restringir a contatos específicos.',
    triggersKey: 'enrollStudentTriggers',
    usagePlaceholder: 'Ex: use quando a pessoa disser que quer reservar vaga, iniciar matrícula ou demonstrar interesse em entrar na escola.',
  },
]

const apiPreviewByTool = {
  consultCourses: {
    fields: ['Nome do curso', 'Abreviação', 'Objetivo', 'Modalidade'],
    response: ['Curso: Inglês', 'Modalidade: Presencial', 'Objetivo: Conversação e fluência'],
    aiResponse: 'Hoje temos cursos como Inglês. Se quiser, eu também posso te mostrar os níveis ou as turmas disponíveis.',
  },
  consultStages: {
    fields: ['Nome do estágio', 'Abreviação', 'Objetivo', 'Modalidade'],
    response: ['Curso: Inglês', 'Níveis: Básico, Intermediário e Avançado'],
    aiResponse: 'Esse curso tem níveis como Básico, Intermediário e Avançado. Se quiser, eu também posso buscar as turmas disponíveis em cada um.',
  },
  consultClasses: {
    fields: ['Nome da turma', 'Data inicial', 'Data final', 'Ocupação', 'Período letivo'],
    response: ['Turma: Sábados adultos 10-12', 'Período: 10/03/2026 a 30/06/2026', 'Ocupação: 0'],
    aiResponse: 'Encontrei a turma Sábados adultos 10-12, com período de 10/03/2026 a 30/06/2026. Se quiser, eu também posso te mostrar horários e valores.',
  },
  consultClassSchedule: {
    fields: ['Data da aula', 'Hora', 'Professor', 'Sala', 'Status'],
    response: ['Aula: 05/07/2025 às 10:00', 'Professor: Floriano Peixoto', 'Sala: Sala 01'],
    aiResponse: 'A turma tem aulas aos sábados às 10:00 com o professor Floriano Peixoto, na Sala 01. Se quiser, eu posso listar as próximas datas também.',
  },
  consultPricing: {
    fields: ['Nome da taxa', 'Tipo', 'Valor', 'Desconto', 'Parcelas'],
    response: ['Taxa de matrícula: R$ 200,00', 'Mensalidade: R$ 1.000,00', 'Parcelamento: 5x'],
    aiResponse: 'A taxa de matrícula está em R$ 200,00 e a turma tem opção parcelada em até 5x. Se quiser, eu posso te detalhar todas as formas de pagamento.',
  },
  checkFinancial: {
    fields: ['Descrição', 'Status', 'Valor', 'Vencimento', 'Link do boleto'],
    response: ['Parcela 03: vencida', 'Valor: R$ 350,00', 'Boleto: link disponível'],
    aiResponse: 'Encontrei uma parcela vencida no valor de R$ 350,00. Se você quiser, eu posso te passar o link do boleto ou verificar outras pendências.',
  },
  listClassStudents: {
    fields: ['Nome do aluno', 'Número da matrícula', 'Turma', 'Curso', 'Movimentação'],
    response: ['Aluno: João Silva', 'Matrícula: 20240015', 'Turma: Inglês 3A'],
    aiResponse: 'Na turma Inglês 3A encontrei alunos como João Silva, matrícula 20240015. Se quiser, eu posso continuar a lista completa.',
  },
  searchStudent: {
    fields: ['Nome', 'CPF', 'RG', 'E-mail', 'Matrícula'],
    response: ['Aluno: João Silva', 'CPF: 000.***.***-00', 'E-mail: joao@email.com'],
    aiResponse: 'Localizei o aluno João Silva. Se quiser, eu posso abrir a ficha completa para ver responsáveis, contatos e matrículas.',
  },
  getStudentDetails: {
    fields: ['Nome', 'Responsáveis', 'Telefones', 'Endereços', 'Matrículas'],
    response: ['Aluno: João Silva', 'Responsável: Maria Silva', 'Telefone: (11) 99999-0000'],
    aiResponse: 'A ficha mostra o aluno João Silva, com responsável Maria Silva e telefone cadastrado. Se quiser, eu também posso verificar documentos ou situação financeira.',
  },
  consultCourseProgram: {
    fields: ['Título do tópico', 'Conteúdo', 'Livro', 'Unidade', 'Objetivos'],
    response: ['Unidade 1: Apresentações', 'Livro: Student Book 1', 'Objetivo: Conversação inicial'],
    aiResponse: 'Esse curso trabalha temas como apresentações e conversação inicial, com apoio do Student Book 1. Se quiser, eu posso detalhar mais tópicos do programa.',
  },
  consultTeachers: {
    fields: ['Nome', 'CPF', 'RG', 'E-mails'],
    response: ['Professor: Ana Souza', 'E-mail: ana@escola.com.br'],
    aiResponse: 'Encontrei professores cadastrados como Ana Souza. Se quiser, eu posso seguir com a lista ou procurar um nome específico.',
  },
  consultDocuments: {
    fields: ['Nome do documento', 'Aluno', 'Turma', 'Matrícula', 'Data de emissão'],
    response: ['Documento: Declaração de matrícula', 'Aluno: João Silva', 'Emissão: 15/03/2025'],
    aiResponse: 'Localizei um documento emitido, como a Declaração de matrícula do aluno João Silva, com emissão em 15/03/2025.',
  },
  enrollStudent: {
    fields: ['Nome informado', 'Curso desejado', 'Contato', 'Observações do interesse'],
    response: ['Interessado: Maria Fernanda', 'Curso: Inglês', 'Canal: WhatsApp'],
    aiResponse: 'Perfeito, já posso registrar o interesse de Maria Fernanda no curso de Inglês e seguir com o atendimento de matrícula.',
  },
}

let nextAllowedId = 300
let nextBlockedId = 400

function getGovernanceMode(toolKey) {
  return props.config.tools[toolKey + 'GovernanceMode'] || 'allow'
}

function setGovernanceMode(toolKey, mode) {
  props.config.tools[toolKey + 'GovernanceMode'] = mode
}

function getGovernanceContacts(toolKey) {
  const key = getGovernanceMode(toolKey) === 'allow'
    ? toolKey + 'AllowedContacts'
    : toolKey + 'BlockedContacts'
  return props.config.tools[key] || []
}

function addGovernanceContact(toolKey) {
  const mode = getGovernanceMode(toolKey)
  const key = mode === 'allow'
    ? toolKey + 'AllowedContacts'
    : toolKey + 'BlockedContacts'

  if (!props.config.tools[key]) props.config.tools[key] = []

  props.config.tools[key].push({
    id: mode === 'allow' ? nextAllowedId++ : nextBlockedId++,
    contact: '',
  })
}

function removeGovernanceContact(toolKey, id) {
  const mode = getGovernanceMode(toolKey)
  const key = mode === 'allow'
    ? toolKey + 'AllowedContacts'
    : toolKey + 'BlockedContacts'

  const arr = props.config.tools[key]
  if (!arr) return
  props.config.tools[key] = arr.filter((item) => item.id !== id)
}

function getUsageValue(tool) {
  const instructions = (props.config.tools[tool.key + 'Instructions'] || '').trim()
  if (instructions) return instructions

  const triggers = props.config.tools[tool.triggersKey] || []
  return triggers
    .map((item) => item.condition || '')
    .filter(Boolean)
    .join('\n')
}

function setUsageValue(tool, value) {
  props.config.tools[tool.key + 'Instructions'] = value
}

function getGovernanceSummary(toolKey) {
  const mode = getGovernanceMode(toolKey)
  const allowedContacts = (props.config.tools[toolKey + 'AllowedContacts'] || [])
    .filter((item) => item.contact && item.contact.trim())
  const blockedContacts = (props.config.tools[toolKey + 'BlockedContacts'] || [])
    .filter((item) => item.contact && item.contact.trim())

  if (mode === 'allow') {
    if (!allowedContacts.length) return 'Todos podem usar'
    return `Apenas ${allowedContacts.length} contato(s)`
  }

  if (!blockedContacts.length) return 'Todos podem usar'
  return `Todos, exceto ${blockedContacts.length} contato(s)`
}

function getModeTitle(toolKey) {
  return getGovernanceMode(toolKey) === 'allow'
    ? 'Quem pode usar esta ação'
    : 'Quem não pode usar esta ação'
}

function getModeHelp(toolKey) {
  return getGovernanceMode(toolKey) === 'allow'
    ? 'Escolha esta opção quando só algumas pessoas da equipe podem usar essa ação.'
    : 'Escolha esta opção quando a ação pode ser usada por quase todos, com algumas exceções.'
}

function getApiPreview(toolKey) {
  return apiPreviewByTool[toolKey] || { fields: [], response: [] }
}
</script>

<template>
  <div class="tools">
    <p class="tools__intro">
      Conecte a I.A. ao KAITS com ações fáceis de entender. Ative o que fizer sentido, veja um exemplo prático e explique em quais situações a I.A. deve usar cada ação.
    </p>

    <div class="tools-steps">
      <div class="tools-step">
        <span class="tools-step__num">1</span>
        <div>
          <strong>Ative a ação</strong>
          <p>Marque somente o que a I.A. realmente deve consultar.</p>
        </div>
      </div>
      <div class="tools-step">
        <span class="tools-step__num">2</span>
        <div>
          <strong>Leia o exemplo</strong>
          <p>Veja o caso prático do tipo “se você quiser...”.</p>
        </div>
      </div>
      <div class="tools-step">
        <span class="tools-step__num">3</span>
        <div>
          <strong>Explique quando usar</strong>
          <p>Explique em texto simples em quais situações a I.A. deve usar essa ação.</p>
        </div>
      </div>
      <div class="tools-step">
        <span class="tools-step__num">4</span>
        <div>
          <strong>Restrinja se for interno</strong>
          <p>Se a ação for interna, informe abaixo quem pode usar.</p>
        </div>
      </div>
    </div>

    <div class="tools-list">
      <div
        v-for="tool in toolDefs"
        :key="tool.key"
        class="tool-item"
        :class="{ 'tool-item--active': config.tools[tool.key] }"
      >
        <label class="check-item tool-item__header">
          <input type="checkbox" v-model="config.tools[tool.key]" />
          <span class="tool-item__label">{{ tool.emoji }} {{ tool.label }}</span>
          <span class="tool-item__audience">{{ tool.audience }}</span>
        </label>

        <Transition name="slide">
          <div v-if="config.tools[tool.key]" class="tool-item__body">
            <p class="tool-item__desc">{{ tool.description }}</p>

            <div class="tool-summary">
              <span class="summary-chip">{{ getGovernanceSummary(tool.key) }}</span>
              <span class="summary-chip summary-chip--soft">Consulta dados do sistema</span>
              <span v-if="getUsageValue(tool)" class="summary-chip summary-chip--soft">Uso orientado</span>
              <span v-if="config.tools[tool.key + 'ResponseInstructions']" class="summary-chip summary-chip--soft">Resposta personalizada</span>
            </div>

            <div class="tool-examples">
              <div class="example-card">
                <p class="example-title">Se você quiser...</p>
                <p class="example-text">{{ tool.exampleUse }}</p>
              </div>
              <div class="example-card example-card--blue">
                <p class="example-title">O que ela vai ler</p>
                <p class="example-text">{{ tool.reads }}</p>
              </div>
              <div class="example-card example-card--green">
                <p class="example-title">Exemplo de pergunta</p>
                <p class="example-text">{{ tool.questionExample }}</p>
              </div>
            </div>

            <div class="api-preview">
              <div class="api-preview__head">
                <div>
                  <p class="section-title">Prévia visual do que volta da API</p>
                  <p class="field-help">
                    Estes são os principais dados que essa ação costuma recuperar no KAITS.
                  </p>
                </div>
                <span class="section-badge">Dados lidos</span>
              </div>

              <div class="api-preview__fields">
                <span
                  v-for="field in getApiPreview(tool.key).fields"
                  :key="field"
                  class="api-preview__chip"
                >
                  {{ field }}
                </span>
              </div>

              <div class="api-preview__sample">
                <p class="api-preview__sample-label">Mini conversa de exemplo</p>
                <div class="api-preview__chat">
                  <div class="api-preview__bubble api-preview__bubble--user">
                    <span class="api-preview__bubble-role">Pessoa</span>
                    <p>{{ tool.questionExample.replace('Exemplo de leitura: ', '') }}</p>
                  </div>
                  <div class="api-preview__bubble api-preview__bubble--ai">
                    <span class="api-preview__bubble-role">I.A.</span>
                    <p>{{ getApiPreview(tool.key).aiResponse }}</p>
                  </div>
                </div>
                <div class="api-preview__card">
                  <p class="api-preview__sample-label">Exemplo visual do dado lido</p>
                  <div class="api-preview__sample-box">
                    <div
                      v-for="line in getApiPreview(tool.key).response"
                      :key="line"
                      class="api-preview__line"
                    >
                      {{ line }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <p class="tool-governance-tip">
              {{ tool.governanceHint }}
            </p>

            <div class="field-group">
              <label class="label">Explique com suas palavras quando usar esta ação</label>
              <p class="field-help">
                Pense como se estivesse orientando um funcionário novo da equipe.
              </p>
              <textarea
                :value="getUsageValue(tool)"
                :placeholder="tool.usagePlaceholder"
                @input="setUsageValue(tool, $event.target.value)"
              ></textarea>
            </div>

            <div class="field-group">
              <label class="label">Como a I.A. deve responder depois da consulta? (opcional)</label>
              <p class="field-help">
                Use este campo para orientar o formato da resposta depois que a ação ler os dados no sistema.
              </p>
              <textarea
                :value="config.tools[tool.key + 'ResponseInstructions'] || ''"
                placeholder="Ex: responda em lista curta, cite no máximo 3 resultados, destaque valores em negrito e termine perguntando se a pessoa quer mais detalhes."
                @input="config.tools[tool.key + 'ResponseInstructions'] = $event.target.value"
              ></textarea>
            </div>

            <div class="governance-section">
              <div class="section-head">
                <div>
                  <p class="section-title">Controle de acesso</p>
                  <p class="field-help">
                    Use essa regra para definir quem pode ou não pode usar essa ação durante o atendimento.
                  </p>
                </div>
                <span class="section-badge">{{ getGovernanceSummary(tool.key) }}</span>
              </div>

              <div class="mode-switch">
                <button
                  type="button"
                  class="mode-pill"
                  :class="{ 'mode-pill--active': getGovernanceMode(tool.key) === 'allow' }"
                  @click="setGovernanceMode(tool.key, 'allow')"
                >
                  Liberar só para estes contatos
                </button>
                <button
                  type="button"
                  class="mode-pill"
                  :class="{ 'mode-pill--active': getGovernanceMode(tool.key) === 'except' }"
                  @click="setGovernanceMode(tool.key, 'except')"
                >
                  Liberar para todos, exceto estes
                </button>
              </div>

              <div class="governance-block">
                <label class="label">{{ getModeTitle(tool.key) }}</label>
                <p class="field-help">{{ getModeHelp(tool.key) }}</p>

                <div
                  v-for="(item, idx) in getGovernanceContacts(tool.key)"
                  :key="item.id"
                  class="governance-row"
                >
                  <span class="badge-count">{{ idx + 1 }}</span>
                  <input
                    v-model="item.contact"
                    type="text"
                    class="input-governance"
                    placeholder="Ex: e-mail, CPF ou telefone do contato"
                  >
                  <button type="button" class="btn-icon" @click="removeGovernanceContact(tool.key, item.id)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                <div v-if="!getGovernanceContacts(tool.key).length" class="empty-note">
                  Nenhum contato informado ainda.
                </div>

                <button type="button" class="btn-add" @click="addGovernanceContact(tool.key)">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Adicionar contato
                </button>
              </div>

              <div class="field-group">
                <label class="label">Cuidados extras ao usar esta ação (opcional)</label>
                <p class="field-help">
                  Exemplo: pedir confirmação de CPF antes de mostrar dados sensíveis ou responder só com o necessário.
                </p>
                <textarea
                  :value="config.tools[tool.key + 'GovernanceInstructions'] || ''"
                  placeholder="Ex: antes de responder, confirme CPF e nome completo do responsável."
                  @input="config.tools[tool.key + 'GovernanceInstructions'] = $event.target.value"
                ></textarea>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tools {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.tools__intro {
  margin: 0;
  font-size: 0.86rem;
  color: var(--c-text-muted);
  line-height: 1.55;
}

.tools-steps {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.6rem;
}

.tools-step {
  display: flex;
  gap: 0.65rem;
  align-items: flex-start;
  padding: 0.75rem 0.8rem;
  border: 1px solid #dbeafe;
  border-radius: 12px;
  background: #f8fbff;
}

.tools-step__num {
  width: 1.45rem;
  height: 1.45rem;
  border-radius: 999px;
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 0.78rem;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tools-step strong {
  display: block;
  font-size: 0.81rem;
  color: #1e3a8a;
}

.tools-step p {
  margin: 0.15rem 0 0;
  font-size: 0.75rem;
  line-height: 1.4;
  color: #475569;
}

.tools-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.tool-item {
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.tool-item--active {
  border-color: #8fb7ff;
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.08);
}

.tool-item__header {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.95rem 1rem;
  background: #fff;
}

.tool-item__label {
  flex: 1;
  font-size: 0.95rem;
  font-weight: 600;
  color: #1f2937;
}

.tool-item__audience {
  flex-shrink: 0;
  font-size: 0.72rem;
  font-weight: 700;
  color: #4338ca;
  background: #eef2ff;
  border-radius: 999px;
  padding: 0.28rem 0.55rem;
}

.tool-item__body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background: #f8fbff;
  border-top: 1px solid #dbeafe;
}

.tool-item__desc {
  margin: 0;
  font-size: 0.86rem;
  color: #334155;
  line-height: 1.5;
}

.tool-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.summary-chip {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  border: 1px solid #dbeafe;
  background: #eff6ff;
  font-size: 0.76rem;
  font-weight: 600;
  color: #1d4ed8;
}

.summary-chip--soft {
  color: #475569;
  background: #fff;
  border-color: #cbd5e1;
}

.tool-examples {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.65rem;
}

.example-card {
  padding: 0.8rem 0.85rem;
  border-radius: 12px;
  border: 1px solid #dbeafe;
  background: white;
}

.example-card--blue {
  background: #f8fbff;
}

.example-card--green {
  background: #f0fdf4;
  border-color: #bbf7d0;
}

.example-title {
  margin: 0 0 0.3rem;
  font-size: 0.76rem;
  font-weight: 800;
  color: #1e3a8a;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.example-text {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.5;
  color: #334155;
}

.tool-governance-tip {
  margin: 0;
  padding: 0.7rem 0.8rem;
  border-radius: 10px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  font-size: 0.8rem;
  line-height: 1.45;
  color: #9a3412;
}

.api-preview {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.9rem;
  border: 1px solid #dbeafe;
  border-radius: 12px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
}

.api-preview__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.api-preview__fields {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.api-preview__chip {
  display: inline-flex;
  align-items: center;
  padding: 0.36rem 0.6rem;
  border-radius: 999px;
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
  font-size: 0.76rem;
  font-weight: 700;
}

.api-preview__sample {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.api-preview__card {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.api-preview__card--ai .api-preview__sample-label {
  color: #166534;
}

.api-preview__sample-label {
  margin: 0;
  font-size: 0.76rem;
  font-weight: 700;
  color: #475569;
}

.api-preview__chat {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.api-preview__bubble {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-width: 92%;
  padding: 0.8rem 0.9rem;
  border-radius: 14px;
  box-shadow: var(--shadow-sm);
}

.api-preview__bubble p {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.5;
}

.api-preview__bubble-role {
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.api-preview__bubble--user {
  align-self: flex-start;
  background: #ffffff;
  border: 1px solid #dbeafe;
  color: #334155;
}

.api-preview__bubble--user .api-preview__bubble-role {
  color: #1d4ed8;
}

.api-preview__bubble--ai {
  align-self: flex-end;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
}

.api-preview__bubble--ai .api-preview__bubble-role {
  color: #15803d;
}

.api-preview__sample-box {
  display: flex;
  flex-direction: column;
  gap: 0.38rem;
  padding: 0.8rem;
  border-radius: 10px;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 0.8rem;
  line-height: 1.45;
}

.api-preview__line {
  white-space: pre-wrap;
  word-break: break-word;
}

.field-group,
.governance-section {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.label,
.section-title {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 700;
  color: #334155;
}

.field-help {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.45;
  color: #64748b;
}

textarea,
.input-governance {
  width: 100%;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: #fff;
  padding: 0.8rem 0.9rem;
  font: inherit;
  color: #1f2937;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

textarea {
  min-height: 110px;
  resize: vertical;
}

textarea:focus,
.input-governance:focus {
  outline: none;
  border-color: #60a5fa;
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.15);
}

.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.section-badge {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0.3rem 0.65rem;
  border-radius: 999px;
  background: #eef2ff;
  color: #4338ca;
  font-size: 0.74rem;
  font-weight: 700;
}

.mode-switch {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.mode-pill {
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #475569;
  border-radius: 999px;
  padding: 0.55rem 0.8rem;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.mode-pill:hover {
  border-color: #93c5fd;
  color: #1d4ed8;
}

.mode-pill--active {
  border-color: #60a5fa;
  background: #dbeafe;
  color: #1d4ed8;
}

.governance-block {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.85rem;
  border: 1px solid #dbeafe;
  border-radius: 12px;
  background: #fff;
}

.governance-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.badge-count {
  width: 1.45rem;
  height: 1.45rem;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 0.74rem;
  font-weight: 700;
}

.btn-icon {
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  padding: 0.35rem;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn-icon:hover {
  background: #fef2f2;
  color: #dc2626;
}

.empty-note {
  padding: 0.65rem 0.75rem;
  border: 1px dashed #cbd5e1;
  border-radius: 10px;
  background: #f8fafc;
  font-size: 0.78rem;
  color: #64748b;
}

.btn-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  width: 100%;
  min-height: 42px;
  border: 1px dashed #93c5fd;
  border-radius: 10px;
  background: #f8fbff;
  color: #2563eb;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-add:hover {
  background: #eff6ff;
}

@media (max-width: 1100px) {
  .tools-steps,
  .tool-examples {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 900px) {
  .section-head {
    flex-direction: column;
  }
  .tool-item__header {
    flex-wrap: wrap;
    align-items: flex-start;
  }
  .tool-item__audience {
    margin-left: 1.9rem;
  }
}

@media (max-width: 700px) {
  .tools-steps,
  .tool-examples {
    grid-template-columns: 1fr;
  }
  .tool-item__body {
    padding: 0.85rem;
  }
  .tool-item__label {
    font-size: 0.9rem;
  }
  .tool-item__audience {
    margin-left: 0;
  }
  .governance-row {
    align-items: stretch;
  }
  .governance-row .input-governance {
    min-width: 0;
  }
}
</style>
