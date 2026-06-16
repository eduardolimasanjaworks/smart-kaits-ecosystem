"""
ai/indexer.py — Ingestão de dados no Qdrant

Pega os chunks (seja do agentConfig ou de documentos extras), 
vetoriza usando `embedder.py` e os insere no Qdrant.
"""

import uuid
from qdrant_client.models import PointStruct
from ai.client import qdrant_client
from ai.config import QDRANT_COLLECTION
from ai.embedder import embed_batch

async def index_chunks(chunks: list[dict]) -> None:
    """
    Recebe uma lista de chunks (ver chunker.py), extrai os textos,
    gera embeddings em lote e salva os pontos no Qdrant mantendo os metadados.
    
    Cada chunk precisa ter no mínimo:
    - text
    - school_id
    - source_ref
    """
    if not chunks:
        return

    # Extrai textos
    texts = [c["text"] for c in chunks]
    
    # Gera os embeddings 
    embeddings = await embed_batch(texts)

    points = []
    for chunk_meta, emb in zip(chunks, embeddings):
        # O Qdrant usa UUIDs (ou inteiros) como ID do Point
        point_id = str(uuid.uuid4())
        
        points.append(
            PointStruct(
                id=point_id,
                vector=emb,
                payload=chunk_meta  # Guarda todo o rastreamento!
            )
        )
    
    # Insere as centenas de vetores em uma única chamada
    await qdrant_client.upsert(
        collection_name=QDRANT_COLLECTION,
        points=points
    )

async def clear_school_chunks(school_id: str, doc_ids: list[str] = None) -> None:
    """
    Deleta os chunks de uma escola específica.
    Se doc_ids for passado, deleta apenas os chunks daqueles documentos na escola.
    """
    from qdrant_client.models import Filter, FieldCondition, MatchValue

    must_conditions = [
        FieldCondition(
            key="school_id",
            match=MatchValue(value=school_id)
        )
    ]
    
    if doc_ids:
        # Apaga só de documentos específicos
        doc_matches = [
            FieldCondition(key="doc_id", match=MatchValue(value=doc_id))
            for doc_id in doc_ids
        ]
        from qdrant_client.models import Filter as QFilter
        import qdrant_client.models as rest_models
        must_conditions.append(
            rest_models.Filter(
                should=doc_matches
            )
        )
        
    await qdrant_client.delete(
        collection_name=QDRANT_COLLECTION,
        points_selector=Filter(must=must_conditions)
    )
