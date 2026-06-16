"""
agent_config/models.py — Model SQLAlchemy para AgentConfig

Uma escola tem no máximo UMA configuração ativa (relação 1:1).
Toda a configuração é armazenada como JSONB para flexibilidade.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class AgentConfig(Base):
    """
    Configuração do agente de I.A. de uma escola.

    O campo `data` é um JSONB livre — quando o schema estabilizar,
    podemos normalizar as colunas (ver ARCHITECTURE.md ADR-002).
    """

    __tablename__ = "agent_configs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # FK para a escola dona desta config (unique = 1:1)
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    # Toda a configuração da I.A. em JSON — ver README para schema esperado
    data: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict,
        comment="JSON livre com toda a configuração do agente"
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relacionamento reverso
    school: Mapped["School"] = relationship("School", back_populates="agent_configs")  # noqa: F821

    def __repr__(self) -> str:
        return f"<AgentConfig school_id={self.school_id}>"
