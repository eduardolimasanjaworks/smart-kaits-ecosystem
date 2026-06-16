"""
core/database.py — Configuração do banco de dados (SQLAlchemy async)

Expõe:
  - `engine`      → Engine async conectado ao PostgreSQL
  - `AsyncSession` → Tipo de sessão para type hints
  - `Base`        → Classe base declarativa para todos os models
  - `get_db()`    → Função geradora para uso como FastAPI Depends

Todos os models SQLAlchemy devem importar `Base` daqui.
"""

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    AsyncEngine,
    create_async_engine,
    async_sessionmaker,
)
from sqlalchemy.orm import DeclarativeBase

from core.config import settings


# ── Engine ─────────────────────────────────────────────────
# echo=True em dev mostra SQL gerado no console — útil para debug.
engine: AsyncEngine = create_async_engine(
    settings.database_url,
    echo=not settings.is_production,   # SQL logs apenas em dev
    pool_size=10,                       # Conexões simultâneas no pool
    max_overflow=20,                    # Conexões extras além do pool_size
)


# ── Session Factory ────────────────────────────────────────
# Usado para criar instâncias de AsyncSession nas requisições.
async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,   # Evita lazy load após commit (async friendly)
)


# ── Base Declarativa ───────────────────────────────────────
class Base(DeclarativeBase):
    """
    Classe base para todos os models SQLAlchemy.

    Uso:
        from core.database import Base

        class MinhaTabela(Base):
            __tablename__ = "minha_tabela"
            ...
    """
    pass


# ── Dependency para FastAPI ────────────────────────────────
async def get_db() -> AsyncSession:
    """
    Gerador de sessão de banco de dados para uso como FastAPI Depends.

    Garante que a sessão seja fechada ao final de cada request,
    mesmo em caso de erro.

    Uso nos routers:
        from core.database import get_db

        @router.get("/exemplo")
        async def exemplo(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
