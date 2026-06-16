"""
audit/router.py — Endpoints para consulta de logs de auditoria.
"""

import logging
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import desc, select
from sqlalchemy.exc import DBAPIError, ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_school_id
from core.models import AuditLog

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Auditoria"], prefix="/me/audit")


@router.get("/logs")
async def list_audit_logs(
    school_id: uuid.UUID = Depends(get_current_school_id),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
):
    """Retorna os logs de auditoria mais recentes da escola."""
    query = (
        select(AuditLog)
        .where(AuditLog.school_id == school_id)
        .order_by(desc(AuditLog.created_at))
        .limit(limit)
    )
    try:
        result = await db.execute(query)
        logs = result.scalars().all()
    except (ProgrammingError, DBAPIError) as e:
        logger.warning("Auditoria indisponível (tabela ou DB) — rode sql/006_audit_logs.sql: %s", e)
        return []

    return [
        {
            "id": l.id,
            "action": l.action,
            "target": l.target,
            "detail": l.detail,
            "created_at": l.created_at,
            "meta_data": l.meta_data,
        }
        for l in logs
    ]
