"""
Rotas /api/v1/whatsapp/* — Evolution API v2 (por escola, JWT).

Ver `docs/EVOLUTION_WHATSAPP.md` para mapeamento com a doc oficial.
"""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_principal_school_id, get_current_school_id
from evolution_service import evolution_instance_name, evolution_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp / Evolution"])


class MarkReadMessageItem(BaseModel):
    remoteJid: str
    fromMe: bool
    id: str


class MarkReadBody(BaseModel):
    readMessages: list[MarkReadMessageItem] = Field(min_length=1)


class SendTextBody(BaseModel):
    number: str = Field(description="Apenas dígitos, com DDI (ex.: 5511999990000)")
    text: str = Field(min_length=1, max_length=4096)


@router.get("/connect")
async def get_whatsapp_connection(
    school_id: uuid.UUID = Depends(get_current_school_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await evolution_service.ensure_qr_for_school(db, school_id)
    except SQLAlchemyError as e:
        logger.exception("GET /whatsapp/connect: erro de base de dados")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Base de dados temporariamente indisponível. "
                "Aguarde alguns segundos e tente gerar o QR novamente."
            ),
        ) from e


@router.get("/status")
async def whatsapp_connection_status(
    school_id: uuid.UUID = Depends(get_current_school_id),
):
    return await evolution_service.connection_state_for_school(school_id)


@router.get("/instance")
async def get_whatsapp_instance_metadata(
    school_id: uuid.UUID = Depends(get_current_school_id),
):
    """Evolution: GET /instance/fetchInstances?instanceName=sk_..."""
    return await evolution_service.fetch_instance_for_school(school_id)


@router.post("/restart")
async def restart_whatsapp_instance(
    school_id: uuid.UUID = Depends(get_current_school_id),
):
    """Evolution: POST /instance/restart/{instance}"""
    out = await evolution_service.restart_instance(evolution_instance_name(school_id))
    if out.get("status") == "error":
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=out.get("message", "Falha ao reiniciar a instância na Evolution."),
        )
    return out


@router.post("/logout")
async def logout_whatsapp_instance(
    school_id: uuid.UUID = Depends(get_current_school_id),
):
    """Evolution: DELETE /instance/logout/{instance}"""
    out = await evolution_service.logout_instance(evolution_instance_name(school_id))
    if out.get("status") == "error":
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=out.get("message", "Falha ao fazer logout na Evolution."),
        )
    return out


@router.delete("/instance")
async def delete_whatsapp_instance(
    school_id: uuid.UUID = Depends(get_current_principal_school_id),
    db: AsyncSession = Depends(get_db),
):
    """Evolution: DELETE /instance/delete/{instance} — só acesso principal da escola."""
    return await evolution_service.delete_instance_for_school(db, school_id)


@router.post("/chat/mark-read")
async def mark_whatsapp_messages_read(
    body: MarkReadBody,
    school_id: uuid.UUID = Depends(get_current_school_id),
):
    """Evolution: POST /chat/markMessageAsRead/{instance}"""
    out = await evolution_service.mark_messages_as_read(
        evolution_instance_name(school_id),
        [m.model_dump() for m in body.readMessages],
    )
    if out.get("status") == "error":
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=out.get("message", "Falha ao marcar mensagens como lidas na Evolution."),
        )
    return out


@router.post("/send-text")
async def send_whatsapp_text(
    body: SendTextBody,
    school_id: uuid.UUID = Depends(get_current_school_id),
):
    """Evolution: POST /message/sendText/{instance}"""
    digits = "".join(c for c in body.number if c.isdigit())
    if len(digits) < 10:
        raise HTTPException(status_code=400, detail="Número inválido.")
    ok = await evolution_service.send_text(evolution_instance_name(school_id), digits, body.text)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Evolution não aceitou o envio.",
        )
    return {"ok": True}
