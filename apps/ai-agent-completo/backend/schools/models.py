"""
schools/models.py — Model SQLAlchemy para Escolas

Define a tabela `schools` no banco de dados.
Cada linha é um tenant (escola) com seus próprios dados isolados.

Relações:
  - School 1 → N AgentConfig (via agent_config/models.py)
  - School 1 → N Document    (via documents/models.py)
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class School(Base):
    """
    Representa uma escola (tenant) no sistema Smart Kaits.

    O `slug` é o identificador público e amigável da escola.
    Exemplo: "colegio-sao-joao", "escola-criativa-sp"
    """

    __tablename__ = "schools"

    # ── Chave Primária ─────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        comment="Identificador único da escola (UUID v4)",
    )

    # ── Dados da Escola ────────────────────────────────────
    name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
        comment="Nome completo da escola. Ex: Colégio São João",
    )

    slug: Mapped[str] = mapped_column(
        String(60),
        unique=True,
        nullable=False,
        index=True,
        comment="Identificador URL-friendly. Ex: colegio-sao-joao",
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Hash bcrypt da senha de acesso da escola",
    )

    # ── Status ─────────────────────────────────────────────
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        comment="False = escola desativada (não consegue logar)",
    )

    # ── WhatsApp (Evolution API) — instância 1:1 por escola ──
    evolution_instance_name: Mapped[str | None] = mapped_column(
        String(80),
        nullable=True,
        comment="Nome da instância na Evolution (ex.: sk_<uuid_hex>).",
    )
    evolution_instance_token: Mapped[str | None] = mapped_column(
        String(512),
        nullable=True,
        comment="API key da instância retornada pela Evolution no create (opcional se usar só API global).",
    )

    # ── Timestamps ─────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        comment="Data/hora de criação no banco",
    )

    # ── Relacionamentos ────────────────────────────────────
    # Importações inline evitam circular imports com outros models.
    agent_configs: Mapped[list["AgentConfig"]] = relationship(  # noqa: F821
        "AgentConfig",
        back_populates="school",
        cascade="all, delete-orphan",
    )

    documents: Mapped[list["Document"]] = relationship(  # noqa: F821
        "Document",
        back_populates="school",
        cascade="all, delete-orphan",
    )

    members: Mapped[list["SchoolMember"]] = relationship(  # noqa: F821
        "SchoolMember",
        back_populates="school",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<School id={self.id} slug='{self.slug}'>"


class SchoolMember(Base):
    """
    Utilizador humano ligado a uma escola (tenant).
    Autenticação: slug da escola + e-mail + senha própria — mesmo isolamento de dados (school_id no JWT).
    """

    __tablename__ = "school_members"
    __table_args__ = (UniqueConstraint("school_id", "email", name="uq_school_members_school_email"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    school: Mapped["School"] = relationship("School", back_populates="members")

    def __repr__(self) -> str:
        return f"<SchoolMember id={self.id} email={self.email!r}>"


class LoginSession(Base):
    """
    Sessão de login ativa (correlacionada ao claim `jti` do JWT).

    Opcional: habilite com AUTH_STORE_SESSIONS_IN_DB=true e rode o SQL
    `backend/sql/001_login_sessions.sql`. O cliente continua enviando o JWT
    (ex.: localStorage); o banco permite revogar sessão sem invalidar todos os tokens.
    """

    __tablename__ = "login_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    jti: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
        comment="JWT ID — mesmo valor do claim jti",
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
