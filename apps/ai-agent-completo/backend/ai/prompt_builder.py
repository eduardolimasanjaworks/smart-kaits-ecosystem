"""
ai/prompt_builder.py — Construção de Sistema

Monta as diretrizes do Agente Inteligente, inserindo a Personalidade,
o Roteiro, instruções de tools e a base recuperada do VectorDB dependendo de cada requisição.
"""

def build_assistant_system_prompt(agent_config: dict, facts: list[dict] = None, user_identifier: str = None) -> str:
    """
    Recebe a config do banco, o contexto recuperado do Qdrant e o identificador do usuário.
    Retorna a mega string do System Prompt final do gpt-4o-mini.
    """
    nome = agent_config.get("assistantName") or "Assistente Virtual"
    personalidade = agent_config.get("personality") or "seja prestativo, cordial e neutro"
    
    prompt = f"""Você é {nome}, o assistente virtual oficial e acolhedor desta instituição de ensino.
Sua missão é fornecer suporte humanizado, preciso e eficiente, garantindo que pais, alunos e interessados se sintam bem atendidos.

## SUA PERSONALIDADE (Como agir):
{personalidade}
- Use um tom de voz que transmita segurança e empatia.
- Se a personalidade definida for 'Formal', seja polido e respeitoso.
- Se for 'Amigável', use emojis moderadamente e uma linguagem leve.
- Se for 'Especialista', foque em clareza técnica e autoridade.

## DIRETRIZES DE PENSAMENTO E RESPOSTA:
1. **Fidelidade ao Contexto**: Priorize as informações de "BASE DE CONHECIMENTO" abaixo e das tools (APIs do KAITS). Se o dado existir, responda com confiança.
2. **Postura de Atendimento**: Não use frases robóticas como "Analisei os documentos". Responda naturalmente: "Sim, nossas matrículas estão abertas!" ou "O horário da secretaria é das 8h às 18h".
3. **Tratamento de Incerteza**: Se a informação NÃO estiver na base, não invente dados sensíveis (datas, valores, nomes). Em vez disso, diga algo como: "Para te dar a informação exata sobre esse ponto, eu recomendaria falar diretamente com nossa equipe. Posso te encaminhar?".
4. **Respostas Concisas**: Evite textos muito longos. Vá direto ao ponto, mas sem ser seco.
5. **Idioma**: Responda no mesmo idioma do usuário (padrão: Português-BR).
6. **Uso de Tools**: Sempre que possível, use as tools disponíveis para buscar informações em tempo real antes de consultar a base de conhecimento ou admitir que não sabe!
7. **Governança de Acesso**: SEMPRE respeite as regras de acesso definidas para cada ferramenta! Primeiro verifique se o usuário tem permissão para usar a ferramenta antes de executá-la.
"""
    roteiro = agent_config.get("scriptRules") or []
    
    if roteiro:
        for i, rule in enumerate(roteiro):
            trigger = rule.get("trigger", "")
            resp = rule.get("response", "")
            if trigger and resp:
                prompt += f"- Gatilho: '{trigger}' -> Ação: Responda usando a estratégia: '{resp}'\n"
    else:
        prompt += "- Nenhuma regra de roteiro específica ativa.\n"

    # Adiciona seção de tools
    tools_config = agent_config.get("tools", {})
    tools_definitions = [
        {
            "key": "consultCourses",
            "name": "Consultar cursos",
            "description": "Busca cursos disponíveis da escola.",
            "instructions_key": "consultCoursesInstructions",
            "response_key": "consultCoursesResponseInstructions",
            "triggers_key": "consultCoursesTriggers",
            "governance_key": "consultCoursesGovernanceInstructions",
            "allowed_key": "consultCoursesAllowedContacts",
            "blocked_key": "consultCoursesBlockedContacts"
        },
        {
            "key": "consultStages",
            "name": "Consultar estágios ou níveis do curso",
            "description": "Busca os estágios, níveis ou módulos de um curso.",
            "instructions_key": "consultStagesInstructions",
            "response_key": "consultStagesResponseInstructions",
            "triggers_key": "consultStagesTriggers",
            "governance_key": "consultStagesGovernanceInstructions",
            "allowed_key": "consultStagesAllowedContacts",
            "blocked_key": "consultStagesBlockedContacts"
        },
        {
            "key": "consultClasses",
            "name": "Consultar turmas disponíveis",
            "description": "Busca turmas disponíveis de um curso ou estágio.",
            "instructions_key": "consultClassesInstructions",
            "response_key": "consultClassesResponseInstructions",
            "triggers_key": "consultClassesTriggers",
            "governance_key": "consultClassesGovernanceInstructions",
            "allowed_key": "consultClassesAllowedContacts",
            "blocked_key": "consultClassesBlockedContacts"
        },
        {
            "key": "consultClassSchedule",
            "name": "Consultar horários e aulas de uma turma",
            "description": "Busca agenda, horários e aulas cadastradas de uma turma.",
            "instructions_key": "consultClassScheduleInstructions",
            "response_key": "consultClassScheduleResponseInstructions",
            "triggers_key": "consultClassScheduleTriggers",
            "governance_key": "consultClassScheduleGovernanceInstructions",
            "allowed_key": "consultClassScheduleAllowedContacts",
            "blocked_key": "consultClassScheduleBlockedContacts"
        },
        {
            "key": "consultPricing",
            "name": "Consultar valores de uma turma",
            "description": "Consulta matrícula, mensalidade, material e valores da turma.",
            "instructions_key": "consultPricingInstructions",
            "response_key": "consultPricingResponseInstructions",
            "triggers_key": "consultPricingTriggers",
            "governance_key": "consultPricingGovernanceInstructions",
            "allowed_key": "consultPricingAllowedContacts",
            "blocked_key": "consultPricingBlockedContacts"
        },
        {
            "key": "checkFinancial",
            "name": "Consultar ficha financeira do aluno",
            "description": "Consulta pagamentos, pendências, boletos e ficha financeira do aluno.",
            "instructions_key": "checkFinancialInstructions",
            "response_key": "checkFinancialResponseInstructions",
            "triggers_key": "checkFinancialTriggers",
            "governance_key": "checkFinancialGovernanceInstructions",
            "allowed_key": "checkFinancialAllowedContacts",
            "blocked_key": "checkFinancialBlockedContacts"
        },
        {
            "key": "listClassStudents",
            "name": "Consultar alunos de uma turma",
            "description": "Lista os alunos e matrículas vinculados a uma turma.",
            "instructions_key": "listClassStudentsInstructions",
            "response_key": "listClassStudentsResponseInstructions",
            "triggers_key": "listClassStudentsTriggers",
            "governance_key": "listClassStudentsGovernanceInstructions",
            "allowed_key": "listClassStudentsAllowedContacts",
            "blocked_key": "listClassStudentsBlockedContacts"
        },
        {
            "key": "searchStudent",
            "name": "Buscar aluno por nome, CPF ou matrícula",
            "description": "Busca dados básicos de aluno por nome, CPF, e-mail, RG ou matrícula.",
            "instructions_key": "searchStudentInstructions",
            "response_key": "searchStudentResponseInstructions",
            "triggers_key": "searchStudentTriggers",
            "governance_key": "searchStudentGovernanceInstructions",
            "allowed_key": "searchStudentAllowedContacts",
            "blocked_key": "searchStudentBlockedContacts"
        },
        {
            "key": "getStudentDetails",
            "name": "Ver ficha completa de um aluno",
            "description": "Busca dados completos do aluno, responsáveis, telefones, endereços e matrículas.",
            "instructions_key": "getStudentDetailsInstructions",
            "response_key": "getStudentDetailsResponseInstructions",
            "triggers_key": "getStudentDetailsTriggers",
            "governance_key": "getStudentDetailsGovernanceInstructions",
            "allowed_key": "getStudentDetailsAllowedContacts",
            "blocked_key": "getStudentDetailsBlockedContacts"
        },
        {
            "key": "consultCourseProgram",
            "name": "Consultar programa do curso",
            "description": "Busca o conteúdo programático do curso ou estágio.",
            "instructions_key": "consultCourseProgramInstructions",
            "response_key": "consultCourseProgramResponseInstructions",
            "triggers_key": "consultCourseProgramTriggers",
            "governance_key": "consultCourseProgramGovernanceInstructions",
            "allowed_key": "consultCourseProgramAllowedContacts",
            "blocked_key": "consultCourseProgramBlockedContacts"
        },
        {
            "key": "consultTeachers",
            "name": "Consultar professores",
            "description": "Busca professores habilitados da escola.",
            "instructions_key": "consultTeachersInstructions",
            "response_key": "consultTeachersResponseInstructions",
            "triggers_key": "consultTeachersTriggers",
            "governance_key": "consultTeachersGovernanceInstructions",
            "allowed_key": "consultTeachersAllowedContacts",
            "blocked_key": "consultTeachersBlockedContacts"
        },
        {
            "key": "consultDocuments",
            "name": "Consultar documentos emitidos",
            "description": "Busca documentos emitidos para aluno ou matrícula.",
            "instructions_key": "consultDocumentsInstructions",
            "response_key": "consultDocumentsResponseInstructions",
            "triggers_key": "consultDocumentsTriggers",
            "governance_key": "consultDocumentsGovernanceInstructions",
            "allowed_key": "consultDocumentsAllowedContacts",
            "blocked_key": "consultDocumentsBlockedContacts"
        },
        {
            "key": "enrollStudent",
            "name": "Iniciar pré-matrícula",
            "description": "Inicia processo de matrícula para novo aluno.",
            "instructions_key": "enrollStudentInstructions",
            "response_key": "enrollStudentResponseInstructions",
            "triggers_key": "enrollStudentTriggers",
            "governance_key": "enrollStudentGovernanceInstructions",
            "allowed_key": "enrollStudentAllowedContacts",
            "blocked_key": "enrollStudentBlockedContacts"
        }
    ]

    has_active_tools = False
    for tool in tools_definitions:
        if tools_config.get(tool["key"]):
            has_active_tools = True
            break

    if has_active_tools:
        prompt += "\n## FERRAMENTAS DISPONÍVEIS (APIs do KAITS)\n"
        prompt += "Use as ferramentas abaixo sempre que precisar de informações em tempo real!\n"
        for tool in tools_definitions:
            if tools_config.get(tool["key"]):
                prompt += f"\n### {tool['name']}\n"
                prompt += f"- O que faz: {tool['description']}\n"
                
                # Adiciona regras de governança
                allowed_contacts = tools_config.get(tool["allowed_key"], [])
                blocked_contacts = tools_config.get(tool["blocked_key"], [])
                governance_mode = tools_config.get(tool["key"] + "GovernanceMode", "allow")

                if governance_mode == "allow":
                    allowed_contacts_str = ", ".join([c.get("contact", "") for c in allowed_contacts if c.get("contact")])
                    if allowed_contacts_str:
                        prompt += f"- Governança: Apenas os seguintes contatos podem usar esta ferramenta: {allowed_contacts_str}\n"
                    else:
                        prompt += f"- Governança: Todos os contatos podem usar esta ferramenta\n"
                else:
                    blocked_contacts_str = ", ".join([c.get("contact", "") for c in blocked_contacts if c.get("contact")])
                    if blocked_contacts_str:
                        prompt += f"- Governança: Todos os contatos podem usar esta ferramenta, exceto: {blocked_contacts_str}\n"
                    else:
                        prompt += f"- Governança: Todos os contatos podem usar esta ferramenta\n"
                
                governance_instructions = tools_config.get(tool["governance_key"], "")
                if governance_instructions:
                    prompt += f"- Instruções de governança: {governance_instructions}\n"

                instructions = (tools_config.get(tool["instructions_key"], "") or "").strip()
                if instructions:
                    prompt += f"- Quando usar / orientações: {instructions}\n"
                else:
                    triggers = tools_config.get(tool["triggers_key"], [])
                    if triggers:
                        prompt += "- Quando usar:\n"
                        for t in triggers:
                            if t.get("condition"):
                                prompt += f"  - {t['condition']}\n"

                response_instructions = (tools_config.get(tool["response_key"], "") or "").strip()
                if response_instructions:
                    prompt += f"- Como responder depois da consulta: {response_instructions}\n"

    prompt += "\n## BASE DE CONHECIMENTO (RAG)\n"
    if facts:
        prompt += "As informações abaixo extraídas dos documentos da escola são a sua fonte adicional de verdade (use as tools primeiro!):\n"
        for i, fact in enumerate(facts):
            ref = fact.get("source_ref", f"fato_{i}")
            texto = fact.get("text", "")
            prompt += f"\n[REF: {ref}]\n{texto}\n"
    else:
        docs = agent_config.get("docs", [])
        if docs:
            prompt += f"(Aviso: Existem {len(docs)} documentos indexados, mas nenhum chunk foi recuperado para esta dúvida específica. Use as tools se possível, ou peça mais detalhes).\n"
        else:
            prompt += "(Nenhum documento relevante encontrado para esta dúvida no VectorDB. Use as tools se possível; para dados da escola, siga para o fallback).\n"

    fallback = agent_config.get("fallbackContact", "")
    if fallback:
        prompt += f"\n## PROTOCOLO DE HANDOVER (Transbordo)\n"
        prompt += f"- Escalar para humano ('{fallback}') se:\n"
        prompt += "  a) O usuário pedir explicitamente ('falar com atendente', 'quero falar com alguém', etc).\n"
        prompt += "  b) Você não encontrar a resposta nas tools nem na Base de Conhecimento.\n"
        prompt += "  c) A dúvida for de natureza crítica ou emocional.\n"
        prompt += "Nesses casos, acione a ferramenta 'trigger_handover'."

    return prompt
