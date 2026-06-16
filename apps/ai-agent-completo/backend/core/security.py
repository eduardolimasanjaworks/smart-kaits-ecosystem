"""
core/security.py — Utilitários de autenticação e segurança

Responsabilidades:
  - Hash e verificação de senhas (bcrypt via passlib)
  - Criação e decodificação de tokens JWT

NÃO importa nada de domínios (schools/, etc.).
NÃO acessa o banco de dados — apenas operações criptográficas puras.
"""

import uuid

import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Any
from jose import JWTError, jwt
from core.config import settings

# ── Senhas ─────────────────────────────────────────────────

def hash_password(plain_password: str) -> str:
    """
    Gera um hash bcrypt da senha fornecida.
    """
    # Truncate to 72 bytes (bcrypt limit)
    pw_bytes = plain_password.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pw_bytes, salt).decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifica se uma senha em texto puro corresponde ao hash armazenado.
    """
    try:
        pw_bytes = plain_password.encode('utf-8')[:72]
        hash_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(pw_bytes, hash_bytes)
    except Exception:
        return False


# ── JWT ────────────────────────────────────────────────────

def create_access_token(payload: dict[str, Any]) -> str:
    """
    Cria um token JWT assinado com os dados fornecidos.

    Inclui `exp` (expiração) conforme `settings.jwt_expire_minutes` e `jti`
    (JWT ID, UUID) para correlação com a tabela `login_sessions` quando
    `AUTH_STORE_SESSIONS_IN_DB=true`.
    """
    data = payload.copy()
    data.setdefault("jti", str(uuid.uuid4()))
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    data["exp"] = expire

    return jwt.encode(data, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    """
    Decodifica e valida um token JWT.

    Args:
        token: Token JWT em formato string.

    Returns:
        Dicionário com os dados do payload do token.

    Raises:
        JWTError: Se o token for inválido, expirado ou adulterado.

    Nota:
        O chamador (dependency) deve capturar JWTError e retornar 401.
    """
    return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
