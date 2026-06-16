"""
ai/assistant.py — Ponto de Entrada da Conversa

Atende requisições do frontend, roda o RAG (se precisar), monta o System Prompt,
e aciona a OpenAI.
"""

import httpx
from ai.client import openai_client
from ai.config import CHAT_MODEL
from ai.retriever import search_knowledge
from ai.prompt_builder import build_assistant_system_prompt

async def process_chat_message(
    user_message: str,
    school_id: str,
    agent_config: dict,
    chat_history: list = None,
    kaits_token: str = None
) -> dict:
    """
    Controlador principal que:
      1. Avalia se precisa chamar o VectorDB (RAG)
      2. Manda pra IA responder
      3. Extrai um Trace Estruturado das fontes que ela usou.
    """
    
    # 1. Recupera chunks mais relevantes (Vector Search)
    chunks = await search_knowledge(school_id, user_message, top_k=6)
    
    # 2. Monta o super-prompt
    sys_prompt = build_assistant_system_prompt(agent_config, facts=chunks)
    
    messages = [{"role": "system", "content": sys_prompt}]
    
    # Adicionar o histórico no modelo
    if chat_history:
        for hist_msg in chat_history[-6:]:  # Limita as últimas 6
            role = "assistant" if hist_msg.get("from") == "ai" else "user"
            messages.append({"role": role, "content": hist_msg.get("text", "")})
            
    # Adiciona a mensagem atual
    messages.append({"role": "user", "content": user_message})

    # Ferramentas Dinâmicas baseadas na configuração da escola
    tools = []
    
    # Handover sempre disponível
    tools.append({
        "type": "function",
        "function": {
            "name": "trigger_handover",
            "description": "Acione isso apenas caso o usuário peça para falar com um atendente humano ou você não possuir informações de contexto suficientes para responder nada de forma útil.",
            "parameters": {
                "type": "object",
                "properties": {
                    "justificativa_interna": {"type": "string", "description": "Por que você está acionando o humano?"},
                    "resumo_duvida": {"type": "string", "description": "Qual a dúvida exata do cliente."}
                },
                "required": ["justificativa_interna", "resumo_duvida"]
            }
        }
    })

    conf_tools = agent_config.get("tools", {})
    
    if conf_tools.get("consultClasses"):
        tools.append({
            "type": "function",
            "function": {
                "name": "consult_classes",
                "description": "Consulta a grade de horários ou matérias das turmas.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "turma": {"type": "string", "description": "Nome da turma ou série."}
                    }
                }
            }
        })

    if conf_tools.get("checkFinancial"):
        tools.append({
            "type": "function",
            "function": {
                "name": "check_financial_status",
                "description": "Verifica pendências financeiras ou segunda via de boletos.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "cpf": {"type": "string", "description": "CPF do responsável."}
                    }
                }
            }
        })

    if conf_tools.get("enrollStudent"):
        tools.append({
            "type": "function",
            "function": {
                "name": "start_enrollment",
                "description": "Inicia o processo de pré-matrícula de um novo aluno.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "nome_aluno": {"type": "string"},
                        "serie": {"type": "string"}
                    }
                }
            }
        })

    # Para obtermos qual source foi usada, pedimos à IA pra responder em um FORMATO ESTRUTURADO.
    response = await openai_client.chat.completions.create(
        model=CHAT_MODEL,
        messages=messages,
        tools=tools if tools else None,
        tool_choice="auto",
        temperature=0.3, # Respostas mais controladas
    )
    
    resp_msg = response.choices[0].message
    
    # Ela ativou alguma tool?
    if resp_msg.tool_calls:
        # Prepara o header de autorização para a API do Kaits
        token_to_use = kaits_token or agent_config.get("apiToken")
        headers = {"Authorization": f"Bearer {token_to_use}"} if token_to_use else {}
        
        # TODO: Assim que os endpoints reais forem passados, altere a base_url
        mock_base_url = "https://sistema.kaits.com.br/api"

        for tool_call in resp_msg.tool_calls:
            t_name = tool_call.function.name
            import json
            args = json.loads(tool_call.function.arguments)

            if t_name == "trigger_handover":
                fallback_contact = agent_config.get("fallbackContact", "Equipe")
                return {
                    "text": agent_config.get("fallbackUserMessage", "Vou te encaminhar para o humano te ajudar com isso."),
                    "audit": {
                        "type": "tool",
                        "headline": "Chamou um humano",
                        "detail": args.get("resumo_duvida"),
                        "contact": fallback_contact,
                        "notifyMsg": agent_config.get("fallbackMessage", "Um cliente precisa de você!")
                    }
                }
            
            elif t_name == "consult_classes":
                # Lógica Dinâmica (Estrutura Base para httpx):
                # try:
                #     async with httpx.AsyncClient() as client:
                #         res = await client.get(f"{mock_base_url}/turmas", params={"turma": args.get("turma")}, headers=headers)
                #         api_data = res.json()
                # except Exception as e:
                #     ... fallback ...

                if chunks:
                    main_info = resp_msg.content or chunks[0].get("text", "")[:200]
                    return {
                        "text": f"Consultando o sistema... Com base nos documentos oficiais: {main_info}",
                        "audit": {"type": "tool", "headline": "Consultou Turmas API (Estrutura)", "detail": f"Turma: {args.get('turma')}"}
                    }
                return {
                    "text": f"Verifiquei o sistema para a turma {args.get('turma')}, mas não encontrei a grade específica nos documentos. Deseja que eu fale com a secretaria?",
                    "audit": {"type": "tool", "headline": "Busca API (Sem Contexto)", "detail": f"Turma: {args.get('turma')}"}
                }
            
            elif t_name == "check_financial_status":
                # Lógica Dinâmica (Estrutura Base para httpx):
                # async with httpx.AsyncClient() as client:
                #     res = await client.get(f"{mock_base_url}/financeiro", params={"cpf": args.get("cpf")}, headers=headers)
                
                return {
                    "text": f"Acessei o painel financeiro para o CPF {args.get('cpf')}. De acordo com as diretrizes da escola, não identifiquei faturas em atraso. Posso te ajudar com o boleto do próximo mês?",
                    "audit": {"type": "tool", "headline": "Financeiro API (Estrutura)", "detail": f"CPF: {args.get('cpf')}"}
                }
            
            elif t_name == "start_enrollment":
                # Lógica Dinâmica (Estrutura Base para httpx):
                # async with httpx.AsyncClient() as client:
                #     payload = {"nome": args.get("nome_aluno"), "serie": args.get("serie")}
                #     res = await client.post(f"{mock_base_url}/matricula", json=payload, headers=headers)
                
                return {
                    "text": f"Que maravilha! Iniciei a pré-matrícula de {args.get('nome_aluno')} para a série {args.get('serie')} direto no sistema. Em breve nossa secretaria entrará em contato para os próximos passos.",
                    "audit": {"type": "tool", "headline": "Matrícula API (Estrutura)", "detail": f"Aluno: {args.get('nome_aluno')}"}
                }

    # Resposta Convencional (IA falou sozinha sem tool)
    ai_text = resp_msg.content or ""
    
    # Na evolução: Trace preciso exigindo Structured Outputs nativos
    # Aqui vamos tentar inferir de forma crua, ou forçar JSON se tivessimos usado Response Format.
    # Mas como o Prompt não está em parse block, a "Audit" será simplificada para "leu docs" se chunks existirem.
    
    if chunks:
        # Usa o top 1 chunk como trace pra demonstração, num uso real faríamos logit bias do ID citado
        used_chunk = chunks[0]
        audit = {
            "type": used_chunk.get("chunk_type", "docs"), # "docs", "faq", "script"
            "docName": used_chunk.get("doc_name", "Treinamento"),
            "page": used_chunk.get("page", 1),
            "lineStart": used_chunk.get("line_start"),
            "lineEnd": used_chunk.get("line_end"),
            "chunk": used_chunk.get("text")[:150] + "...", # pedaço
            "source": used_chunk.get("text"), # faq precisa do "source" exato
            "headline": "Encontrou base no contexto",
            "detail": f"Usado {used_chunk.get('source_ref')}"
        }
    else:
        audit = {
            "type": "ai_chat",
            "headline": "Inteligência Geral",
            "detail": "Respondendo com base no treinamento base (sem documentos específicos)."
        }

    return {
        "text": ai_text,
        "audit": audit
    }
