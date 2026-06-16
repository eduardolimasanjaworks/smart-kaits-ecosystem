"""
ai/chunker.py — Extração de texto e chunking contextual

Responsabilidades:
  1. Extrair texto de PDFs/DOCX/TXT com metadados de página/linha
  2. Usar a OpenAI para criar chunks semanticamente coerentes
  3. Adicionar metadados ricos: page, line_start, line_end, paragraph, doc_id

Cada chunk retornado é um dict com:
  {
    "text":       str,          # Conteúdo do chunk
    "doc_id":     str,          # UUID do documento
    "doc_name":   str,          # Nome do arquivo
    "page":       int,          # Página onde está (1-indexed)
    "line_start": int,          # Linha de início na página
    "line_end":   int,          # Linha de fim na página
    "paragraph":  int,          # Parágrafo aproximado
    "chunk_type": str,          # "document" | "faq" | "script_rule" | "identity"
    "school_id":  str,          # UUID da escola (para filtro no Qdrant)
    "source_ref": str,          # Referência legível: "Manual.pdf, p.8, L12-17"
  }
"""

import re
from pathlib import Path
from typing import Any

# Importações opcionais — instalar conforme necessário
try:
    import fitz  # pymupdf — extração de PDF
    HAS_FITZ = True
except ImportError:
    HAS_FITZ = False

try:
    from docx import Document as DocxDocument  # python-docx
    HAS_DOCX = True
except ImportError:
    HAS_DOCX = False

from ai.config import CHUNK_TARGET_TOKENS, CHAT_MODEL
from ai.client import openai_client


# ── Tipo de Chunk ──────────────────────────────────────────
ChunkDict = dict[str, Any]


# ── Extração de Texto por Página ───────────────────────────

def extract_pages_from_pdf(file_path: str) -> list[dict]:
    """
    Extrai texto de PDF, retornando uma lista de páginas com linhas numeradas.

    Args:
        file_path: Caminho absoluto do arquivo PDF.

    Returns:
        Lista de dicts: [{ "page": int, "lines": [str] }]
    """
    if not HAS_FITZ:
        raise ImportError("pymupdf não instalado. Execute: pip install pymupdf")

    doc = fitz.open(file_path)
    pages = []
    total_len = 0
    for page_num, page in enumerate(doc, start=1):
        text = page.get_text("text")
        total_len += len(text.strip())
        lines = [l for l in text.split("\n") if l.strip()]
        pages.append({"page": page_num, "lines": lines})
    doc.close()

    if total_len < 100:
        # Warning lúdico: Provavelmente é um PDF escaneado sem OCR
        pages.insert(0, {"page": 0, "lines": ["⚠️ AVISO: Este arquivo parece conter pouquíssimo texto extraível. Se for uma imagem escaneada, a I.A. não conseguirá ler o conteúdo. Recomenda-se usar um PDF com texto selecionável ou passar um OCR antes."] })
        
    return pages


