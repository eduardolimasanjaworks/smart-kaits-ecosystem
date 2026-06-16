"""
seed_demo.py — Cria a escola demo diretamente no banco
Evita uso de passlib (bug de compatibilidade com bcrypt).
"""
import asyncio
import uuid
import sys

sys.path.insert(0, "/app")

import bcrypt
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from core.config import settings
from core.security import create_access_token
from schools.service import persist_login_session_after_token

# Importa todos os models para o SQLAlchemy registrar os mapeamentos
from schools.models import LoginSession, School  # noqa: F401 — LoginSession registra mapper
from agent_config.models import AgentConfig
from documents.models import Document  # noqa: necessário para o mapper School


SLUG = "demo"
NAME = "Escola Kaits Demo"
PASSWORD = "demo12345"  # min 8 chars


async def seed():
    engine = create_async_engine(settings.database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # Hash com bcrypt direto (sem passlib)
    hashed = bcrypt.hashpw(PASSWORD.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    async with async_session() as session:
        # Verifica se já existe
        stmt = select(School).where(School.slug == SLUG)
        result = await session.execute(stmt)
        school = result.scalar_one_or_none()

        if not school:
            school_id = uuid.uuid4()
            school = School(
                id=school_id,
                name=NAME,
                slug=SLUG,
                password_hash=hashed,
                is_active=True,
            )
            session.add(school)

            # Config padrão do agente
            config = AgentConfig(
                school_id=school_id,
                data={
                    "assistantName": "Kaits",
                    "personality": "Educada, prestativa e objetiva. Usa emojis com moderação.",
                    "greeting": "Olá! Sou a Kaits, assistente virtual. Como posso ajudar? 😊",
                    "isPaused": False,
                    "scriptRules": [],
                    "teamMembers": [],
                    "faqItems": [],
                    "docs": [],
                    "fallbackContact": "",
                    "fallbackMessage": "Um aluno precisa de atenção!",
                    "fallbackUserMessage": "Vou te conectar com um atendente humano agora.",
                    "apiToken": "",
                    "tools": {
                        "consultClasses": False,
                        "checkSchedule": False,
                        "enrollStudent": False,
                        "checkFinancial": False,
                    },
                },
            )
            session.add(config)
            await session.commit()
            print(f"✅ Escola criada: {school_id}")
        else:
            school_id = school.id
            print(f"ℹ️  Escola já existia: {school_id}")

    token = create_access_token({"school_id": str(school_id)})
    if settings.auth_store_sessions_in_db:
        async with async_session() as s2:
            await persist_login_session_after_token(s2, school_id, token)
            await s2.commit()
    print(f"\n🔑 TOKEN DE ACESSO:\n{token}\n")
    print(f"📋 Login: slug='{SLUG}' | senha='{PASSWORD}'")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
