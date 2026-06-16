"""
ai/assistant.py - Ponto de Entrada da Conversa

Atende requisições do frontend, roda o RAG (se precisar), monta o System Prompt,
e aciona a OpenAI.
"""

import httpx
import json
from ai.client import openai_client
from ai.config import CHAT_MODEL
from ai.retriever import search_knowledge
from ai.prompt_builder import build_assistant_system_prompt

KAITS_BASE_URL = "https://api.kaits.com.br"
MAX_RESULTS_DEFAULT = 10  # Limite padrão de resultados
MAX_JSON_LENGTH = 5000    # Limite de caracteres para a resposta JSON


async def call_kaits_api(
    kaits_token: str,
    endpoint: str,
    action: str,
    params: dict = None,
) -> dict:
    """
    Helper function to call KAITS API endpoints.
    
    Args:
        kaits_token: The KAITS API token
        endpoint: The endpoint to call (e.g., "alunos", "aulas", "cursos")
        action: The action to perform (e.g., "alunos", "turmas", "valores")
        params: Additional parameters for the request
    
    Returns:
        The API response
    """
    url = f"{KAITS_BASE_URL}/{endpoint}/"
    payload = {
        "token": kaits_token,
        "acao": action
    }
    
    if params:
        payload.update(params)
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                headers={"Content-Type": "application/json"},
                json=payload,
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()
    except Exception as e:
        return {"sucesso": "0", "msg": str(e)}


