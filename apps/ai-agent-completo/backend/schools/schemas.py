"""
schools/schemas.py — Schemas Pydantic para o domínio Schools

Define as estruturas de entrada e saída dos endpoints de escola.

Convenção de nomenclatura:
  - *Create  → dados necessários para criar um recurso (POST body)
  - *Out     → dados retornados pela API (response model)
  - *Request → dados de requisições específicas (ex: login)
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ── Entrada ────────────────────────────────────────────────

class SchoolCreate(BaseModel):
    """
    Dados necessários para cadastrar uma nova escola.
    Usado no endpoint POST /schools.
    """
    name: str = Field(
        min_length=3,
        max_length=120,
        description="Nome completo da escola.",
        examples=["Colégio São João"],
    )
    slug: str = Field(
        min_length=3,
        max_length=60,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
        description="Identificador URL-friendly. Apenas letras minúsculas, números e hífens.",
        examples=["colegio-sao-joao"],
    )
    password: str = Field(
        min_length=8,
        description="Senha de acesso da escola. Será armazenada como hash.",
    )


class EmbedHandshakeRequest(BaseModel):
    """
    Troca assinada por HMAC — o portal calcula sig sem enviar senha da escola ao browser.
    Mensagem assinada: f"{school_slug}.{ts}" (ts em segundos Unix UTC).
    Pode incluir o token da API da escola para persistência segura server-to-server.
    """

    school_slug: str = Field(description="Slug da escola no Smart Kaits.")
    ts: int = Field(description="Unix timestamp em segundos no momento da assinatura.")
    sig: str = Field(description="HMAC-SHA256 em hex da mensagem school_slug.ts")
    api_token: str | None = Field(
        default=None,
        description="Opcional: Token de acesso à API da escola para integração server-side."
    )


class LoginRequest(BaseModel):
    """
    Credenciais para autenticação de uma escola.
    Usado no endpoint POST /auth/login.
    """
    slug: str = Field(
        description="Slug único da escola.",
        examples=["colegio-sao-joao"],
    )
    password: str = Field(
        description="Senha configurada no cadastro.",
    )


class MemberLoginRequest(BaseModel):
    """Login de um utilizador da equipe: mesma escola (slug) + e-mail + senha do membro."""

    school_slug: str = Field(description="Slug da escola no Smart Kaits.")
    email: str = Field(description="E-mail cadastrado pela escola.")
    password: str = Field(description="Senha do membro.")


class MemberCreate(BaseModel):
    """Criação de membro pelo acesso principal da escola."""

    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(default="", max_length=120)


# ── Saída ──────────────────────────────────────────────────

class SchoolOut(BaseModel):
    """
    Dados públicos de uma escola retornados pela API.
    Nunca inclui password_hash.
    """
    id: uuid.UUID
    name: str
    slug: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}  # Permite criar de model SQLAlchemy


class MemberOut(BaseModel):
    """Membro da equipe (sem segredo)."""

    id: uuid.UUID
    email: str
    display_name: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenOut(BaseModel):
    """
    Resposta do endpoint de login com o token JWT.
    """
    access_token: str = Field(description="Token JWT para usar no header Authorization.")
    token_type: str = Field(default="bearer")
    school: SchoolOut = Field(description="Dados básicos da escola autenticada.")
    member: MemberOut | None = Field(
        default=None,
        description="Preenchido quando o login é de um membro da equipe.",
    )


class SessionOut(BaseModel):
    """Estado da sessão atual (sem expor claims sensíveis)."""

    school: SchoolOut
    member: MemberOut | None = None
    is_member_session: bool = False
