"""
Mitigações na subida da API: tabelas auxiliares idempotentes e avisos de configuração.

Evita 500 em /schools/members quando o volume Postgres foi criado antes dos SQL de equipa/WhatsApp.
"""

from __future__ import annotations

import logging

from sqlalchemy import text

from core.config import settings
from core.database import engine

logger = logging.getLogger(__name__)

# DDL idempotente (PostgreSQL). FK em school_members exige que `schools` já exista (Alembic/migrações).
_AUX_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS school_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        display_name VARCHAR(120) NOT NULL DEFAULT '',
        password_hash VARCHAR(255) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_school_members_school_email UNIQUE (school_id, email)
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_school_members_school_id ON school_members (school_id)
    """,
    """
    CREATE TABLE IF NOT EXISTS wa_chat_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        contact_e164 VARCHAR(32) NOT NULL,
        role VARCHAR(16) NOT NULL,
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT ck_wa_chat_role CHECK (role IN ('user', 'assistant'))
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_wa_chat_school_contact_time
        ON wa_chat_messages (school_id, contact_e164, created_at DESC)
    """,
    """
    ALTER TABLE schools ADD COLUMN IF NOT EXISTS evolution_instance_name VARCHAR(80)
    """,
    """
    ALTER TABLE schools ADD COLUMN IF NOT EXISTS evolution_instance_token VARCHAR(512)
    """,
]


async def ensure_auxiliary_schema() -> None:
    """Cria tabelas/colunas auxiliares se faltarem (uma transação por comando)."""
    for stmt in _AUX_STATEMENTS:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(stmt))
        except Exception as e:
            logger.warning(
                "Bootstrap schema ignorado (normal se Alembic ainda não criou `schools`): %s",
                e,
            )


def log_configuration_warnings() -> None:
    """Avisos úteis em produção — não bloqueiam a subida."""
    if not (settings.evolution_webhook_public_base or "").strip():
        logger.warning(
            "EVOLUTION_WEBHOOK_PUBLIC_BASE vazio — a Evolution não recebe URL do webhook Smart Kaits; "
            "mensagens WhatsApp podem não disparar o backend até configurar."
        )
    try:
        from ai.config import OPENAI_API_KEY
    except Exception:
        OPENAI_API_KEY = ""
    if settings.is_production and not (OPENAI_API_KEY or "").strip():
        logger.warning(
            "OPENAI_API_KEY / tokenopenai vazio em produção — chat e transcrição de áudio não funcionam."
        )
