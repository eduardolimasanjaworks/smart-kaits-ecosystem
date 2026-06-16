
import os
import asyncio
from openai import AsyncOpenAI

async def test():
    key = "REDACTED"
    client = AsyncOpenAI(api_key=key)
    try:
        resp = await client.embeddings.create(
            model="text-embedding-3-small",
            input="Hello world"
        )
        print("SUCCESS: Embedding generated.")
    except Exception as e:
        print(f"FAILURE: {e}")

if __name__ == "__main__":
    asyncio.run(test())
