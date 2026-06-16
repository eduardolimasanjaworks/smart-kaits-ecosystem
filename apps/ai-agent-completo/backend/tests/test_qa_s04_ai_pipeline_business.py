"""
Suíte QA 4 — Pipeline de IA (isPaused, respostas longas, histórico, bordas de mensagem).
"""

from __future__ import annotations

import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from ai.assistant import process_chat_message
from evolution_inbound import _split_reply_for_whatsapp, process_evolution_payload
from evolution_service import evolution_instance_name


def _upsert_text(instance: str, text: str, from_me: bool = False) -> dict:
    return {
        "event": "messages.upsert",
        "instance": instance,
        "data": {
            "messages": [
                {
                    "key": {
                        "remoteJid": "5511888776655@s.whatsapp.net",
                        "fromMe": from_me,
                    },
                    "message": {"conversation": text},
                }
            ]
        },
    }


@pytest.mark.asyncio
async def test_is_paused_nao_chama_llm_envia_fallback(monkeypatch, school_a_id):
    import evolution_inbound as ei

    iname = evolution_instance_name(school_a_id)
    cfg = MagicMock()
    cfg.data = {"isPaused": True}

    mock_llm = AsyncMock()
    mock_send = AsyncMock(return_value=True)
    monkeypatch.setattr(ei, "get_config_by_school", AsyncMock(return_value=cfg))
    monkeypatch.setattr(ei, "process_chat_message", mock_llm)
    monkeypatch.setattr(ei.evolution_service, "send_text", mock_send)

    db = AsyncMock()
    await process_evolution_payload(db, _upsert_text(iname, "Oi"))

    mock_llm.assert_not_called()
    mock_send.assert_awaited_once()
    assert "pausado" in (mock_send.await_args.args[2] or "").lower()


@pytest.mark.asyncio
async def test_resposta_longa_dispara_varios_send_text(monkeypatch, school_a_id):
    import evolution_inbound as ei

    iname = evolution_instance_name(school_a_id)
    cfg = MagicMock()
    cfg.data = {"isPaused": False, "tools": {}}
    long_reply = ("Linha\n\n" * 3000)[:5200]

    monkeypatch.setattr(ei, "get_config_by_school", AsyncMock(return_value=cfg))
    monkeypatch.setattr(
        ei.wa_chat_repository,
        "recent_history_for_contact",
        AsyncMock(return_value=[]),
    )
    monkeypatch.setattr(ei, "process_chat_message", AsyncMock(return_value={"text": long_reply}))
    mock_send = AsyncMock(return_value=True)
    monkeypatch.setattr(ei.evolution_service, "send_text", mock_send)
    monkeypatch.setattr(ei.wa_chat_repository, "append_wa_message", AsyncMock())

    db = AsyncMock()
    await process_evolution_payload(db, _upsert_text(iname, "pergunta"))

    assert mock_send.await_count >= 2
    total_chars = sum(len(str(c.args[2])) for c in mock_send.await_args_list)
    assert total_chars >= 4000


def test_split_reply_respeita_blocos_grandes():
    body = "x" * 2000 + "\n\n" + "y" * 2000 + "\n\n" + "z" * 1000
    parts = _split_reply_for_whatsapp(body, max_len=2100)
    assert len(parts) >= 2
    assert all(len(p) <= 2100 for p in parts)


@pytest.mark.asyncio
async def test_historico_anterior_entra_no_prompt_openai(monkeypatch):
    sid = str(uuid.uuid4())
    hist = [
        {"from": "user", "text": "Meu filho chama João"},
        {"from": "ai", "text": "Entendi, posso ajudar com matrícula?"},
    ]

    captured = {}

    async def fake_search(*a, **k):
        return []

    async def fake_create(**kwargs):
        captured["messages"] = kwargs.get("messages")
        return MagicMock(
            choices=[
                MagicMock(
                    message=MagicMock(
                        tool_calls=None,
                        content="Resposta com contexto.",
                    )
                )
            ]
        )

    monkeypatch.setattr("ai.assistant.search_knowledge", fake_search)
    monkeypatch.setattr("ai.assistant.openai_client.chat.completions.create", fake_create)

    agent = {
        "assistantName": "Bot",
        "personality": "Amigável",
        "tools": {},
    }
    await process_chat_message(
        user_message="Qual o nome que eu disse antes?",
        school_id=sid,
        agent_config=agent,
        chat_history=hist,
    )

    msgs = captured.get("messages") or []
    flat = json.dumps(msgs, ensure_ascii=False)
    assert "João" in flat


