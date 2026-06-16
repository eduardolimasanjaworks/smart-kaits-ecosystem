"""
schools/repository.py — Queries de banco para o domínio Schools

Responsabilidade única: executar SQL via SQLAlchemy.
NÃO contém lógica de negócio.
NÃO lida com HTTP.

Todas as funções recebem uma `AsyncSession` e retornam objetos do model.
"""

import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from datetime import datetime

from schools.models import LoginSession, School, SchoolMember


# ── Buscar ─────────────────────────────────────────────────

async def get_school_by_id(db: AsyncSession, school_id: uuid.UUID) -> School | None:
    """
    Busca uma escola pelo seu UUID.

    Args:
        db: Sessão assíncrona do banco.
        school_id: UUID da escola.

    Returns:
        Objeto School ou None se não encontrado.
    """
    result = await db.execute(
        select(School).where(School.id == school_id)
    )
    return result.scalar_one_or_none()


async def get_school_by_slug(db: AsyncSession, slug: str) -> School | None:
    """
    Busca uma escola pelo slug único.
    Usado no login para validar as credenciais.

    Args:
        db: Sessão assíncrona do banco.
        slug: Slug da escola (ex: "colegio-alfa").

    Returns:
        Objeto School ou None se não encontrado.
    """
    result = await db.execute(
        select(School).where(School.slug == slug)
    )
    return result.scalar_one_or_none()


async def get_all_schools(db: AsyncSession) -> list[School]:
    """
    Retorna todas as escolas cadastradas.
    Usado apenas pelo painel administrativo interno.

    Args:
        db: Sessão assíncrona do banco.

    Returns:
        Lista de objetos School.
    """
    result = await db.execute(select(School).order_by(School.created_at.desc()))
    return list(result.scalars().all())


# ── Criar ──────────────────────────────────────────────────

async def create_login_session(
    db: AsyncSession,
    *,
    school_id: uuid.UUID,
    jti: str,
    expires_at: datetime,
) -> LoginSession:
    row = LoginSession(school_id=school_id, jti=jti, expires_at=expires_at)
    db.add(row)
    await db.flush()
    await db.refresh(row)
    return row


async def get_login_session_by_jti(db: AsyncSession, jti: str) -> LoginSession | None:
    result = await db.execute(select(LoginSession).where(LoginSession.jti == jti))
    return result.scalar_one_or_none()


async def delete_login_session_by_jti(db: AsyncSession, jti: str) -> None:
    await db.execute(delete(LoginSession).where(LoginSession.jti == jti))


async def get_member_by_email(
    db: AsyncSession, school_id: uuid.UUID, email_normalized: str
) -> SchoolMember | None:
    result = await db.execute(
        select(SchoolMember).where(
            SchoolMember.school_id == school_id,
            SchoolMember.email == email_normalized,
        )
    )
    return result.scalar_one_or_none()


async def get_member_by_id(
    db: AsyncSession, member_id: uuid.UUID, school_id: uuid.UUID
) -> SchoolMember | None:
    result = await db.execute(
        select(SchoolMember).where(
            SchoolMember.id == member_id,
            SchoolMember.school_id == school_id,
        )
    )
    return result.scalar_one_or_none()


async def list_members_by_school(db: AsyncSession, school_id: uuid.UUID) -> list[SchoolMember]:
    result = await db.execute(
        select(SchoolMember)
        .where(SchoolMember.school_id == school_id)
        .order_by(SchoolMember.created_at.asc())
    )
    return list(result.scalars().all())


async def create_member(db: AsyncSession, member: SchoolMember) -> SchoolMember:
    db.add(member)
    await db.flush()
    await db.refresh(member)
    return member


async def delete_member_row(db: AsyncSession, member: SchoolMember) -> None:
    await db.delete(member)
    await db.flush()


async def create_school(db: AsyncSession, school: School) -> School:
    """
    Persiste uma nova escola no banco.

    O objeto School deve ser construído no service antes de chamar esta função.

    Args:
        db: Sessão assíncrona do banco.
        school: Objeto School já populado (com password_hash).

    Returns:
        Objeto School com id e created_at preenchidos pelo banco.
    """
    db.add(school)
    await db.flush()       # Garante que o ID seja gerado antes do commit
    await db.refresh(school)
    return school
