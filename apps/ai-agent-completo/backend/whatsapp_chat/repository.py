"""Persistência de histórico curto WhatsApp por contacto."""

import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from whatsapp_chat.models import WaChatMessage


async def append_wa_message(
    db: AsyncSession,
    *,
    school_id: uuid.UUID,
    contact_e164: str,
    role: str,
    body: str,
) -> None:
    row = WaChatMessage(
        school_id=school_id,
        contact_e164=contact_e164[:32],
        role=role,
        body=body[:16000],
    )
    db.add(row)
    await db.flush()


async def recent_history_for_contact(
    db: AsyncSession,
    *,
    school_id: uuid.UUID,
    contact_e164: str,
    limit: int = 14,
) -> list[dict]:
    """Formato esperado por `process_chat_message`: {from: 'user'|'ai', text: str}."""
    q = (
        select(WaChatMessage)
        .where(
            WaChatMessage.school_id == school_id,
            WaChatMessage.contact_e164 == contact_e164[:32],
        )
        .order_by(WaChatMessage.created_at.desc())
        .limit(limit)
    )
    res = await db.execute(q)
    rows = list(res.scalars().all())
    rows.reverse()
    out: list[dict] = []
    for r in rows:
        out.append(
            {
                "from": "user" if r.role == "user" else "ai",
                "text": r.body,
            }
        )
    return out
