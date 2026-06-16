"""
core/models.py — Modelos globais e transversais do sistema.
"""

import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, func, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from core.database import Base

class AuditLog(Base):
    """
    Registra todas as ações significativas realizadas pelos usuários ou pela I.A.
    """
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    
    action: Mapped[str] = mapped_column(String(50))    # ex: "config_update", "doc_upload", "handover"
    target: Mapped[str] = mapped_column(String(100))   # ex: "Personalidade", "PDF Aula 1", "Eduardo"
    detail: Mapped[str] = mapped_column(String(255))   # Detalhe humano: "Alterou o nome da assistente para Sofia"
    
    # Metadados técnicos caso precise auditar o JSON do patch
    meta_data: Mapped[dict] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self) -> str:
        return f"<AuditLog action={self.action} target={self.target}>"
