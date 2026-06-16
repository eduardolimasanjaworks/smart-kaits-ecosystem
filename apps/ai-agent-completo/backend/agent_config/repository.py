"""
agent_config/repository.py — Queries de banco para AgentConfig
"""

import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from agent_config.models import AgentConfig


async def get_config_by_school(db: AsyncSession, school_id: uuid.UUID) -> AgentConfig | None:
    """Retorna a config do agente de uma escola, ou None se ainda não existir."""
    result = await db.execute(
        select(AgentConfig).where(AgentConfig.school_id == school_id)
    )
    return result.scalar_one_or_none()


async def upsert_config(db: AsyncSession, school_id: uuid.UUID, data: dict) -> AgentConfig:
    """
    Cria ou atualiza a configuração do agente de uma escola.
    Se já existir, substitui o campo `data` inteiramente.
    """
    config = await get_config_by_school(db, school_id)

    if config is None:
        config = AgentConfig(school_id=school_id, data=data)
        db.add(config)
    else:
        config.data = data  # type: ignore[assignment]

    await db.flush()
    await db.refresh(config)
    return config
