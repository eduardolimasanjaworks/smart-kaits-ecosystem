"""
ai/prompt_builder.py — Construção de Sistema

Monta as diretrizes do Agente Inteligente, inserindo a Personalidade,
o Roteiro, instruções de tools e a base recuperada do VectorDB dependendo de cada requisição.
"""

def build_assistant_system_prompt(agent_config: dict, facts: list[dict] = None) -> str:
    """
    Recebe a config do banco e o contexto recuperado do Qdrant.
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
            "key": "consultClasses",
            "name": "Consultar grade, turmas e aulas",
            "description": "Busca horários, turmas disponíveis e aulas por data ou turma.",
            "instructions_key": "consultClassesInstructions",
            "triggers_key": "consultClassesTriggers"
        },
        {
            "key": "checkFinancial",
            "name": "Verificar finanças (pendências, boletos)",
            "description": "Consulta valores de turmas, pendências de alunos ou responsáveis por CPF.",
            "instructions_key": "checkFinancialInstructions",
            "triggers_key": "checkFinancialTriggers"
        },
        {
            "key": "searchStudent",
            "name": "Buscar dados de aluno/responsável",
            "description": "Busca dados de usuário (nome, CPF, e-mail, telefone).",
            "instructions_key": "searchStudentInstructions",
            "triggers_key": "searchStudentTriggers"
        },
        {
            "key": "enrollStudent",
            "name": "Iniciar pré-matrícula",
            "description": "Inicia processo de matrícula para novo aluno.",
            "instructions_key": "enrollStudentInstructions",
            "triggers_key": "enrollStudentTriggers"
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
                instructions = tools_config.get(tool["instructions_key"], "")
                if instructions:
                    prompt += f"- Instruções especiais: {instructions}\n"
                triggers = tools_config.get(tool["triggers_key"], [])
                if triggers:
                    prompt += "- Quando usar:\n"
                    for t in triggers:
                        if t.get("condition"):
                            prompt += f"  - {t['condition']}\n"

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
