"""
core/audit.py — Utilitário para gravação de logs de auditoria.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from core.models import AuditLog

async def log_action(
    db: AsyncSession,
    school_id: str,
    action: str,
    target: str,
    detail: str,
    meta_data: dict = None
):
    log = AuditLog(
        school_id=school_id,
        action=action,
        target=target,
        detail=detail,
        meta_data=meta_data
    )
    db.add(log)
    await db.flush()
