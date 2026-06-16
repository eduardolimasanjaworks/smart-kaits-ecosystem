"""
Cria duas escolas para o portal mock (smartkaits.techfala.com.br):
  slug login1 + senha senha123
  slug login2 + senha senha123

Uso (com DATABASE_URL no ambiente):
  cd backend && python seed_mock_kaits_login_schools.py
  # ou: docker exec -it ai-agent-backend python seed_mock_kaits_login_schools.py
"""
from __future__ import annotations

import asyncio
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from core.config import settings
from schools.models import School
from agent_config.models import AgentConfig
from documents.models import Document  # noqa: F401 — mappers

DEFAULT_AGENT = {
    "assistantName": "Assistente",
    "personality": "Objetiva e cordial.",
    "greeting": "Olá! Como posso ajudar?",
    "isPaused": False,
    "scriptRules": [],
    "teamMembers": [],
    "faqItems": [],
    "docs": [],
    "fallbackContact": "",
    "fallbackMessage": "Encaminhando para humano.",
    "fallbackUserMessage": "Vou te conectar com um atendente.",
    "apiToken": "",
    "tools": {
        "consultClasses": False,
        "checkSchedule": False,
        "enrollStudent": False,
        "checkFinancial": False,
    },
}

SCHOOLS = [
    ("login1", "Escola Mock Login 1"),
    ("login2", "Escola Mock Login 2"),
]
PASSWORD = "senha123"


async def _ensure_school(session: AsyncSession, slug: str, name: str) -> uuid.UUID:
    r = await session.execute(select(School).where(School.slug == slug))
    existing = r.scalar_one_or_none()
    hashed = bcrypt.hashpw(PASSWORD.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    if existing:
        existing.password_hash = hashed
        existing.is_active = True
        await session.flush()
        sid = existing.id
        r2 = await session.execute(select(AgentConfig).where(AgentConfig.school_id == sid))
        if r2.scalar_one_or_none() is None:
            session.add(AgentConfig(school_id=sid, data=dict(DEFAULT_AGENT)))
        print(f"ℹ️  Atualizada senha da escola existente: {slug} ({sid})")
    else:
        sid = uuid.uuid4()
        session.add(
            School(
                id=sid,
                name=name,
                slug=slug,
                password_hash=hashed,
                is_active=True,
            )
        )
        session.add(AgentConfig(school_id=sid, data=dict(DEFAULT_AGENT)))
        await session.flush()
        print(f"✅ Criada escola {slug} ({sid})")
    return sid


async def main() -> None:
    engine = create_async_engine(settings.database_url)
    factory = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        for slug, name in SCHOOLS:
            await _ensure_school(session, slug, name)
        await session.commit()
    await engine.dispose()
    print("\nLogin no portal mock: Login1 ou Login2 | senha: senha123")
    print("API Smart Kaits: POST /api/v1/auth/login body { slug: login1|login2, password: senha123 }")


if __name__ == "__main__":
    asyncio.run(main())
