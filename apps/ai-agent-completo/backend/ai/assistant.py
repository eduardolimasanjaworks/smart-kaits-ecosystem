"""
ai/assistant.py — Ponto de Entrada da Conversa

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


async def call_kaits_api(
    kaits_token: str,
    action: str,
    param: dict = None,
    idTurma: str = None,
    filtro: dict = None
) -> dict:
    """
    Helper function to call KAITS API endpoints.
    """
    headers = {
        "Content-Type": "application/json"
    }
    payload = {
        "token": kaits_token,
        "acao": action
    }
    if param is not None:
        payload["param"] = param
    if idTurma is not None:
        payload["idTurma"] = idTurma
    if filtro is not None:
        payload["filtro"] = filtro

    try:
        async with httpx.AsyncClient() as client:
            if action == "ia":
                response = await client.post(
                    f"{KAITS_BASE_URL}/ia/",
                    headers=headers,
                    json=payload,
                    timeout=30.0
                )
            else:
                response = await client.post(
                    KAITS_BASE_URL,
                    headers=headers,
                    json=payload,
                    timeout=30.0
                )
            response.raise_for_status()
            return response.json()
    except Exception as e:
        return {"success": False, "error": str(e)}


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
                "description": "Consulta a grade escolar, turmas disponíveis e aulas. Use sempre que o usuário perguntar sobre horários, turmas, aulas, calendário escolar.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "idTurma": {"type": "string", "description": "ID da turma, se conhecido."},
                        "idAula": {"type": "string", "description": "ID da aula, se conhecido."},
                        "data_inicial": {"type": "string", "description": "Data inicial (formato: AAAA-MM-DD) para filtrar aulas."},
                        "data_final": {"type": "string", "description": "Data final (formato: AAAA-MM-DD) para filtrar aulas."},
                        "incluir_turmas": {"type": "boolean", "description": "Se deve buscar a lista de turmas disponíveis (padrão: true)."}
                    }
                }
            }
        })

    if conf_tools.get("checkFinancial"):
        tools.append({
            "type": "function",
            "function": {
                "name": "check_financial_status",
                "description": "Verifica pendências financeiras, boletos ou valores de turmas. Use quando o usuário perguntar sobre mensalidades, valores, pendências, boletos.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "cpf": {"type": "string", "description": "CPF do aluno ou responsável, para consultar pendências."},
                        "idTurma": {"type": "string", "description": "ID da turma para consultar valores e taxas de matrícula."}
                    }
                }
            }
        })

    if conf_tools.get("searchStudent"):
        tools.append({
            "type": "function",
            "function": {
                "name": "search_student",
                "description": "Busca dados de alunos, responsáveis ou usuários cadastrados. Use quando o usuário perguntar sobre dados de uma pessoa (nome, CPF, e-mail, telefone).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "nome": {"type": "string", "description": "Nome (ou parte do nome) do usuário para busca."},
                        "cpf": {"type": "string", "description": "CPF do usuário para busca."},
                        "email": {"type": "string", "description": "E-mail do usuário para busca."},
                        "telefone": {"type": "string", "description": "Telefone do usuário para busca."}
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
                        "nome_aluno": {"type": "string", "description": "Nome completo do aluno."},
                        "serie": {"type": "string", "description": "Série ou turma desejada."},
                        "idTurma": {"type": "string", "description": "ID da turma, se já selecionada."},
                        "nome_responsavel": {"type": "string", "description": "Nome do responsável (se aplicável)."}
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
                api_result = None
                if token_to_use:
                    # Primeiro busca turmas, se necessário
                    turmas_result = None
                    if args.get("incluir_turmas", True):
                        turmas_result = await call_kaits_api(
                            token_to_use,
                            action="turmas"
                        )
                    
                    # Depois busca aulas com os parâmetros fornecidos
                    param = {}
                    if args.get("idAula"):
                        param["idAula"] = args["idAula"]
                    if args.get("data_inicial"):
                        param["desdeData"] = args["data_inicial"]
                    if args.get("data_final"):
                        param["ateData"] = args["data_final"]
                    if args.get("idTurma"):
                        param["idTurma"] = args["idTurma"]
                    
                    aulas_result = await call_kaits_api(
                        token_to_use,
                        action="alunosAula",
                        param=param
                    )
                    
                    api_result = {}
                    if turmas_result:
                        api_result["turmas"] = turmas_result
                    if aulas_result:
                        api_result["aulas"] = aulas_result
                
                if api_result:
                    return {
                        "text": f"Consultei o sistema KAITS e encontrei: {json.dumps(api_result, ensure_ascii=False)}",
                        "audit": {"type": "tool", "headline": "Consultou turmas/grade via KAITS API", "detail": args}
                    }
                else:
                    return {
                        "text": "Tentei consultar o sistema, mas não consegui acessar a API no momento. Deseja que eu fale com a secretaria?",
                        "audit": {"type": "tool", "headline": "Erro ao consultar KAITS API", "detail": args}
                    }
            
            elif t_name == "check_financial_status":
                api_result = None
                if token_to_use:
                    if args.get("idTurma"):
                        valores_result = await call_kaits_api(
                            token_to_use,
                            action="valores",
                            idTurma=args["idTurma"]
                        )
                        api_result = valores_result
                    elif args.get("cpf"):
                        dados_result = await call_kaits_api(
                            token_to_use,
                            action="dadosQuem",
                            filtro={"cpf": args["cpf"]}
                        )
                        api_result = dados_result
                
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
                if token_to_use:
                    filtro = {}
                    if args.get("nome"):
                        filtro["nome"] = args["nome"]
                    if args.get("cpf"):
                        filtro["cpf"] = args["cpf"]
                    if args.get("email"):
                        filtro["email"] = args["email"]
                    if args.get("telefone"):
                        filtro["telefone"] = args["telefone"]
                    
                    api_result = await call_kaits_api(
                        token_to_use,
                        action="dadosQuem",
                        filtro=filtro
                    )
                
                if api_result:
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
