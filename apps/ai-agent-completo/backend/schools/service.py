"""
schools/service.py — Regras de negócio para Schools

Responsabilidade: orquestrar repository + security para implementar
as regras de negócio do domínio de escolas.

NÃO faz queries SQL diretamente — usa repository.py.
NÃO lida com HTTP — usa schemas como contratos de entrada/saída.
"""

import logging
import hashlib
import hmac
import re
import secrets
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from agent_config import repository as agent_config_repository
from core.config import settings
from core.security import create_access_token, decode_access_token, hash_password, verify_password
from realtime.broadcast import notify_school_change
from schools import repository
from schools.models import School, SchoolMember
from schools.schemas import (
    EmbedHandshakeRequest,
    LoginRequest,
    MemberCreate,
    MemberLoginRequest,
    MemberOut,
    SchoolCreate,
    SchoolOut,
    SessionOut,
    TokenOut,
)

logger = logging.getLogger(__name__)

_MOCK_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

# JSON inicial ao criar escola via MOCK_LOGIN_AUTO_PROVISION_SCHOOL (alinhado ao seed mock).
_MOCK_PROVISION_DEFAULT_AGENT: dict = {
    "assistantName": "Assistente",
    "personality": "Objetiva e cordial.",
    "greeting": "Olá! Como posso ajudar?",
    "isPaused": False,
    "scriptRules": [],
    "teamMembers": [],
    "faqItems": [],
    "docs": [],
    "fallbackContact": "",
    "fallbackMessage": "Encaminhando para humano.",
    "fallbackUserMessage": "Vou te conectar com um atendente.",
    "apiToken": "",
    "pauseAiOnHandover": True,
    "tools": {
        "consultClasses": False,
        "consultClassesTriggers": [],
        "checkSchedule": False,
        "checkScheduleTriggers": [],
        "enrollStudent": False,
        "enrollStudentTriggers": [],
        "checkFinancial": False,
        "checkFinancialTriggers": [],
    },
}


def _normalize_member_email(email: str) -> str:
    return email.strip().lower()


# ── Autenticação ───────────────────────────────────────────

async def persist_login_session_after_token(
    db: AsyncSession, school_id: uuid.UUID, token: str
) -> None:
    """Grava `login_sessions` quando AUTH_STORE_SESSIONS_IN_DB=true."""
    if not settings.auth_store_sessions_in_db:
        return
    pl = decode_access_token(token)
    jti = pl.get("jti")
    exp_ts = pl.get("exp")
    if not isinstance(jti, str) or not isinstance(exp_ts, (int, float)):
        raise RuntimeError("JWT emitido sem jti/exp — verifique core/security.py")
    expires_at = datetime.fromtimestamp(float(exp_ts), tz=timezone.utc)
    await repository.create_login_session(
        db, school_id=school_id, jti=jti, expires_at=expires_at
    )


async def revoke_login_session_by_token(db: AsyncSession, token: str) -> None:
    """Remove a sessão ativa (logout) quando o armazenamento em DB está ligado."""
    if not settings.auth_store_sessions_in_db:
        return
    try:
        pl = decode_access_token(token)
    except Exception:
        return
    jti = pl.get("jti")
    if isinstance(jti, str):
        await repository.delete_login_session_by_jti(db, jti)


