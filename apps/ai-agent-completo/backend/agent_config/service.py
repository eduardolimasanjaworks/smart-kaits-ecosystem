"""
agent_config/service.py — Regras de negócio para AgentConfig
"""

import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from agent_config import repository
from agent_config.schemas import AgentConfigData, AgentConfigOut
from realtime.broadcast import notify_school_change

logger = logging.getLogger(__name__)


async def get_my_config(db: AsyncSession, school_id: uuid.UUID) -> dict:
    """Retorna o JSON de config da escola, ocultando campos sensíveis."""
    config = await repository.get_config_by_school(db, school_id)
    if not config:
        return {}
    
    # Faz uma cópia para não alterar o objeto da sessão se for necessário em outro lugar
    data = dict(config.data)
    # 🔐 Segurança: Nunca envia o token de integração para o browser
    data.pop("apiToken", None)
    return data


async def save_my_config(db: AsyncSession, school_id: uuid.UUID, data: dict) -> AgentConfigOut:
    """
    Valida e salva a configuração da escola. 
    Preserva campos sensíveis (como apiToken) que o frontend não possui.
    """
    # Valida o payload
    AgentConfigData.model_validate(data)

    # 🔐 Segurança: Recupera o token existente para não perdê-lo no overwrite do frontend
    existing = await repository.get_config_by_school(db, school_id)
    if existing and "apiToken" in existing.data and "apiToken" not in data:
        data["apiToken"] = existing.data["apiToken"]

    # Salva o JSON bruto
    config = await repository.upsert_config(db, school_id, data)

    # ── Re-indexa o formulário no Qdrant ────────────────────
    from ai.chunker import chunks_from_agent_config
    from ai.indexer import index_chunks, clear_school_chunks

    try:
        # 1. Limpa chunks antigos do "formulário" para não duplicar
        await clear_school_chunks(str(school_id), doc_ids=["config", "config_faq", "config_script"])
        
        # 2. Gera novos chunks dos campos (FAQ, Roteiro, etc)
        form_chunks = chunks_from_agent_config(data, str(school_id))
        
        # 3. Indexa
        await index_chunks(form_chunks)
    except Exception as e:
        logger.warning("Erro ao re-indexar formulário no Qdrant: %s", e, exc_info=True)

    await notify_school_change(school_id, "config_updated", {})

    return AgentConfigOut.model_validate(config)
