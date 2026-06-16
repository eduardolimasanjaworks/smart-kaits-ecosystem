"""
documents/router.py — Endpoints HTTP para Documents
"""

import uuid
from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import get_current_school_id
from documents import service
from documents.schemas import DocumentOut, DocumentRename

router = APIRouter(tags=["Documentos"], prefix="/me")


@router.get("/documents", response_model=list[DocumentOut])
async def list_docs(
    school_id: uuid.UUID = Depends(get_current_school_id),
    db: AsyncSession = Depends(get_db),
):
    """Lista todos os documentos da escola autenticada."""
    return await service.list_documents(db, school_id)


@router.post("/documents", response_model=list[DocumentOut], status_code=201)
async def upload_docs(
    files: list[UploadFile] = File(...),
    school_id: uuid.UUID = Depends(get_current_school_id),
    db: AsyncSession = Depends(get_db),
):
    """Faz upload de um ou mais documentos. Aceita: PDF, DOCX, TXT."""
    return await service.upload_documents(db, school_id, files)


@router.patch("/documents/{doc_id}", response_model=DocumentOut)
async def rename_doc(
    doc_id: uuid.UUID,
    body: DocumentRename,
    school_id: uuid.UUID = Depends(get_current_school_id),
    db: AsyncSession = Depends(get_db),
):
    """Renomeia o nome de exibição de um documento."""
    return await service.rename_document(db, doc_id, school_id, body.display_name)


@router.delete("/documents/{doc_id}", status_code=204)
async def delete_doc(
    doc_id: uuid.UUID,
    school_id: uuid.UUID = Depends(get_current_school_id),
    db: AsyncSession = Depends(get_db),
):
    """Remove um documento do disco e do banco."""
    await service.delete_document(db, doc_id, school_id)
from pydantic import BaseModel

class DocumentContentUpdate(BaseModel):
    text: str

@router.get("/documents/{doc_id}/full-text")
async def get_doc_full_text(
    doc_id: uuid.UUID,
    school_id: uuid.UUID = Depends(get_current_school_id),
    db: AsyncSession = Depends(get_db),
):
    """Retorna o texto completo do documento organizado por páginas e linhas."""
    return await service.get_document_full_text(db, doc_id, school_id)

@router.put("/documents/{doc_id}/content")
async def update_doc_content(
    doc_id: uuid.UUID,
    body: DocumentContentUpdate,
    school_id: uuid.UUID = Depends(get_current_school_id),
    db: AsyncSession = Depends(get_db),
):
    """Atualiza o conteúdo de texto extraído e re-indexa os chunks."""
    await service.update_manual_content(db, school_id, doc_id, body.text)
    return {"status": "indexed"}
