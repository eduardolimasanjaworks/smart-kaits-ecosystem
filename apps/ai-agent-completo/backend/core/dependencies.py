"""
core/dependencies.py — FastAPI Depends reutilizáveis

Centraliza os Depends compartilhados entre routers.

Principais:
  - get_db           → Sessão de banco (ver database.py)
  - get_current_school_id → Extrai e valida a escola autenticada do JWT
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from core.security import decode_access_token
from schools import repository

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer()


async def _school_id_and_payload_from_bearer(
    credentials: HTTPAuthorizationCredentials,
    db: AsyncSession,
) -> tuple[UUID, dict]:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido ou expirado. Faça login novamente.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        school_id_str: str | None = payload.get("school_id")

        if school_id_str is None:
            raise credentials_exception

        if settings.auth_store_sessions_in_db:
            jti = payload.get("jti")
            if not isinstance(jti, str):
                raise credentials_exception
            sess = await repository.get_login_session_by_jti(db, jti)
            if sess is None:
                raise credentials_exception
            now = datetime.now(timezone.utc)
            exp_row = sess.expires_at
            if exp_row.tzinfo is None:
                exp_row = exp_row.replace(tzinfo=timezone.utc)
            if exp_row < now:
                raise credentials_exception
            if str(sess.school_id) != school_id_str:
                raise credentials_exception

        return UUID(school_id_str), payload

    except JWTError:
        if settings.environment.lower() != "production":
            logger.debug("JWT inválido ou expirado")
        raise credentials_exception
    except HTTPException:
        raise
    except Exception:
        logger.exception("Erro ao validar token")
        raise credentials_exception


async def get_current_school_id(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> UUID:
    """
    Extrai o `school_id` do token JWT.

    Utilizado como Depends em qualquer endpoint que exige autenticação.
    """
    school_id, _ = await _school_id_and_payload_from_bearer(credentials, db)
    return school_id


async def get_current_principal_school_id(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> UUID:
    """
    Como `get_current_school_id`, mas rejeita tokens emitidos para um **membro**
    (fluxo equipe). Usado para criar/remover utilizadores da escola.
    """
    school_id, payload = await _school_id_and_payload_from_bearer(credentials, db)
    if payload.get("member_id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta ação só está disponível para o acesso principal da escola (administrador).",
        )
    return school_id


async def get_optional_member_id_from_token(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> UUID | None:
    """`member_id` do JWT ou None se for sessão só da escola (slug/senha ou embed)."""
    _, payload = await _school_id_and_payload_from_bearer(credentials, db)
    mid = payload.get("member_id")
    if isinstance(mid, str):
        try:
            return UUID(mid)
        except ValueError:
            return None
    return None


async def get_school_and_payload(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> tuple[UUID, dict]:
    """Uma única validação JWT + sessão — usar em `/auth/session` para não duplicar trabalho."""
    return await _school_id_and_payload_from_bearer(credentials, db)


__all__ = [
    "get_db",
    "get_current_school_id",
    "get_current_principal_school_id",
    "get_optional_member_id_from_token",
    "get_school_and_payload",
    "bearer_scheme",
]
