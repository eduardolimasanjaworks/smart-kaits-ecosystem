"""
ai/prompt_builder.py — Construção de Sistema

Monta as diretrizes do Agente Inteligente, inserindo a Personalidade,
o Roteiro e a base recuperada do VectorDB dependendo de cada requisição.
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
1. **Fidelidade ao Contexto**: Priorize as informações de "BASE DE CONHECIMENTO" abaixo. Se o dado existir, responda com confiança.
2. **Postura de Atendimento**: Não use frases robóticas como "Analisei os documentos". Responda naturalmente: "Sim, nossas matrículas estão abertas!" ou "O horário da secretaria é das 8h às 18h".
3. **Tratamento de Incerteza**: Se a informação NÃO estiver na base, não invente dados sensíveis (datas, valores, nomes). Em vez disso, diga algo como: "Para te dar a informação exata sobre esse ponto, eu recomendaria falar diretamente com nossa equipe. Posso te encaminhar?".
4. **Respostas Concisas**: Evite textos muito longos. Vá direto ao ponto, mas sem ser seco.
5. **Idioma**: Responda no mesmo idioma do usuário (padrão: Português-BR).
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

    prompt += "\n## BASE DE CONHECIMENTO (RAG)\n"
    if facts:
        prompt += "As informações abaixo extraídas dos documentos da escola são a sua única fonte de verdade:\n"
        for i, fact in enumerate(facts):
            ref = fact.get("source_ref", f"fato_{i}")
            texto = fact.get("text", "")
            prompt += f"\n[REF: {ref}]\n{texto}\n"
    else:
        # Fallback: Se não houver RAG mas houver documentos carregados, tenta injetar um resumo ou aviso
        docs = agent_config.get("docs", [])
        if docs:
            prompt += f"(Aviso: Existem {len(docs)} documentos indexados, mas nenhum chunk foi recuperado para esta dúvida específica. Tente responder de forma genérica ou peça mais detalhes).\n"
        else:
            prompt += "(Nenhum documento relevante encontrado para esta dúvida no VectorDB. Use seu bom senso apenas para saudações; para dados da escola, siga para o fallback).\n"

    fallback = agent_config.get("fallbackContact", "")
    if fallback:
        prompt += f"\n## PROTOCOLO DE HANDOVER (Transbordo)\n"
        prompt += f"- Escalar para humano ('{fallback}') se:\n"
        prompt += "  a) O usuário pedir explicitamente ('falar com atendente', 'quero falar com alguém', etc).\n"
        prompt += "  b) Você não encontrar a resposta na Base de Conhecimento.\n"
        prompt += "  c) A dúvida for de natureza crítica ou emocional.\n"
        prompt += "Nesses casos, acione a ferramenta 'trigger_handover'."

    return prompt
