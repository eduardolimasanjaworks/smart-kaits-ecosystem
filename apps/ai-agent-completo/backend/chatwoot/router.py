from fastapi import APIRouter, Depends, HTTPException
import uuid
from core.dependencies import get_current_school_id
from core.config import settings
from chatwoot.service import generate_chatwoot_hmac
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from schools.repository import get_school_by_id

router = APIRouter(prefix="/chatwoot", tags=["Chatwoot"])

@router.get("/sso-config")
async def get_sso_config(
    school_id: uuid.UUID = Depends(get_current_school_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Retorna as configurações necessárias para inicializar o widget do Chatwoot com SSO.
    """
    school = await get_school_by_id(db, school_id)
    if not school:
        raise HTTPException(status_code=404, detail="Escola não encontrada")
        
    # O identificador único será o slug da escola ou o email se disponível
    user_identifier = school.slug
    
    hmac_hash = generate_chatwoot_hmac(user_identifier)

    payload: dict = {
        "website_token": settings.chatwoot_website_token,
        "base_url": settings.chatwoot_widget_url,
    }
    # Só envia identity_validation se o HMAC puder ser gerado (CHATWOOT_IDENTITY_TOKEN
    # igual ao "Identity validation token" ativado no inbox do Chatwoot).
    if hmac_hash and settings.chatwoot_identity_token:
        payload["identity_validation"] = {
            "identifier": user_identifier,
            "identifier_hash": hmac_hash,
            "name": school.name,
            "email": f"{school.slug}@smartkaits.tech",
        }
    return payload
