import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from pydantic import BaseModel

from core.config import settings
from core.database import async_session_factory
from evolution_inbound import process_evolution_payload

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

class PausePayload(BaseModel):
    contact_id: str
    pause: bool = True
    reason: Optional[str] = None

# Cache simples em memória (em produção seria Redis)
paused_contacts = {}

@router.post("/pause-contact")
async def pause_contact_webhook(payload: PausePayload):
    """
    Webhook para pausar/despausar a I.A. para um contato específico.
    Utilizado por integrações externas (Chatwoot, Meta, etc).
    """
    paused_contacts[payload.contact_id] = payload.pause
    
    return {
        "status": "success",
        "contact_id": payload.contact_id,
        "is_paused": payload.pause,
        "message": f"I.A. {'pausada' if payload.pause else 'ativada'} para o contato."
    }

@router.get("/is-paused/{contact_id}")
async def check_pause_status(contact_id: str):
    return {"contact_id": contact_id, "is_paused": paused_contacts.get(contact_id, False)}


async def _evolution_background_job(body: dict) -> None:
    async with async_session_factory() as db:
        try:
            await process_evolution_payload(db, body)
            await db.commit()
        except Exception:
            await db.rollback()
            logger.exception("Falha ao processar webhook Evolution")


@router.post("/evolution")
async def evolution_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Recebe eventos da Evolution API (MESSAGES_UPSERT, etc.).
    Responde no WhatsApp com a mesma I.A. + RAG da escola (mapeamento pelo nome da instância sk_<uuid_hex>).
    """
    sec = (settings.evolution_webhook_secret or "").strip()
    if sec:
        got = request.headers.get("x-smart-kaits-webhook-secret") or request.headers.get(
            "X-Smart-Kaits-Webhook-Secret"
        )
        if got != sec:
            raise HTTPException(status_code=401, detail="Webhook não autorizado.")

    try:
        body = await request.json()
    except Exception:
        body = {}

    background_tasks.add_task(_evolution_background_job, body)
    return {"received": True}
