"""
documents/repository.py — Queries de banco para Documents
"""

import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from documents.models import Document


async def list_by_school(db: AsyncSession, school_id: uuid.UUID) -> list[Document]:
    result = await db.execute(
        select(Document).where(Document.school_id == school_id).order_by(Document.created_at.desc())
    )
    return list(result.scalars().all())


async def get_by_id(db: AsyncSession, doc_id: uuid.UUID, school_id: uuid.UUID) -> Document | None:
    result = await db.execute(
        select(Document).where(Document.id == doc_id, Document.school_id == school_id)
    )
    return result.scalar_one_or_none()


async def create_document(db: AsyncSession, document: Document) -> Document:
    db.add(document)
    await db.flush()
    await db.refresh(document)
    return document


async def delete_document(db: AsyncSession, document: Document) -> None:
    await db.delete(document)
    await db.flush()
