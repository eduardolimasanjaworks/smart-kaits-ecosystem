"""
ai/embedder.py — Vetorização de chunks via OpenAI Embeddings

Converte texto em vetores float para armazenamento no Qdrant.
Usa text-embedding-3-small: barato, rápido, 1536 dimensões.
"""

from ai.client import openai_client
from ai.config import EMBEDDING_MODEL


async def embed_text(text: str) -> list[float]:
    """
    Vetoriza um único texto.

    Args:
        text: Texto a vetorizar (máximo ~8191 tokens para este modelo).

    Returns:
        Lista de 1536 floats representando o embedding.
    """
    text = text.replace("\n", " ").strip()
    response = await openai_client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=text,
    )
    return response.data[0].embedding


async def embed_batch(texts: list[str]) -> list[list[float]]:
    """
    Vetoriza múltiplos textos em uma única chamada de API.
    Mais eficiente que chamar embed_text em loop.

    Args:
        texts: Lista de textos a vetorizar.

    Returns:
        Lista de embeddings na mesma ordem dos textos.
    """
    if not texts:
        return []

    cleaned = [t.replace("\n", " ").strip() for t in texts]
    response = await openai_client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=cleaned,
    )
    # Garante a ordem correta (API retorna ordenado por index)
    return [item.embedding for item in sorted(response.data, key=lambda x: x.index)]
