"""
backend/ai/ — Módulo de Inteligência Artificial

Este módulo centraliza toda a lógica de IA do Smart Kaits:

## Dois modos de operação:

### 1. Chat Assistente (Assistant Mode)
- Recebe a conversa do cliente
- Constrói um prompt completo com TUDO que a escola ensinou
  (personalidade, roteiro, FAQ, chunks de documentos)
- Chama a OpenAI API (gpt-4o-mini) e retorna a resposta
- Se Context Window estourar → fallback para RAG (busca vetorial)
- Rastreia qual chunk/regra originou cada resposta (trace)

### 2. Chat Construtor (Builder Mode)  
- Ajuda o dono da escola a CONFIGURAR a I.A.
- Tem acesso a tools/function_calling para:
  - Sugerir melhorias na personalidade
  - Gerar perguntas de FAQ automaticamente
  - Analisar documentos e criar regras de roteiro
  - Simular respostas com a config atual
- Usa o mesmo modelo mas com system prompt diferente

## Pipeline de Documentos (RAG):

```
Upload PDF/DOCX/TXT
    ↓
Extração de texto por página (pymupdf / python-docx)
    ↓  
Chunking contextual pela IA (OpenAI analisa e quebra semanticamente)
    ↓
Metadados por chunk: { page, line_start, line_end, paragraph, doc_id }
    ↓
Vetorização (OpenAI text-embedding-3-small)
    ↓
Armazenamento no Qdrant (com payload: school_id, doc_id, page, etc.)
    ↓
Na query: busca semântica filtrada por school_id → top-K chunks
    ↓
Trace: resposta referencia exatamente page+line do chunk usado
```

## Dados do Formulário como Chunks:

O `agentConfig` todo vira chunks também:
- Personalidade → 1 chunk tipo "identity"
- Cada FAQ item → 1 chunk tipo "faq" com question+answer
- Cada regra de roteiro → 1 chunk tipo "script_rule"
- Saudação → 1 chunk tipo "greeting"

## Vector DB: Qdrant ✅

Escolhemos Qdrant pelos seguintes motivos sobre pgvector e outros:

| Critério | Qdrant | pgvector | Pinecone |
|---|---|---|---|
| Filtro por school_id nativo | ✅ Payload filter | ⚠️ WHERE lento em escala | ✅ |
| Metadados ricos por chunk | ✅ JSON payload | ⚠️ Colunas extras | ✅ |
| Self-hosted (controle total) | ✅ Docker | ✅ | ❌ Cloud only |
| Performance em 10K+ vetores | ✅ HNSW | ⚠️ Degrada | ✅ |
| Python client | ✅ qdrant-client | ✅ asyncpg | ✅ |
| Custo | ✅ Grátis | ✅ Grátis | 💰 Pago |

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `config.py` | OpenAI API key, Qdrant config, modelos escolhidos |
| `client.py` | Cliente OpenAI e Qdrant inicializados |
| `chunker.py` | Extração de texto + chunking semântico por IA |
| `embedder.py` | Vetorização de chunks (text-embedding-3-small) |
| `indexer.py` | Upsert no Qdrant com payload completo |
| `retriever.py` | Busca semântica filtrada por school_id |
| `prompt_builder.py` | Monta o system prompt com TODO o conhecimento |
| `assistant.py` | Chat Assistente — responde clientes |
| `builder.py` | Chat Construtor — tools para configurar a I.A. |
| `tracer.py` | Registra trace de qual chunk/fonte foi usado |
"""
