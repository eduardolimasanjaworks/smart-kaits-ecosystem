"""
documents/service.py — Regras de negócio para Documents
"""

import logging
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from documents import repository
from documents.models import Document
from documents.schemas import DocumentOut
from realtime.broadcast import notify_school_change

logger = logging.getLogger(__name__)

# Tipos de arquivo aceitos
ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".txt"}


async def list_documents(db: AsyncSession, school_id: uuid.UUID) -> list[DocumentOut]:
    docs = await repository.list_by_school(db, school_id)
    return [DocumentOut.model_validate(d) for d in docs]


async def upload_documents(
    db: AsyncSession,
    school_id: uuid.UUID,
    files: list[UploadFile],
) -> list[DocumentOut]:
    """
    Processa e salva múltiplos arquivos.
    Valida extensão e tamanho antes de persistir.
    """
    results = []
    upload_dir = Path(settings.upload_dir) / str(school_id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    for file in files:
        # Valida extensão
        suffix = Path(file.filename or "").suffix.lower()
        if suffix not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"Tipo '{suffix}' não suportado. Use: {', '.join(ALLOWED_EXTENSIONS)}",
            )

        # Lê conteúdo e valida tamanho
        content = await file.read()
        if len(content) > settings.max_upload_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Arquivo '{file.filename}' excede {settings.max_upload_mb}MB.",
            )

        # Salva no disco
        safe_name = f"{uuid.uuid4()}{suffix}"
        file_path = upload_dir / safe_name
        file_path.write_bytes(content)

        # Persiste metadados no banco
        doc = Document(
            school_id=school_id,
            display_name=file.filename or safe_name,
            file_name=file.filename or safe_name,
            extension=suffix.lstrip(".").upper(),
            size_bytes=len(content),
            file_path=str(file_path),
        )
        created = await repository.create_document(db, doc)
        
        # ── Trigger AI Pipeline (RAG) ──────────────────────────
        from ai.chunker import chunk_document
        from ai.indexer import index_chunks
        
        try:
            # Extrai e quebra em chunks semânticos com metadados
            chunks = await chunk_document(
                file_path=str(file_path),
                extension=suffix.lstrip("."),
                doc_id=str(created.id),
                doc_name=created.display_name,
                school_id=str(school_id)
            )
            
            # Indexa no Qdrant
            await index_chunks(chunks)
        except Exception as e:
            logger.warning("Erro ao indexar %s: %s", file.filename, e, exc_info=True)

        results.append(DocumentOut.model_validate(created))

    await notify_school_change(school_id, "documents_updated", {})
    return results


async def delete_document(db: AsyncSession, doc_id: uuid.UUID, school_id: uuid.UUID) -> None:
    doc = await repository.get_by_id(db, doc_id, school_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Documento não encontrado.")
    # Remove arquivo do disco
    Path(doc.file_path).unlink(missing_ok=True)
    
    # Remove chunks do Qdrant
    from ai.indexer import clear_school_chunks
    try:
        await clear_school_chunks(str(school_id), doc_ids=[str(doc_id)])
    except Exception as e:
        logger.warning("Erro ao remover chunks de %s: %s", doc_id, e, exc_info=True)

    await repository.delete_document(db, doc)
    await notify_school_change(school_id, "documents_updated", {})


async def rename_document(
    db: AsyncSession, doc_id: uuid.UUID, school_id: uuid.UUID, new_name: str
) -> DocumentOut:
    doc = await repository.get_by_id(db, doc_id, school_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Documento não encontrado.")
    doc.display_name = new_name  # type: ignore[assignment]
    await db.flush()
    await db.refresh(doc)
    await notify_school_change(school_id, "documents_updated", {})
    return DocumentOut.model_validate(doc)
async def get_document_full_text(db: AsyncSession, doc_id: uuid.UUID, school_id: uuid.UUID) -> dict:
    doc = await repository.get_by_id(db, doc_id, school_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Documento não encontrado.")
    
    from ai.chunker import extract_pages
    pages = extract_pages(doc.file_path, doc.extension)
    return {"id": doc.id, "name": doc.display_name, "pages": pages}

async def update_manual_content(
    db: AsyncSession,
    school_id: uuid.UUID,
    doc_id: uuid.UUID,
    new_text: str
) -> None:
    """
    Atualiza o conteúdo indexado de um documento manualmente.
    """
    doc = await repository.get_by_id(db, doc_id, school_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Documento não encontrado.")

    # ── Re-index Pipeline ───────────────────────────────────
    from ai.chunker import chunk_raw_text
    from ai.indexer import index_chunks, clear_school_chunks
    
    try:
        # 1. Limpa chunks antigos deste documento
        await clear_school_chunks(str(school_id), doc_ids=[str(doc_id)])
        
        # 2. Gera novos chunks a partir do texto manual
        chunks = await chunk_raw_text(
            text=new_text,
            doc_id=str(doc_id),
            doc_name=doc.display_name,
            school_id=str(school_id)
        )
        
        # 3. Indexa novamente
        await index_chunks(chunks)
        
    except Exception as e:
        logger.warning("Erro ao re-indexar conteúdo manual de %s: %s", doc_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail="Erro ao sincronizar com banco de busca.")

    await notify_school_change(school_id, "documents_updated", {})
