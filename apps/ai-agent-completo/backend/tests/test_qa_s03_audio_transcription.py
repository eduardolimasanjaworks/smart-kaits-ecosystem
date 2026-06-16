"""
Suíte QA 3 — Áudio WhatsApp → bytes/base64 → Whisper (OpenAI), com falhas mockadas.
"""

from __future__ import annotations

import base64
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from ai.transcription import MAX_AUDIO_BYTES, transcribe_audio_bytes
from evolution_inbound import _audio_filename_from_mimetype, _load_audio_bytes_from_msg
from evolution_inbound import process_evolution_payload
from evolution_service import evolution_instance_name


@pytest.mark.asyncio
async def test_transcribe_audio_bytes_chama_openai_whisper(monkeypatch):
    mock_create = AsyncMock(return_value=MagicMock(text="texto de teste"))

    class AudioApi:
        transcriptions = MagicMock(create=mock_create)

    monkeypatch.setattr(
        "ai.transcription.openai_client",
        MagicMock(audio=AudioApi()),
    )

    out = await transcribe_audio_bytes(audio_bytes=b"\x00\x01opus", filename="audio.ogg")
    assert out == "texto de teste"
    mock_create.assert_awaited_once()
    kwargs = mock_create.await_args.kwargs
    assert kwargs.get("model") == "whisper-1"


@pytest.mark.asyncio
async def test_transcribe_filename_ogg_por_mimetype(monkeypatch):
    mock_create = AsyncMock(return_value=MagicMock(text="ok"))

    class AudioApi:
        transcriptions = MagicMock(create=mock_create)

    monkeypatch.setattr(
        "ai.transcription.openai_client",
        MagicMock(audio=AudioApi()),
    )

    await transcribe_audio_bytes(audio_bytes=b"x", filename="audio.ogg")
    file_arg = mock_create.await_args.kwargs.get("file")
    assert getattr(file_arg, "name", None) == "audio.ogg"


@pytest.mark.asyncio
async def test_transcribe_mp3_filename(monkeypatch):
    mock_create = AsyncMock(return_value=MagicMock(text="ok"))
    monkeypatch.setattr(
        "ai.transcription.openai_client",
        MagicMock(audio=MagicMock(transcriptions=MagicMock(create=mock_create))),
    )
    await transcribe_audio_bytes(audio_bytes=b"id3", filename="audio.mp3")
    assert mock_create.await_args.kwargs.get("model") == "whisper-1"


@pytest.mark.asyncio
async def test_transcribe_audio_muito_grande_valueerror():
    with pytest.raises(ValueError, match="excede"):
        await transcribe_audio_bytes(
            audio_bytes=b"x" * (MAX_AUDIO_BYTES + 1),
            filename="audio.ogg",
        )


@pytest.mark.asyncio
async def test_transcribe_openai_erro_propaga(monkeypatch):
    mock_create = AsyncMock(side_effect=RuntimeError("OpenAI indisponível"))
    monkeypatch.setattr(
        "ai.transcription.openai_client",
        MagicMock(audio=MagicMock(transcriptions=MagicMock(create=mock_create))),
    )
    with pytest.raises(RuntimeError, match="OpenAI"):
        await transcribe_audio_bytes(audio_bytes=b"small", filename="a.ogg")


@pytest.mark.asyncio
async def test_load_audio_base64_decodifica_para_bytes():
    raw = b"\xff\xd7-test-bytes"
    msg = {
        "message": {
            "audioMessage": {
                "mimetype": "audio/ogg; codecs=opus",
                "base64": base64.standard_b64encode(raw).decode("ascii"),
            }
        }
    }
    out = await _load_audio_bytes_from_msg(msg)
    assert out is not None
    data, fn = out
    assert data == raw
    assert fn.endswith(".ogg")


@pytest.mark.asyncio
async def test_load_audio_url_baixa_via_httpx(monkeypatch):
    class Resp:
        def raise_for_status(self):
            return None

        content = b"\x01\x02\x03"

    class Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return None

        async def get(self, url):
            assert url.startswith("https://")
            return Resp()

    monkeypatch.setattr("evolution_inbound.httpx.AsyncClient", lambda **kw: Client())
    msg = {
        "message": {
            "audioMessage": {
                "mimetype": "audio/mpeg",
                "url": "https://cdn.example/a.mp3",
            }
        }
    }
    out = await _load_audio_bytes_from_msg(msg)
    assert out == (b"\x01\x02\x03", "audio.mp3")


def test_audio_filename_mimetype_desconhecido_usa_bin():
    assert _audio_filename_from_mimetype("application/octet-stream") == "audio.bin"


@pytest.mark.asyncio
async def test_webhook_audio_base64_transcrito_entra_como_texto_na_ia(monkeypatch):
    import evolution_inbound as ei

    school_id = uuid.uuid4()
    iname = evolution_instance_name(school_id)
    cfg = MagicMock()
    cfg.data = {"isPaused": False, "tools": {}}

    payload = {
        "event": "messages.upsert",
        "instance": iname,
        "data": {
            "messages": [
                {
                    "key": {
                        "remoteJid": "5511777665544@s.whatsapp.net",
                        "fromMe": False,
                    },
                    "message": {
                        "audioMessage": {
                            "mimetype": "audio/ogg; codecs=opus",
                            "base64": base64.standard_b64encode(b"\x00\x01fakeopus").decode(
                                "ascii"
                            ),
                        }
                    },
                }
            ]
        },
    }

    monkeypatch.setattr(ei, "get_config_by_school", AsyncMock(return_value=cfg))
    monkeypatch.setattr(
        ei.wa_chat_repository,
        "recent_history_for_contact",
        AsyncMock(return_value=[]),
    )
    mock_transcribe = AsyncMock(return_value="texto de teste transcrito")
    monkeypatch.setattr(ei, "transcribe_audio_bytes", mock_transcribe)
    mock_llm = AsyncMock(return_value={"text": "Resposta à voz."})
    monkeypatch.setattr(ei, "process_chat_message", mock_llm)
    monkeypatch.setattr(ei.evolution_service, "send_text", AsyncMock(return_value=True))
    monkeypatch.setattr(ei.wa_chat_repository, "append_wa_message", AsyncMock())

    await process_evolution_payload(AsyncMock(), payload)

    mock_transcribe.assert_awaited_once()
    mock_llm.assert_awaited_once()
    assert mock_llm.await_args.kwargs["user_message"] == "texto de teste transcrito"


@pytest.mark.asyncio
async def test_load_audio_base64_invalido_retorna_none():
    msg = {
        "message": {
            "audioMessage": {
                "mimetype": "audio/ogg",
                "base64": "@@@invalid@@@",
            }
        }
    }
    assert await _load_audio_bytes_from_msg(msg) is None