@pytest.mark.asyncio
async def test_mensagem_usuario_com_emoji_processada(monkeypatch):
    sid = str(uuid.uuid4())

    async def fake_search(*a, **k):
        return []

    async def fake_create(**kwargs):
        return MagicMock(
            choices=[MagicMock(message=MagicMock(tool_calls=None, content="Olá! 😊"))]
        )

    monkeypatch.setattr("ai.assistant.search_knowledge", fake_search)
    monkeypatch.setattr("ai.assistant.openai_client.chat.completions.create", fake_create)

    out = await process_chat_message(
        user_message="Oi 🎉🎉 tudo bem?",
        school_id=sid,
        agent_config={"assistantName": "A", "tools": {}},
        chat_history=[],
    )
    assert "Olá" in (out.get("text") or "")


@pytest.mark.asyncio
async def test_mensagem_com_caracteres_especiais_unicode(monkeypatch):
    sid = str(uuid.uuid4())

    async def fake_search(*a, **k):
        return []

    async def fake_create(**kwargs):
        u = kwargs["messages"][-1]["content"]
        assert "日本" in u or "café" in u
        return MagicMock(
            choices=[MagicMock(message=MagicMock(tool_calls=None, content="ok"))]
        )

    monkeypatch.setattr("ai.assistant.search_knowledge", fake_search)
    monkeypatch.setattr("ai.assistant.openai_client.chat.completions.create", fake_create)

    await process_chat_message(
        user_message="café 日本語 ñ",
        school_id=sid,
        agent_config={"assistantName": "A", "tools": {}},
        chat_history=[],
    )


@pytest.mark.asyncio
async def test_usuario_com_texto_longo_ainda_chama_modelo(monkeypatch):
    sid = str(uuid.uuid4())
    big = "palavra " * 800

    async def fake_search(*a, **k):
        return []

    async def fake_create(**kwargs):
        assert len(kwargs["messages"][-1]["content"]) > 1000
        return MagicMock(
            choices=[MagicMock(message=MagicMock(tool_calls=None, content="recebido"))]
        )

    monkeypatch.setattr("ai.assistant.search_knowledge", fake_search)
    monkeypatch.setattr("ai.assistant.openai_client.chat.completions.create", fake_create)

    out = await process_chat_message(
        user_message=big,
        school_id=sid,
        agent_config={"assistantName": "A", "tools": {}},
        chat_history=[],
    )
    assert out.get("text") == "recebido"


@pytest.mark.asyncio
async def test_tool_trigger_handover_retorna_fallback_configuravel(monkeypatch):
    sid = str(uuid.uuid4())

    async def fake_search(*a, **k):
        return []

    tool_call = MagicMock()
    tool_call.function.name = "trigger_handover"
    tool_call.function.arguments = json.dumps(
        {"justificativa_interna": "sem info", "resumo_duvida": "matrícula"}
    )

    async def fake_create(**kwargs):
        return MagicMock(
            choices=[
                MagicMock(
                    message=MagicMock(
                        tool_calls=[tool_call],
                        content=None,
                    )
                )
            ]
        )

    monkeypatch.setattr("ai.assistant.search_knowledge", fake_search)
    monkeypatch.setattr("ai.assistant.openai_client.chat.completions.create", fake_create)

    agent = {
        "assistantName": "A",
        "tools": {},
        "fallbackUserMessage": "Vou chamar um humano da escola.",
        "fallbackContact": "Secretaria",
    }
    out = await process_chat_message(
        user_message="Quero falar com humano",
        school_id=sid,
        agent_config=agent,
        chat_history=[],
    )
    assert out.get("text") == "Vou chamar um humano da escola."
    assert out.get("audit", {}).get("type") == "tool"
