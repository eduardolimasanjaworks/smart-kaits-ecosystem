"""
documents/models.py — Model SQLAlchemy para Documents
"""

import uuid
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base


class Document(Base):
    """
    Metadados de um documento de treinamento da I.A.
    O arquivo físico fica em uploads/{school_id}/{file_path}.
    """

    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Nome amigável exibido na UI (editável pelo usuário)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Nome original do arquivo no disco
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Extensão uppercase: PDF, DOCX, TXT
    extension: Mapped[str] = mapped_column(String(10), nullable=False)

    # Tamanho em bytes
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)

    # Caminho relativo dentro de uploads/
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    school: Mapped["School"] = relationship("School", back_populates="documents")  # noqa: F821

    @property
    def size_display(self) -> str:
        """Retorna tamanho legível: '1.2 MB', '345 KB'."""
        kb = self.size_bytes / 1024
        if kb > 1024:
            return f"{kb/1024:.1f} MB"
        return f"{kb:.0f} KB"

    def __repr__(self) -> str:
        return f"<Document '{self.display_name}' school={self.school_id}>"
