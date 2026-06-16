"""Garante variáveis mínimas e mapeadores SQLAlchemy antes dos testes."""

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from core.security import create_access_token
from main import app

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://test:test@127.0.0.1:5432/smartkaits_test",
)
os.environ.setdefault("SECRET_KEY", "pytest-secret-key-32bytes-min!!")


def pytest_configure(config):
    """Resolve forward refs (School ↔ AgentConfig, etc.)."""
    import agent_config.models  # noqa: F401
    import documents.models  # noqa: F401
    import whatsapp_chat.models  # noqa: F401


@pytest.fixture
def api_client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def school_a_id() -> uuid.UUID:
    return uuid.uuid4()


@pytest.fixture
def school_b_id() -> uuid.UUID:
    return uuid.uuid4()


@pytest.fixture
def auth_headers_school_a(school_a_id: uuid.UUID) -> dict[str, str]:
    tok = create_access_token({"school_id": str(school_a_id), "slug": "escola-a"})
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture
def auth_headers_school_b(school_b_id: uuid.UUID) -> dict[str, str]:
    tok = create_access_token({"school_id": str(school_b_id), "slug": "escola-b"})
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture
def auth_headers_member(school_a_id: uuid.UUID) -> dict[str, str]:
    tok = create_access_token(
        {
            "school_id": str(school_a_id),
            "slug": "escola-a",
            "member_id": str(uuid.uuid4()),
        }
    )
    return {"Authorization": f"Bearer {tok}"}
