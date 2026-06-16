"""
Suíte QA 5 — Motor RAG: filtro school_id no Qdrant, injeção no prompt, falhas e isolamento.
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from qdrant_client.models import FieldCondition, Filter, MatchValue

from ai.assistant import process_chat_message
from ai.config import QDRANT_COLLECTION, RAG_TOP_K
from ai.embedder import embed_text
from ai.retriever import search_knowledge


@pytest.mark.asyncio
async def test_search_knowledge_aplica_filter_school_id_obrigatorio(monkeypatch):
    school = str(uuid.uuid4())
    vec = [0.01] * 1536
    captured = {}

    async def fake_embed(q: str):
        captured["query"] = q
        return vec

    async def fake_search(**kwargs):
        captured.update(kwargs)
        return []

    monkeypatch.setattr("ai.retriever.embed_text", fake_embed)
    monkeypatch.setattr("ai.retriever.qdrant_client.search", fake_search)

    await search_knowledge(school, "Qual o horário?", top_k=4)

    flt = captured.get("query_filter")
    assert isinstance(flt, Filter)
    assert len(flt.must) == 1
    cond = flt.must[0]
    assert isinstance(cond, FieldCondition)
    assert cond.key == "school_id"
    assert isinstance(cond.match, MatchValue)
    assert cond.match.value == school
    assert captured.get("collection_name") == QDRANT_COLLECTION
    assert captured.get("limit") == 4


@pytest.mark.asyncio
async def test_pergunta_horario_injetada_no_system_prompt(monkeypatch):
    sid = str(uuid.uuid4())
    chunk = {
        "text": "Horário de funcionamento: 08h às 17h, segunda a sexta.",
        "source_ref": "doc-regimento",
        "chunk_type": "docs",
    }

    async def fake_search(s_id, q, top_k=6):
        assert s_id == sid
        return [chunk]

    captured = {}

    async def fake_create(**kwargs):
        captured["messages"] = kwargs.get("messages")
        return MagicMock(
            choices=[
                MagicMock(
                    message=MagicMock(
                        tool_calls=None,
                        content="Atendemos das 8h às 17h em dias úteis.",
                    )
                )
            ]
        )

    monkeypatch.setattr("ai.assistant.search_knowledge", fake_search)
    monkeypatch.setattr("ai.assistant.openai_client.chat.completions.create", fake_create)

    await process_chat_message(
        user_message="Qual o horário de funcionamento?",
        school_id=sid,
        agent_config={"assistantName": "Recepção", "tools": {}},
        chat_history=[],
    )

    system_text = (captured["messages"] or [{}])[0].get("content", "")
    assert "08h" in system_text or "17h" in system_text


@pytest.mark.asyncio
async def test_rag_vazio_prompt_induz_nao_invencionar(monkeypatch):
    sid = str(uuid.uuid4())

    async def fake_search(*a, **k):
        return []

    captured = {}

    async def fake_create(**kwargs):
        captured["messages"] = kwargs.get("messages")
        return MagicMock(
            choices=[
                MagicMock(
                    message=MagicMock(
                        tool_calls=None,
                        content="Não encontrei esse dado na base da escola.",
                    )
                )
            ]
        )

    monkeypatch.setattr("ai.assistant.search_knowledge", fake_search)
    monkeypatch.setattr("ai.assistant.openai_client.chat.completions.create", fake_create)

    out = await process_chat_message(
        user_message="Qual o número secreto da diretoria?",
        school_id=sid,
        agent_config={"assistantName": "A", "tools": {}},
        chat_history=[],
    )

    system_text = (captured["messages"] or [{}])[0].get("content", "")
    assert "Nenhum documento relevante" in system_text or "nenhum chunk" in system_text.lower()
    assert "invent" not in (out.get("text") or "").lower()
    assert out.get("audit", {}).get("type") == "ai_chat"


@pytest.mark.asyncio
async def test_busca_escola_a_nunca_usa_payload_de_escola_b_no_filter(monkeypatch):
    school_a = str(uuid.uuid4())
    school_b = str(uuid.uuid4())
    seen: list[str] = []

    async def fake_search(**kwargs):
        flt = kwargs.get("query_filter")
        val = flt.must[0].match.value
        seen.append(val)
        return []

    monkeypatch.setattr("ai.retriever.embed_text", AsyncMock(return_value=[0.0] * 1536))
    monkeypatch.setattr("ai.retriever.qdrant_client.search", fake_search)

    await search_knowledge(school_a, "teste isolamento")
    await search_knowledge(school_b, "outra escola")
    assert seen == [school_a, school_b]


@pytest.mark.asyncio
async def test_qdrant_connection_error_propaga(monkeypatch):
    from qdrant_client.http.exceptions import ResponseHandlingException

    monkeypatch.setattr("ai.retriever.embed_text", AsyncMock(return_value=[0.0] * 1536))
    monkeypatch.setattr(
        "ai.retriever.qdrant_client.search",
        AsyncMock(side_effect=ResponseHandlingException(RuntimeError("connection refused"))),
    )

    with pytest.raises(ResponseHandlingException):
        await search_knowledge(str(uuid.uuid4()), "x")


@pytest.mark.asyncio
async def test_embedder_falha_propaga(monkeypatch):
    monkeypatch.setattr(
        "ai.retriever.embed_text",
        AsyncMock(side_effect=RuntimeError("embedding offline")),
    )
    monkeypatch.setattr("ai.retriever.qdrant_client.search", AsyncMock(return_value=[]))

    with pytest.raises(RuntimeError, match="embedding"):
        await search_knowledge(str(uuid.uuid4()), "y")


@pytest.mark.asyncio
async def test_top_k_respeita_parametro_retriever(monkeypatch):
    monkeypatch.setattr("ai.retriever.embed_text", AsyncMock(return_value=[0.1] * 1536))

    async def fake_search(**kwargs):
        assert kwargs.get("limit") == RAG_TOP_K
        return []

    monkeypatch.setattr("ai.retriever.qdrant_client.search", fake_search)
    await search_knowledge(str(uuid.uuid4()), "default top k")


@pytest.mark.asyncio
async def test_hit_payloads_apenas_da_escola_corrente(monkeypatch):
    """Simula hits no Qdrant — retriever devolve só payloads (sem misturar tenants)."""
    sid = str(uuid.uuid4())
    hit = MagicMock()
    hit.payload = {"text": "segredo", "school_id": sid}

    monkeypatch.setattr("ai.retriever.embed_text", AsyncMock(return_value=[0.2] * 1536))
    monkeypatch.setattr("ai.retriever.qdrant_client.search", AsyncMock(return_value=[hit]))

    rows = await search_knowledge(sid, "foo")
    assert len(rows) == 1
    assert rows[0].get("school_id") == sid
