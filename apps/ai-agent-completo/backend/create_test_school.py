
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from schools.models import School
from agent_config.models import AgentConfig
from core.security import hash_password
import uuid

DATABASE_URL = "postgresql+asyncpg://smartuser:smartpassword@smart-postgres:5432/smartdb"

async def create_school():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    slug = "KAITS escola para teste (Id 419)"
    
    async with async_session() as session:
        from sqlalchemy import select
        result = await session.execute(select(School).where(School.slug == slug))
        school = result.scalar_one_or_none()
        
        if not school:
            print(f"Criando escola: {slug}")
            school = School(
                id=uuid.uuid4(),
                name=slug,
                slug=slug,
                password_hash=hash_password("password123"),
                is_active=True
            )
            session.add(school)
            await session.commit()
            await session.refresh(school)
            
            # Criar AgentConfig padrão
            config = AgentConfig(
                school_id=school.id,
                data={
                    "assistantName": "Assistente KAITS",
                    "personality": "Cordial e eficiente.",
                    "greeting": "Olá! Bem-vindo ao suporte da escola.",
                    "isPaused": False
                }
            )
            session.add(config)
            await session.commit()
            print("Escola e configuração criadas com sucesso.")
        else:
            print(f"Escola {slug} já existe.")

if __name__ == "__main__":
    asyncio.run(create_school())
