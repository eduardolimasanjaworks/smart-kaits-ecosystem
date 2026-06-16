"""
documents/schemas.py — Schemas Pydantic para Documents
"""

import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class DocumentOut(BaseModel):
    """Dados de um documento retornados pela API."""
    id: uuid.UUID
    display_name: str
    file_name: str
    extension: str
    size_display: str
    created_at: datetime
    model_config = {"from_attributes": True}


class DocumentRename(BaseModel):
    """Payload para renomear um documento."""
    display_name: str = Field(min_length=1, max_length=255)
