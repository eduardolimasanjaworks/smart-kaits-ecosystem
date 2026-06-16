"""
schools/router.py — Endpoints HTTP para o domínio Schools

Rotas:
  POST /api/v1/auth/login     → Login da escola
  POST /api/v1/schools        → Criar escola (use com cuidado em prod)
  GET  /api/v1/schools/me     → Dados da escola autenticada
"""

import logging

from fastapi import APIRouter, Depends, Response
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import (
    bearer_scheme,
    get_current_principal_school_id,
    get_current_school_id,
    get_school_and_payload,
)
from schools import service
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
import uuid

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Escolas"])


@router.post("/auth/member-login", response_model=TokenOut, summary="Login membro da equipe")
async def member_login(body: MemberLoginRequest, db: AsyncSession = Depends(get_db)):
    """Slug da escola + e-mail + senha do membro — mesmo isolamento de dados por escola."""
    return await service.login_member(db, body)


@router.get("/auth/session", response_model=SessionOut, summary="Sessão atual (escola / membro)")
async def auth_session(
    auth: tuple[uuid.UUID, dict] = Depends(get_school_and_payload),
    db: AsyncSession = Depends(get_db),
):
    school_id, payload = auth
    member_uuid: uuid.UUID | None = None
    raw_mid = payload.get("member_id")
    if isinstance(raw_mid, str):
        try:
            member_uuid = uuid.UUID(raw_mid)
        except ValueError:
            member_uuid = None
    return await service.get_session_info(db, school_id, member_uuid)


@router.post("/auth/login", response_model=TokenOut, summary="Autenticar escola")
async def login(credentials: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Autentica uma escola com slug + senha.
    Retorna um JWT Bearer para uso nos demais endpoints.
    """
    return await service.login_school(db, credentials)


@router.post(
    "/auth/embed-handshake",
    response_model=TokenOut,
    summary="Token para iframe (HMAC, sem senha no browser)",
)
async def embed_handshake(
    body: EmbedHandshakeRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Destinado ao **servidor do portal** que embute o Smart Kaits: assina
    ``school_slug`` + ``ts`` com ``EMBED_TRUST_SECRET`` e envia este POST.
    O browser do utilizador **não** precisa da senha da escola nem de segundo login
    no Smart Kaits — só recebe o JWT (ex.: via ``#access_token=`` ou postMessage).
    """
    return await service.embed_handshake_school(db, body)


@router.post("/auth/logout", status_code=204, summary="Encerrar sessão atual")
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    """
    Remove a linha em `login_sessions` (quando AUTH_STORE_SESSIONS_IN_DB=true).
    O cliente deve apagar o JWT localmente após esta chamada.
    """
    await service.revoke_login_session_by_token(db, credentials.credentials)
    return Response(status_code=204)


@router.post("/schools", response_model=SchoolOut, status_code=201, summary="Criar escola")
async def create_school(data: SchoolCreate, db: AsyncSession = Depends(get_db)):
    """
    Cria uma nova escola no sistema.
    ⚠️  Proteger com senha de admin em produção.
    """
    return await service.create_school(db, data)


@router.get("/schools/me", response_model=SchoolOut, summary="Minha escola")
async def get_my_school(
    school_id: uuid.UUID = Depends(get_current_school_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Retorna os dados da escola autenticada pelo token JWT.
    """
    from schools.repository import get_school_by_id
    from fastapi import HTTPException, status
    school = await get_school_by_id(db, school_id)
    if not school:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Escola não encontrada.")
    return school


@router.get("/schools/members", response_model=list[MemberOut], summary="Listar membros da equipe")
async def list_members_endpoint(
    school_id: uuid.UUID = Depends(get_current_school_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await service.list_school_members(db, school_id)
    except SQLAlchemyError:
        logger.exception(
            "GET /schools/members: falha de BD (tabela em migração ou indisponível). Retornando lista vazia."
        )
        return []


@router.post(
    "/schools/members",
    response_model=MemberOut,
    status_code=201,
    summary="Convidar membro (apenas acesso principal)",
)
async def create_member_endpoint(
    body: MemberCreate,
    school_id: uuid.UUID = Depends(get_current_principal_school_id),
    db: AsyncSession = Depends(get_db),
):
    return await service.create_school_member(db, school_id, body)


@router.delete(
    "/schools/members/{member_id}",
    status_code=204,
    summary="Remover membro (apenas acesso principal)",
)
async def delete_member_endpoint(
    member_id: uuid.UUID,
    school_id: uuid.UUID = Depends(get_current_principal_school_id),
    db: AsyncSession = Depends(get_db),
):
    await service.delete_school_member(db, school_id, member_id)
