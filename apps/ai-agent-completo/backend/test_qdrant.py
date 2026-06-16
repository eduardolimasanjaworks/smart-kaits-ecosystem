
import asyncio
from qdrant_client import AsyncQdrantClient

async def test():
    client = AsyncQdrantClient(host="smart-qdrant", port=6333)
    try:
        cols = await client.get_collections()
        print(f"SUCCESS: Connected to Qdrant. Collections: {[c.name for c in cols.collections]}")
    except Exception as e:
        print(f"FAILURE: {e}")

if __name__ == "__main__":
    asyncio.run(test())
