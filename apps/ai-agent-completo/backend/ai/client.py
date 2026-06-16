"""
ai/client.py — Clientes OpenAI e Qdrant (singletons)

Instancia uma vez, reutiliza em toda a aplicação.
Importar `openai_client` ou `qdrant_client` em vez de instanciar novamente.
"""

from openai import AsyncOpenAI
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import Distance, VectorParams

from ai.config import (
    OPENAI_API_KEY, QDRANT_HOST, QDRANT_PORT, QDRANT_API_KEY,
    QDRANT_COLLECTION, EMBEDDING_DIM,
)

# ── OpenAI ────────────────────────────────────────────────
openai_client = AsyncOpenAI(
    api_key=OPENAI_API_KEY,
    max_retries=3,    # Auto-retry em erros de conexão/rate limit
    timeout=30.0      # Evita requisições penduradas pra sempre
)


# ── Qdrant ────────────────────────────────────────────────
qdrant_client = AsyncQdrantClient(
    host=QDRANT_HOST,
    port=QDRANT_PORT,
    api_key=QDRANT_API_KEY or None,
)


async def ensure_collection_exists() -> None:
    """
    Garante que a collection do Qdrant existe com as configurações corretas.
    Chamar uma vez no startup da aplicação (em main.py lifespan).

    A collection usa:
      - Distância COSINE (padrão para text embeddings)
      - Dimensão = EMBEDDING_DIM (1536 para text-embedding-3-small)
    """
    collections = await qdrant_client.get_collections()
    existing = [c.name for c in collections.collections]

    if QDRANT_COLLECTION not in existing:
        await qdrant_client.create_collection(
            collection_name=QDRANT_COLLECTION,
            vectors_config=VectorParams(
                size=EMBEDDING_DIM,
                distance=Distance.COSINE,
            ),
        )
