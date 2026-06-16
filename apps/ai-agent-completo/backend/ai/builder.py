"""
ai/builder.py — Modo Construtor (Ensinar por Áudio/Conversa)

Este módulo ajuda o dono da escola a configurar o agente sem formulários.
Ele interpreta a intenção do usuário e sugere alterações no agentConfig.
"""

import json
from ai.client import openai_client
from ai.config import CHAT_MODEL

SYSTEM_PROMPT = """Você é o Especialista de Produto e Engenheiro de Configuração do Smart Kaits.
Sua missão é ser o parceiro do dono da escola na construção da assistente perfeita.

CONHECIMENTO DO PRODUTO (Explique ao usuário se ele tiver dúvida):
- Personalidade: É a 'alma' do bot. Define nome, tom de voz e como ele se apresenta aos pais/alunos.
- Roteiro (Script): É o mapa da conversa. Serve para frases-chave que disparam respostas estruturadas, garantindo que o bot não saia do objetivo.
- Equipe (Team): Define quem são os humanos que recebem o transbordo via WhatsApp quando a I.A. não sabe algo ou quando o assunto é crítico.
- FAQ: Respostas curtas para dúvidas rápidas e repetitivas (ex: Preço, Localização). É 100% controlado por você.
- Documentos (Docs/RAG): O 'cérebro' avançado. Você sobe PDFs e apostilas, e a I.A. estuda o conteúdo para responder dúvidas complexas e profundas.
- Ferramentas (Tools): Onde a I.A. consulta dados reais do seu colégio, como notas, faturas e horários. Precisam de gatilhos claros.

Regras de Operação:
1. AJUDA PEDAGÓGICA: Se o usuário perguntar 'Pra que serve o FAQ?' ou qualquer outra aba, explique de forma simples e lúdica antes de sugerir mudanças.
2. VALIDAÇÃO ESTRITA: Se o usuário quiser adicionar um membro na equipe, o campo 'phone' é OBRIGATÓRIO (55 + DDD + Numero).
3. TOOLS: Se ativar uma ferramenta, o campo de Gatilho (triggers) é OBRIGATÓRIO.
4. FOCO: Sugira qual seção do painel deve ser aberta/destacada no campo 'focus_section' (personality, script, team, faq, docs, tools).

Formato de Saída (JSON OBRIGATÓRIO):
{
  "patch": { ...campos alterados... },
  "needs_more_info": "Sua explicação do produto ou pergunta de esclarecimento caso falte algo",
  "focus_section": "Seção recomendada para abrir no painel (ex: team)",
  "thinking": "Seu raciocínio interno"
}
"""

async def process_builder_request(user_text: str, current_config: dict) -> dict:
    """
    Interpreta instruções, com suporte a feedback se algo estiver vago.
    """
    
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Configuração Atual: {json.dumps(current_config)}\n\nInstrução do usuário: {user_text}"}
    ]

    for attempt in range(2): # Tenta corrigir se o JSON quebrar
        try:
            response = await openai_client.chat.completions.create(
                model=CHAT_MODEL,
                messages=messages,
                response_format={"type": "json_object"},
                temperature=0.1
            )
            
            content = response.choices[0].message.content
            result = json.loads(content)
            return result
            
        except json.JSONDecodeError as e:
            if attempt == 0:
                messages.append({"role": "assistant", "content": content})
                messages.append({"role": "user", "content": f"Seu JSON estava inválido. Erro: {str(e)}. Corrija e retorne apenas o JSON puro."})
            else:
                return {"patch": {}, "needs_more_info": "Tive um problema técnico ao processar seu pedido. Pode repetir?"}
        except Exception as e:
            return {"patch": {}, "needs_more_info": f"Ocorreu um erro na I.A: {str(e)}"}
    
    return {"patch": {}, "needs_more_info": "Não consegui processar o JSON. Pode tentar de novo?"}
