"""
ai/config.py — Configurações do módulo de IA

Lê as chaves de API e parâmetros dos modelos.
Suporta .env e .openai.env na raiz do projeto.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# ── Carrega openai.env se existir ──────────────────────────
# Arquivo na raiz do projeto (fora de backend/)
_openai_env = Path(__file__).parent.parent.parent / "openai.env"
if _openai_env.exists():
    load_dotenv(_openai_env)

# Tenta também o .env padrão do backend
load_dotenv(Path(__file__).parent.parent / ".env")


# ── Chave OpenAI ───────────────────────────────────────────
# Suporta tanto TOKENOPENAI= (formato do .openai.env) quanto OPENAI_API_KEY=
OPENAI_API_KEY: str = (
    os.getenv("tokenopenai")
    or os.getenv("OPENAI_API_KEY")
    or ""
)

if not OPENAI_API_KEY:
    import warnings
    warnings.warn(
        "⚠️  OpenAI API key não encontrada. "
        "Configure tokenopenai= no arquivo .openai.env na raiz do projeto.",
        stacklevel=2,
    )


# ── Modelos ────────────────────────────────────────────────
# Chat: gpt-4o-mini é o melhor custo/benefício para assistant
CHAT_MODEL = os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")

# Embeddings: text-embedding-3-small → 1536 dims, barato e rápido
EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
EMBEDDING_DIM   = 1536   # Dimensões do text-embedding-3-small

# Limite de contexto (em tokens) para o modo "tudo no prompt"
# gpt-4o-mini = 128k tokens. Usamos 100k como margem de segurança.
MAX_CONTEXT_TOKENS = int(os.getenv("MAX_CONTEXT_TOKENS", "100000"))


# ── Qdrant ────────────────────────────────────────────────
QDRANT_HOST       = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT       = int(os.getenv("QDRANT_PORT", "6333"))
QDRANT_API_KEY    = os.getenv("QDRANT_API_KEY", "")   # Vazio = sem auth (dev local)
QDRANT_COLLECTION = os.getenv("QDRANT_COLLECTION", "kaits_knowledge")


# ── Chunking ───────────────────────────────────────────────
# Tamanho alvo dos chunks em tokens (para chunks de documentos)
CHUNK_TARGET_TOKENS   = int(os.getenv("CHUNK_TARGET_TOKENS", "400"))
CHUNK_OVERLAP_TOKENS  = int(os.getenv("CHUNK_OVERLAP_TOKENS", "50"))

# Número de chunks recuperados por query (RAG top-K)
RAG_TOP_K = int(os.getenv("RAG_TOP_K", "5"))