async def embed_handshake_school(db: AsyncSession, data: EmbedHandshakeRequest) -> TokenOut:
    """
    Emite JWT quando o portal prova posse do EMBED_TRUST_SECRET via HMAC (sem senha no cliente).
    """
    if not (settings.embed_trust_secret or "").strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Handshake embed não configurado neste ambiente.",
        )

    now_ts = int(datetime.now(timezone.utc).timestamp())
    if abs(now_ts - data.ts) > settings.embed_hmac_ttl_seconds:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Assinatura fora da janela de tempo permitida.",
        )

    # Tentar formato com dois pontos (PHP) primeiro
    msg_colon = f"{data.school_slug}:{data.ts}".encode("utf-8")
    expected_colon = hmac.new(
        settings.embed_trust_secret.encode("utf-8"),
        msg_colon,
        hashlib.sha256,
    ).hexdigest()
    
    # Tentar formato com ponto (JavaScript) se o primeiro falhar
    msg_dot = f"{data.school_slug}.{data.ts}".encode("utf-8")
    expected_dot = hmac.new(
        settings.embed_trust_secret.encode("utf-8"),
        msg_dot,
        hashlib.sha256,
    ).hexdigest()
    
    got = data.sig.strip().lower()
    
    # Validar em ambos os formatos
    valid_colon = len(got) == 64 and len(expected_colon) == 64 and hmac.compare_digest(expected_colon, got)
    valid_dot = len(got) == 64 and len(expected_dot) == 64 and hmac.compare_digest(expected_dot, got)
    
    if not (valid_colon or valid_dot):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Assinatura inválida.",
        )

    school = await repository.get_school_by_slug(db, data.school_slug)
    
    # ── Autoprovisionamento via Handshake ──────────────────
    # Se a escola não existe mas a assinatura é válida, o hospedeiro (KAITS) 
    # está autorizando a criação automática desta escola.
    if school is None and settings.mock_login_auto_provision_school:
        logger.info("Autoprovisionando escola via handshake: %s", data.school_slug)
        try:
            # Cria a escola com uma senha aleatória (já que o acesso será via handshake)
            school = await repository.create_school(
                db,
                School(
                    name=data.school_slug, # Usa o próprio slug como nome inicial
                    slug=data.school_slug,
                    password_hash=hash_password(secrets.token_urlsafe(16)),
                    is_active=True,
                ),
            )
            # Cria a configuração inicial
            await agent_config_repository.upsert_config(
                db, school.id, dict(_MOCK_PROVISION_DEFAULT_AGENT)
            )
        except Exception as e:
            logger.error("Falha ao autoprovisionar escola %s: %s", data.school_slug, e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao criar escola automaticamente.",
            )

    invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Escola inválida ou inativa.",
    )
    if school is None or not school.is_active:
        raise invalid

    token = create_access_token({"school_id": str(school.id), "slug": school.slug})
    await persist_login_session_after_token(db, school.id, token)

    # ── Integração Server-to-Server ─────────────────────────
    # Se o portal enviou um token de API, persistimos na config da escola
    if data.api_token:
        try:
            config = await agent_config_repository.get_config_by_school(db, school.id)
            if config:
                # Atualiza apenas o campo apiToken mantendo o resto
                updated_data = dict(config.data)
                updated_data["apiToken"] = data.api_token
                await agent_config_repository.upsert_config(db, school.id, updated_data)
                logger.info("Token de API da escola %s atualizado via handshake.", school.slug)
        except Exception as e:
            logger.warning("Erro ao persistir api_token da escola %s: %s", school.slug, e)

    return TokenOut(
        access_token=token,
        school=SchoolOut.model_validate(school),
        member=None,
    )


async def login_member(db: AsyncSession, body: MemberLoginRequest) -> TokenOut:
    """Login de utilizador da equipe (slug + e-mail + senha)."""
    invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="E-mail ou senha incorretos.",
    )
    school = await repository.get_school_by_slug(db, body.school_slug.strip())
    if school is None or not school.is_active:
        raise invalid

    email = _normalize_member_email(body.email)
    member = await repository.get_member_by_email(db, school.id, email)
    if member is None or not member.is_active:
        raise invalid
    if not verify_password(body.password, member.password_hash):
        raise invalid

    token = create_access_token(
        {
            "school_id": str(school.id),
            "slug": school.slug,
            "member_id": str(member.id),
        }
    )
    await persist_login_session_after_token(db, school.id, token)

    return TokenOut(
        access_token=token,
        school=SchoolOut.model_validate(school),
        member=MemberOut.model_validate(member),
    )


async def get_session_info(
    db: AsyncSession, school_id: uuid.UUID, member_id: uuid.UUID | None
) -> SessionOut:
    school = await repository.get_school_by_id(db, school_id)
    if school is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Escola não encontrada.")

    member_out: MemberOut | None = None
    if member_id is not None:
        m = await repository.get_member_by_id(db, member_id, school_id)
        if m:
            member_out = MemberOut.model_validate(m)

    return SessionOut(
        school=SchoolOut.model_validate(school),
        member=member_out,
        is_member_session=member_out is not None,
    )


