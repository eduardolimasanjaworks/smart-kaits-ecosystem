"""
backend/ai/router.py — Rotas para interação com a IA

Endpoints para:
  - Chat com o assistente (RAG + Trace)
  - Processamento de áudio (Builder mode futuro)
"""

from fastapi import APIRouter, Depends, HTTPException
import uuid
from typing import List, Optional
from pydantic import BaseModel

from core.dependencies import get_current_school_id, bearer_scheme
from schools.models import School
from ai.assistant import process_chat_message
from agent_config.repository import get_config_by_school
from core.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/ai", tags=["Inteligência Artificial"])

class ChatMessage(BaseModel):
    text: str
    history: Optional[List[dict]] = []

class ChatResponse(BaseModel):
    text: str
    audit: dict

@router.post("/chat", response_model=ChatResponse)
async def chat_with_assistant(
    payload: ChatMessage,
    credentials = Depends(bearer_scheme),
    school_id: uuid.UUID = Depends(get_current_school_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Endpoint principal para o chat de simulação/teste.
    Recupera a config da escola atual e manda para a lógica da IA.
    """
    config_obj = await get_config_by_school(db, school_id)
    
    if not config_obj:
        raise HTTPException(status_code=404, detail="Configuração do agente não encontrada para esta escola.")

    # Converte o AgentConfig model em dict (payload do JSONB)
    agent_config_dict = config_obj.data
    
    # Chama o assistente
    result = await process_chat_message(
        user_message=payload.text,
        school_id=str(school_id),
        agent_config=agent_config_dict,
        chat_history=payload.history,
        kaits_token=credentials.credentials if credentials else None
    )
    
    return ChatResponse(**result)

@router.post("/builder/text", summary="Configura o agente por texto/instrução")
async def process_builder_text(
    payload: ChatMessage,
    school_id: uuid.UUID = Depends(get_current_school_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Recebe uma instrução (ex: vinda de um áudio transcrito no front)
    e altera a configuração da escola automaticamente usando a IA.
    """
    from ai.builder import process_builder_request
    from agent_config import service
    
    # Busca config atual
    # Busca config atual
    config_obj = await get_config_by_school(db, school_id)
    current_config = config_obj.data if config_obj else {}

    # Pede para a IA gerar as mudanças
    result = await process_builder_request(payload.text, current_config)
    
    # Se a IA precisa de mais info para prosseguir
    if result.get("needs_more_info"):
        return {
            "status": "needs_more_info", 
            "message": result["needs_more_info"],
            "config": current_config
        }

    patch = result.get("patch", {})
    if not patch:
        return {"status": "no_changes", "config": current_config}

    # Apenas retorna a proposta, não salva automaticamente (Respeite a autonomia do usuário)
    return {
        "status": "proposal", 
        "patch": patch,
        "changes": list(patch.keys()), 
        "thinking": result.get("thinking"),
        "message": "Entendi o que você quer fazer! Olhe o que preparei:",
        "focus_section": result.get("focus_section")
    }