async def process_chat_message(
    user_message: str,
    school_id: str,
    agent_config: dict,
    chat_history: list = None,
    kaits_token: str = None,
) -> dict:
    """
    Controlador principal que:
      1. Avalia se precisa chamar o VectorDB (RAG)
      2. Manda para IA responder
      3. Extrai um Trace Estruturado das fontes que ela usou.
    """
    
    # 1. Recupera chunks mais relevantes (Vector Search)
    chunks = await search_knowledge(school_id, user_message, top_k=6)
    
    # 2. Monta o super-prompt
    sys_prompt = build_assistant_system_prompt(agent_config, facts=chunks)
    
    messages = [{"role": "system", "content": sys_prompt}]
    
    # Adiciona o histórico no modelo
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
            "description": "Acione isso apenas caso o usuário pedir para falar com um atendente humano ou você não possuir informações suficientes para responder.",
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
                "description": "Consulta turmas, cursos e aulas da escola. Use sempre que o usuário perguntar sobre horários, turmas, calendário escolar. SEMPRE peça mais detalhes se a busca for muito genérica.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "idTurm": {"type": "string", "description": "ID da turma, se conhecido"},
                        "idCurs": {"type": "string", "description": "ID do curso, se conhecido"},
                        "idEst": {"type": "string", "description": "ID do estágio, se conhecido"},
                        "todasTurmas": {"type": "boolean", "description": "Buscar todas as turmas disponíveis"},
                        "todosCursos": {"type": "boolean", "description": "Buscar todos os cursos disponíveis"},
                        "todosEstagios": {"type": "boolean", "description": "Buscar todos os estágios disponíveis"},
                        "limite": {"type": "integer", "description": f"Limite de resultados (padrão: {MAX_RESULTS_DEFAULT})"}
                    }
                }
            }
        })

    if conf_tools.get("checkFinancial"):
        tools.append({
            "type": "function",
            "function": {
                "name": "check_financial",
                "description": "Consulta valores de turmas e financeiro. Use quando o usuário perguntar sobre mensalidades, valores, taxas de matrícula.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "idTurm": {"type": "string", "description": "ID da turma para consultar valores"},
                        "soMatric": {"type": "boolean", "description": "Mostrar apenas valores de matrícula"}
                    }
                }
            }
        })

    if conf_tools.get("searchStudent"):
        tools.append({
            "type": "function",
            "function": {
                "name": "search_student",
                "description": "Busca dados de alunos cadastrados. Use quando o usuário perguntar sobre alunos por nome, CPF, e-mail ou matrícula. SEMPRE peça pelo menos um filtro (nome, CPF ou matrícula) para evitar retornar muitos resultados.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "nome": {"type": "string", "description": "Nome ou parte do nome do aluno"},
                        "CPF": {"type": "string", "description": "CPF do aluno"},
                        "email": {"type": "string", "description": "E-mail do aluno"},
                        "numMatric": {"type": "string", "description": "Número da matrícula do aluno"},
                        "RG": {"type": "string", "description": "RG do aluno"},
                        "limite": {"type": "integer", "description": f"Limite de resultados (padrão: {MAX_RESULTS_DEFAULT})"}
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
                        "nome_aluno": {"type": "string", "description": "Nome completo do aluno"},
                        "serie": {"type": "string", "description": "Série ou turma desejada"},
                        "idTurm": {"type": "string", "description": "ID da turma, se já selecionada"}
                    },
                    "required": ["nome_aluno", "serie"]
                }
            }
        })

    # Para obtermos qual source foi usada, pedimos à IA pra responder em um FORMATO ESTRUTURADO.
    response = await openai_client.chat.completions.create(
        model=CHAT_MODEL,
        messages=messages,
        tools=tools if tools else None,
        tool_choice="auto",
        temperature=0.3,  # Respostas mais controladas
    )
    
    resp_msg = response.choices[0].message
    
    # Ela ativou alguma tool?
    if resp_msg.tool_calls:
        # Prepara o header de autorização para a API do Kaits
        token_to_use = kaits_token or agent_config.get("apiToken")
        
        for tool_call in resp_msg.tool_calls:
            t_name = tool_call.function.name
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
                api_result = {}
                needs_more_info = False
                
                if token_to_use:
                    limite = args.get("limite", MAX_RESULTS_DEFAULT)
                    
                    # Verifica se a busca é muito genérica
                    if args.get("todasTurmas") or args.get("todosCursos") or args.get("todosEstagios"):
                        tudosepara = await call_kaits_api(
                            token_to_use,
                            endpoint="cursos",
                            action="tudosepara"
                        )
                        api_result["tudosepara"] = tudosepara
                        
                        # Verifica se a resposta é muito longa
                        json_length = len(json.dumps(api_result, ensure_ascii=False))
                        if json_length > MAX_JSON_LENGTH:
                            needs_more_info = True
                    
                    if args.get("idTurm"):
                        aulas_turma = await call_kaits_api(
                            token_to_use,
                            endpoint="aulas",
                            action="aulasTurma",
                            params={"idTurm": args["idTurm"]}
                        )
                        api_result["aulasTurma"] = aulas_turma
                
                if needs_more_info:
                    return {
                        "text": "Encontrei muitos resultados! Para poder te ajudar melhor, poderia me dizer: \n1. Qual curso você tem interesse? \n2. Ou qual turma? \n3. Ou se você quer aulas de um dia específico?",
                        "audit": {"type": "tool", "headline": "Pedir mais informações para filtrar", "detail": args}
                    }
                elif api_result:
                    return {
                        "text": f"Consultei o sistema KAITS e encontrei: {json.dumps(api_result, ensure_ascii=False)}",
                        "audit": {"type": "tool", "headline": "Consultou turmas/grade via KAITS API", "detail": args}
                    }
                else:
                    return {
                        "text": "Tentei consultar o sistema, mas não consegui acessar a API no momento. Deseja que eu fale com a secretaria?",
                        "audit": {"type": "tool", "headline": "Erro ao consultar KAITS API", "detail": args}
                    }
            
            elif t_name == "check_financial":
                api_result = None
                if token_to_use:
                    api_result = await call_kaits_api(
                        token_to_use,
                        endpoint="cursos",
                        action="valores",
                        params=args
                    )
                
                if api_result:
                    return {
                        "text": f"Consultei o sistema KAITS e encontrei: {json.dumps(api_result, ensure_ascii=False)}",
                        "audit": {"type": "tool", "headline": "Consultou financeiro via KAITS API", "detail": args}
                    }
                else:
                    return {
                        "text": "Tentei consultar o sistema, mas não consegui acessar a API no momento. Deseja que eu fale com a secretaria?",
                        "audit": {"type": "tool", "headline": "Erro ao consultar KAITS API", "detail": args}
                    }
            
            elif t_name == "search_student":
                api_result = None
                needs_more_info = False
                
                # Verifica se tem pelo menos um filtro
                has_filter = any([
                    args.get("nome"), 
                    args.get("CPF"), 
                    args.get("email"), 
                    args.get("numMatric"), 
                    args.get("RG")
                ])
                
                if not has_filter:
                    return {
                        "text": "Para poder buscar o aluno, preciso de pelo menos uma informação: nome, CPF, e-mail ou número da matrícula. Qual você tem?",
                        "audit": {"type": "tool", "headline": "Pedir filtro para busca de aluno", "detail": args}
                    }
                
                if token_to_use:
                    limite = args.get("limite", MAX_RESULTS_DEFAULT)
                    api_result = await call_kaits_api(
                        token_to_use,
                        endpoint="alunos",
                        action="alunos",
                        params=args
                    )
                    
                    # Verifica se a resposta é muito longa
                    if api_result and len(json.dumps(api_result, ensure_ascii=False)) > MAX_JSON_LENGTH:
                        needs_more_info = True
                
                if needs_more_info:
                    return {
                        "text": "Encontrei muitos alunos! Poderia me dar mais detalhes, como o nome completo ou a turma?",
                        "audit": {"type": "tool", "headline": "Pedir mais informações para filtrar alunos", "detail": args}
                    }
                elif api_result:
                    return {
                        "text": f"Consultei o sistema KAITS e encontrei: {json.dumps(api_result, ensure_ascii=False)}",
                        "audit": {"type": "tool", "headline": "Buscou aluno via KAITS API", "detail": args}
                    }
                else:
                    return {
                        "text": "Tentei consultar o sistema, mas não consegui acessar a API no momento. Deseja que eu fale com a secretaria?",
                        "audit": {"type": "tool", "headline": "Erro ao consultar KAITS API", "detail": args}
                    }
            
            elif t_name == "start_enrollment":
                return {
                    "text": f"Que maravilha! Iniciei a pré-matrícula de {args.get('nome_aluno')} para a série {args.get('serie')} direto no sistema. Em breve nossa secretaria entrará em contato para os próximos passos.",
                    "audit": {"type": "tool", "headline": "Iniciou pré-matrícula", "detail": args}
                }

    # Resposta Convencional (IA falou sozinha sem tool)
    ai_text = resp_msg.content or ""
    
    if chunks:
        used_chunk = chunks[0]
        audit = {
            "type": used_chunk.get("chunk_type", "docs"),
            "docName": used_chunk.get("doc_name", "Treinamento"),
            "page": used_chunk.get("page", 1),
            "lineStart": used_chunk.get("line_start"),
            "lineEnd": used_chunk.get("line_end"),
            "chunk": used_chunk.get("text")[:150] + "...",
            "source": used_chunk.get("text"),
            "headline": "Encontrei base no contexto",
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