async def create_school_member(
    db: AsyncSession, school_id: uuid.UUID, data: MemberCreate
) -> MemberOut:
    email = _normalize_member_email(data.email)
    if await repository.get_member_by_email(db, school_id, email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe um utilizador com este e-mail nesta escola.",
        )
    member = SchoolMember(
        school_id=school_id,
        email=email,
        display_name=(data.display_name or "").strip()[:120],
        password_hash=hash_password(data.password),
    )
    created = await repository.create_member(db, member)
    await notify_school_change(school_id, "team_updated", {})
    return MemberOut.model_validate(created)


async def list_school_members(db: AsyncSession, school_id: uuid.UUID) -> list[MemberOut]:
    rows = await repository.list_members_by_school(db, school_id)
    return [MemberOut.model_validate(r) for r in rows]


async def delete_school_member(
    db: AsyncSession, school_id: uuid.UUID, member_id: uuid.UUID
) -> None:
    m = await repository.get_member_by_id(db, member_id, school_id)
    if m is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membro não encontrado.")
    await repository.delete_member_row(db, m)
    await notify_school_change(school_id, "team_updated", {})


async def login_school(db: AsyncSession, credentials: LoginRequest) -> TokenOut:
    """
    Autentica uma escola com slug + senha e retorna um JWT.

    Fluxo:
        1. Busca escola pelo slug (normalizado: trim + minúsculas)
        2. Opcional (demo): slug novo → cria escola + AgentConfig (`MOCK_LOGIN_AUTO_PROVISION_SCHOOL`)
        3. Verifica se está ativa e senha
        4. Gera JWT com school_id no payload

    Raises:
        HTTPException 401: Slug não encontrado (sem mock), escola inativa ou senha errada.
        HTTPException 400: Slug/senha inválidos na primeira criação (modo mock).
    """
    invalid_credentials = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Slug ou senha incorretos.",
    )

    slug_norm = credentials.slug.strip().lower()
    school = await repository.get_school_by_slug(db, slug_norm)

    if school is None:
        if not settings.mock_login_auto_provision_school:
            raise invalid_credentials
        if len(slug_norm) < 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Slug deve ter pelo menos 3 caracteres.",
            )
        if len(slug_norm) > 60:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Slug muito longo (máx. 60).",
            )
        if _MOCK_SLUG_RE.fullmatch(slug_norm) is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Slug inválido: use só letras minúsculas, números e hífens "
                    "(ex.: escola-demo-01)."
                ),
            )
        if len(credentials.password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Na primeira entrada, a senha deve ter no mínimo 8 caracteres.",
            )
        school = await repository.create_school(
            db,
            School(
                name=f"Escola (simulação) {slug_norm}",
                slug=slug_norm,
                password_hash=hash_password(credentials.password),
                is_active=True,
            ),
        )
        await agent_config_repository.upsert_config(
            db, school.id, dict(_MOCK_PROVISION_DEFAULT_AGENT)
        )

    if not school.is_active:
        raise invalid_credentials

    if not verify_password(credentials.password, school.password_hash):
        raise invalid_credentials

    token = create_access_token({"school_id": str(school.id), "slug": school.slug})
    await persist_login_session_after_token(db, school.id, token)

    return TokenOut(
        access_token=token,
        school=SchoolOut.model_validate(school),
        member=None,
    )


# ── Criação de Escola ──────────────────────────────────────

async def create_school(db: AsyncSession, data: SchoolCreate) -> SchoolOut:
    """
    Cria uma nova escola no sistema.

    Verifica se o slug já existe antes de criar.

    Args:
        db: Sessão de banco.
        data: Dados validados do cadastro.

    Returns:
        SchoolOut com os dados da escola criada.

    Raises:
        HTTPException 409: Slug já cadastrado.
    """
    existing = await repository.get_school_by_slug(db, data.slug)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Slug '{data.slug}' já está em uso por outra escola.",
        )

    new_school = School(
        name=data.name,
        slug=data.slug,
        password_hash=hash_password(data.password),
    )

    created = await repository.create_school(db, new_school)
    return SchoolOut.model_validate(created)