def extract_pages_from_docx(file_path: str) -> list[dict]:
    """
    Extrai texto de DOCX, agrupando parágrafos em "páginas" estimadas.
    DOCX não tem conceito nativo de página, então estimamos ~40 linhas/página.
    """
    if not HAS_DOCX:
        raise ImportError("python-docx não instalado. Execute: pip install python-docx")

    doc = DocxDocument(file_path)
    all_lines = [p.text for p in doc.paragraphs if p.text.strip()]

    # Simula páginas: agrupa ~40 linhas por página
    lines_per_page = 40
    pages = []
    for i in range(0, len(all_lines), lines_per_page):
        pages.append({
            "page": (i // lines_per_page) + 1,
            "lines": all_lines[i : i + lines_per_page],
        })
    return pages


def extract_pages_from_txt(file_path: str) -> list[dict]:
    """Extrai texto de TXT. Agrupa ~50 linhas por "página"."""
    lines = Path(file_path).read_text(encoding="utf-8", errors="ignore").splitlines()
    non_empty = [l for l in lines if l.strip()]
    lines_per_page = 50
    pages = []
    for i in range(0, len(non_empty), lines_per_page):
        pages.append({
            "page": (i // lines_per_page) + 1,
            "lines": non_empty[i : i + lines_per_page],
        })
    return pages


def extract_pages(file_path: str, extension: str) -> list[dict]:
    """Dispatcher: extrai texto conforme a extensão do arquivo."""
    ext = extension.lower().strip(".")
    if ext == "pdf":
        return extract_pages_from_pdf(file_path)
    elif ext in ("doc", "docx"):
        return extract_pages_from_docx(file_path)
    elif ext == "txt":
        return extract_pages_from_txt(file_path)
    else:
        raise ValueError(f"Extensão não suportada para extração: .{ext}")


# ── Chunking Semântico via IA ──────────────────────────────

async def chunk_page_with_ai(
    page_text: str,
    page_num: int,
    doc_id: str,
    doc_name: str,
    school_id: str,
) -> list[ChunkDict]:
    """
    Usa a OpenAI para dividir o texto de uma página em chunks semanticamente coerentes.

    Cada chunk mantém o contexto completo de uma ideia,
    nunca quebra no meio de uma frase ou conceito.

    Returns:
        Lista de ChunkDicts com metadados completos.
    """
    system_prompt = """Você é um especialista em processamento de texto para RAG (Retrieval Augmented Generation).
Sua tarefa é dividir o texto fornecido em chunks semanticamente coerentes.

Regras:
1. Cada chunk deve conter uma ideia completa — nunca corte no meio de um conceito
2. Tamanho ideal: 3-8 frases por chunk
3. Preserve contexto suficiente para que o chunk faça sentido sozinho
4. Retorne APENAS um JSON array, sem markdown, sem explicações

Formato de cada chunk:
{
  "text": "texto do chunk aqui",
  "paragraph": 1,
  "line_start": 1,
  "line_end": 5
}"""

    user_prompt = f"""Divida este texto da página {page_num} em chunks:

{page_text}

Retorne um JSON array de chunks. Estime as linhas com base na posição no texto."""

    try:
        response = await openai_client.chat.completions.create(
            model=CHAT_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,  # Baixo para consistência
        )

        import json
        raw = response.choices[0].message.content or "{}"
        data = json.loads(raw)

        # A resposta pode vir como {"chunks": [...]} ou diretamente como [...]
        raw_chunks = data.get("chunks", data) if isinstance(data, dict) else data

        chunks: list[ChunkDict] = []
        for raw_chunk in raw_chunks:
            chunks.append({
                "text":       raw_chunk.get("text", ""),
                "doc_id":     doc_id,
                "doc_name":   doc_name,
                "page":       page_num,
                "line_start": raw_chunk.get("line_start", 1),
                "line_end":   raw_chunk.get("line_end", 1),
                "paragraph":  raw_chunk.get("paragraph", 1),
                "chunk_type": "document",
                "school_id":  school_id,
                "source_ref": f"{doc_name}, p.{page_num}, L{raw_chunk.get('line_start')}-{raw_chunk.get('line_end')}",
            })
        return chunks

    except Exception as e:
        # Fallback: divide o texto em chunks fixos se a IA falhar
        lines = page_text.split("\n")
        chunk_size = CHUNK_TARGET_TOKENS // 10  # Aproximação grosseira
        fallback_chunks = []
        for i in range(0, len(lines), chunk_size):
            group = lines[i : i + chunk_size]
            fallback_chunks.append({
                "text":       "\n".join(group),
                "doc_id":     doc_id,
                "doc_name":   doc_name,
                "page":       page_num,
                "line_start": i + 1,
                "line_end":   i + len(group),
                "paragraph":  (i // chunk_size) + 1,
                "chunk_type": "document",
                "school_id":  school_id,
                "source_ref": f"{doc_name}, p.{page_num}, L{i+1}-{i+len(group)}",
            })
        return fallback_chunks


async def chunk_raw_text(
    text: str,
    doc_id: str,
    doc_name: str,
    school_id: str,
) -> list[ChunkDict]:
    """
    Chunka um texto puro (editado manualmente pelo usuário).
    """
    # Divide o texto em blocos de parágrafos aproximados para a IA processar
    # Como não temos mais 'paginas' físicas, operamos como uma página única grande ou dividimos
    return await chunk_page_with_ai(
        page_text=text,
        page_num=1, # No editor manual, tratamos como conteúdo consolidado
        doc_id=doc_id,
        doc_name=doc_name,
        school_id=school_id
    )

async def chunk_document(
    file_path: str,
    extension: str,
    doc_id: str,
    doc_name: str,
    school_id: str,
) -> list[ChunkDict]:
    """
    Pipeline completo: extrai páginas → chunka cada página com IA.

    Args:
        file_path:  Caminho do arquivo no disco.
        extension:  Extensão do arquivo (pdf, docx, txt).
        doc_id:     UUID do Document no banco.
        doc_name:   Nome amigável para o trace.
        school_id:  UUID da escola (para isolamento no Qdrant).

    Returns:
        Lista de todos os chunks do documento com metadados completos.
    """
    pages = extract_pages(file_path, extension)
    all_chunks: list[ChunkDict] = []

    for page_data in pages:
        page_text = "\n".join(page_data["lines"])
        if not page_text.strip():
            continue

        chunks = await chunk_page_with_ai(
            page_text=page_text,
            page_num=page_data["page"],
            doc_id=doc_id,
            doc_name=doc_name,
            school_id=school_id,
        )
        all_chunks.extend(chunks)

    return all_chunks


# ── Chunks de Dados do Formulário ─────────────────────────

def chunks_from_agent_config(config: dict, school_id: str) -> list[ChunkDict]:
    """
    Converte os dados do formulário de configuração em chunks indexáveis.

    FAQ, Roteiro, Personalidade — tudo vira chunk com metadados próprios
    para que o trace possa apontar exatamente onde a resposta foi buscada.

    Args:
        config:    O dict agentConfig do frontend.
        school_id: UUID da escola.

    Returns:
        Lista de ChunkDicts com chunk_type = "faq" | "script_rule" | "identity".
    """
    chunks: list[ChunkDict] = []

    # ── Identidade / Personalidade ─────────────────────────
    if name := config.get("assistantName"):
        personality_text = f"Você é {name}. {config.get('personality', '')}. Saudação: {config.get('greeting', '')}"
        chunks.append({
            "text":       personality_text,
            "doc_id":     "config",
            "doc_name":   "Configuração do Agente",
            "page":       1,
            "line_start": 1,
            "line_end":   3,
            "paragraph":  1,
            "chunk_type": "identity",
            "school_id":  school_id,
            "source_ref": "Configuração: Identidade e Personalidade",
        })

    # ── FAQ Items ──────────────────────────────────────────
    for idx, item in enumerate(config.get("faqItems", []), start=1):
        if not item.get("question"):
            continue
        at = str(item.get("actionType") or "respond")
        lines = [f"Pergunta: {item['question']}"]
        ans = (item.get("answer") or "").strip()
        if ans:
            lines.append(f"Resposta ao cliente: {ans}")
        nm = (item.get("notifyMessage") or "").strip()
        if nm and at in ("notify", "notify_pause", "both", "both_pause"):
            lines.append(f"Aviso / modelo para a equipe: {nm}")
        if at.endswith("_pause") or item.get("pauseAi"):
            lines.append("Após esta regra: pausar a I.A. para o cliente até um humano retomar.")
        chunk_text = "\n".join(lines)
        if len(chunk_text.strip()) < 8:
            continue
        chunks.append({
            "text":       chunk_text,
            "doc_id":     "config_faq",
            "doc_name":   "Dúvidas Frequentes",
            "page":       1,
            "line_start": idx,
            "line_end":   idx,
            "paragraph":  idx,
            "chunk_type": "faq",
            "school_id":  school_id,
            "source_ref": f"FAQ, pergunta nº {idx}: {item['question'][:50]}",
        })

    # ── Regras de Roteiro ──────────────────────────────────
    for idx, rule in enumerate(config.get("scriptRules", []), start=1):
        if not rule.get("trigger"):
            continue
        chunks.append({
            "text":       f"Quando o cliente dizer algo como '{rule['trigger']}', responda: {rule.get('response', '')}",
            "doc_id":     "config_script",
            "doc_name":   "Roteiro de Conversa",
            "page":       1,
            "line_start": idx,
            "line_end":   idx,
            "paragraph":  idx,
            "chunk_type": "script_rule",
            "school_id":  school_id,
            "source_ref": f"Roteiro, regra nº {idx}: gatilho '{rule['trigger'][:40]}'",
        })

    return chunks
