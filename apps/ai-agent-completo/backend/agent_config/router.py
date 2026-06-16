"""
agent_config/router.py — Endpoints para configuração do agente
"""

import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.dependencies import get_current_school_id
from agent_config import service

router = APIRouter(tags=["Configuração do Agente"], prefix="/me")


@router.get("/config", summary="Carregar configuração do agente")
async def get_config(
    school_id: uuid.UUID = Depends(get_current_school_id),
    db: AsyncSession = Depends(get_db),
):
    """Retorna o JSON de configuração da escola autenticada."""
    return await service.get_my_config(db, school_id)


@router.put("/config", summary="Salvar configuração do agente")
async def save_config(
    data: dict,
    school_id: uuid.UUID = Depends(get_current_school_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Substitui toda a configuração da escola com os dados fornecidos.
    O frontend deve enviar o objeto `agentConfig` completo.
    """
    return await service.save_my_config(db, school_id, data)
