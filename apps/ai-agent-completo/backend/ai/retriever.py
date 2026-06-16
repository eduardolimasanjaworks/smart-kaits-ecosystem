"""
ai/retriever.py — Busca Semântica Avançada (Retrieval)

Consulta o Qdrant usando text embeddings, filtrando OBRIGATORIAMENTE
pelo `school_id` para não acontecer vazamento de dados entre escolas.
"""

from qdrant_client.models import Filter, FieldCondition, MatchValue
from ai.client import qdrant_client
from ai.config import QDRANT_COLLECTION, RAG_TOP_K
from ai.embedder import embed_text

async def search_knowledge(school_id: str, query: str, top_k: int = RAG_TOP_K) -> list[dict]:
    """
    Vetoriza a pergunta do usuráio e encontra os chunks mais próximos
    associados a esta escola.
    """
    # 1. Vetoriza a pergunta
    query_vector = await embed_text(query)

    # 2. Constrói Filtro Isolado por Escola
    school_filter = Filter(
        must=[
            FieldCondition(
                key="school_id",
                match=MatchValue(value=school_id)
            )
        ]
    )

    # 3. Busca no Qdrant
    search_result = await qdrant_client.search(
        collection_name=QDRANT_COLLECTION,
        query_vector=query_vector,
        query_filter=school_filter,
        limit=top_k,
        with_payload=True
    )
    
    # 4. Retorna a lista de Payloads (os metadados completos do chunk)
    return [hit.payload for hit in search_result]
