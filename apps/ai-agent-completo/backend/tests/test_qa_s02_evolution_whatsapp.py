"""
Suíte QA 2 — Evolution API, WhatsApp /connect e webhooks.
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from core.config import settings
from evolution_inbound import (
    _digits_from_remote_jid,
    _effective_remote_jid_for_pn,
    _send_recipient_and_contact,
    process_evolution_payload,
)
from evolution_service import (
    _instance_token_from_create_body,
    evolution_instance_name,
    evolution_service,
)


def _text_message_payload(instance: str, text: str = "Olá") -> dict:
    return {
        "event": "messages.upsert",
        "instance": instance,
        "data": {
            "messages": [
                {
                    "key": {
                        "remoteJid": "5511999990000@s.whatsapp.net",
                        "fromMe": False,
                    },
                    "message": {"conversation": text},
                }
            ]
        },
    }


@pytest.mark.asyncio
async def test_whatsapp_connect_com_token_chama_ensure_qr(api_client, auth_headers_school_a, school_a_id):
    esperado = {
        "status": "success",
        "instance": evolution_instance_name(school_a_id),
        "qrcode": "BASE64SIMULADO",
    }

    with patch(
        "whatsapp_api.evolution_service.ensure_qr_for_school",
        new_callable=AsyncMock,
        return_value=esperado,
    ) as mock_ensure:
        r = api_client.get("/api/v1/whatsapp/connect", headers=auth_headers_school_a)

    assert r.status_code == 200
    assert r.json().get("qrcode") == "BASE64SIMULADO"
    mock_ensure.assert_awaited_once()
    db_arg, sid_arg = mock_ensure.await_args.args
    assert sid_arg == school_a_id


@pytest.mark.asyncio
async def test_whatsapp_connect_ja_conectado_sem_quebrar(api_client, auth_headers_school_a, school_a_id):
    esperado = {
        "status": "success",
        "instance": evolution_instance_name(school_a_id),
        "already_connected": True,
        "qrcode": None,
        "message": "WhatsApp já está conectado para esta escola.",
    }
    with patch(
        "whatsapp_api.evolution_service.ensure_qr_for_school",
        new_callable=AsyncMock,
        return_value=esperado,
    ):
        r = api_client.get("/api/v1/whatsapp/connect", headers=auth_headers_school_a)
    assert r.status_code == 200
    body = r.json()
    assert body.get("already_connected") is True
    assert body.get("qrcode") is None


def test_webhook_evolution_com_secret_correto_aceito(api_client, monkeypatch):
    monkeypatch.setattr(settings, "evolution_webhook_secret", "segredo-qa")
    r = api_client.post(
        "/api/v1/webhooks/evolution",
        json={"event": "messages.upsert", "instance": "x"},
        headers={"X-Smart-Kaits-Webhook-Secret": "segredo-qa"},
    )
    assert r.status_code == 200
    assert r.json().get("received") is True


def test_webhook_evolution_sem_secret_rejeita_401(api_client, monkeypatch):
    monkeypatch.setattr(settings, "evolution_webhook_secret", "segredo-qa")
    r = api_client.post("/api/v1/webhooks/evolution", json={})
    assert r.status_code == 401


def test_webhook_evolution_secret_errado_401(api_client, monkeypatch):
    monkeypatch.setattr(settings, "evolution_webhook_secret", "segredo-qa")
    r = api_client.post(
        "/api/v1/webhooks/evolution",
        json={},
        headers={"X-Smart-Kaits-Webhook-Secret": "outro"},
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_instancia_fora_padrao_sk_ignorada_sem_chamar_ia(monkeypatch):
    import evolution_inbound as ei

    mock_pc = AsyncMock()
    monkeypatch.setattr(ei, "process_chat_message", mock_pc)
    db = AsyncMock()
    await process_evolution_payload(
        db,
        _text_message_payload("loja_custom_sem_sk"),
    )
    mock_pc.assert_not_called()


@pytest.mark.asyncio
async def test_webhook_instancia_sk_dispara_pipeline(monkeypatch, school_a_id):
    import evolution_inbound as ei

    iname = evolution_instance_name(school_a_id)
    cfg = MagicMock()
    cfg.data = {"isPaused": False, "tools": {}, "assistantName": "Bot"}

    monkeypatch.setattr(ei, "get_config_by_school", AsyncMock(return_value=cfg))
    monkeypatch.setattr(
        ei.wa_chat_repository,
        "recent_history_for_contact",
        AsyncMock(return_value=[]),
    )
    monkeypatch.setattr(ei, "process_chat_message", AsyncMock(return_value={"text": "Resposta QA"}))
    monkeypatch.setattr(ei.evolution_service, "send_text", AsyncMock(return_value=True))
    monkeypatch.setattr(ei.wa_chat_repository, "append_wa_message", AsyncMock())

    db = AsyncMock()
    await process_evolution_payload(db, _text_message_payload(iname, "preciso de ajuda"))

    ei.process_chat_message.assert_awaited_once()
    call = ei.process_chat_message.await_args
    assert call.kwargs["school_id"] == str(school_a_id)
    assert call.kwargs["user_message"] == "preciso de ajuda"


def test_effective_remote_jid_usa_remoteJidAlt_quando_lid():
    key = {
        "remoteJid": "212777796939949@lid",
        "remoteJidAlt": "554197594890@s.whatsapp.net",
    }
    r = _effective_remote_jid_for_pn(key)
    assert r == "554197594890@s.whatsapp.net"
    assert _digits_from_remote_jid(r) == "554197594890"


def test_effective_remote_jid_usa_senderPn_quando_lid_sem_alt():
    key = {
        "remoteJid": "212777796939949@lid",
        "remoteJidAlt": "",
        "senderPn": "554197594890@s.whatsapp.net",
    }
    assert _effective_remote_jid_for_pn(key) == "554197594890@s.whatsapp.net"


def test_send_recipient_lid_sem_alt_usa_jid_completo():
    key = {"remoteJid": "212777796939949@lid", "remoteJidAlt": ""}
    send, contact = _send_recipient_and_contact(key)
    assert send == "212777796939949@lid"
    assert contact == "212777796939949"


@pytest.mark.asyncio
async def test_webhook_mensagem_lid_dispara_send_com_numero_do_alt(monkeypatch, school_a_id):
    import evolution_inbound as ei

    iname = evolution_instance_name(school_a_id)
    cfg = MagicMock()
    cfg.data = {"isPaused": False, "tools": {}, "assistantName": "Bot"}
    send = AsyncMock(return_value=True)

    monkeypatch.setattr(ei, "get_config_by_school", AsyncMock(return_value=cfg))
    monkeypatch.setattr(
        ei.wa_chat_repository,
        "recent_history_for_contact",
        AsyncMock(return_value=[]),
    )
    monkeypatch.setattr(ei, "process_chat_message", AsyncMock(return_value={"text": "ok"}))
    monkeypatch.setattr(ei.evolution_service, "send_text", send)
    monkeypatch.setattr(ei.wa_chat_repository, "append_wa_message", AsyncMock())

    payload = {
        "event": "messages.upsert",
        "instance": iname,
        "data": {
            "messages": [
                {
                    "key": {
                        "remoteJid": "212777796939949@lid",
                        "remoteJidAlt": "554197594890@s.whatsapp.net",
                        "fromMe": False,
                    },
                    "message": {"conversation": "oi"},
                }
            ]
        },
    }
    await process_evolution_payload(AsyncMock(), payload)
    send.assert_awaited()
    assert send.await_args[0][1] == "554197594890"


@pytest.mark.asyncio
async def test_webhook_lid_sem_alt_envia_jid_lid_completo(monkeypatch, school_a_id):
    import evolution_inbound as ei

    iname = evolution_instance_name(school_a_id)
    cfg = MagicMock()
    cfg.data = {"isPaused": False, "tools": {}, "assistantName": "Bot"}
    send = AsyncMock(return_value=True)

    monkeypatch.setattr(ei, "get_config_by_school", AsyncMock(return_value=cfg))
    monkeypatch.setattr(
        ei.wa_chat_repository,
        "recent_history_for_contact",
        AsyncMock(return_value=[]),
    )
    monkeypatch.setattr(ei, "process_chat_message", AsyncMock(return_value={"text": "ok"}))
    monkeypatch.setattr(ei.evolution_service, "send_text", send)
    monkeypatch.setattr(ei.wa_chat_repository, "append_wa_message", AsyncMock())

    payload = {
        "event": "messages.upsert",
        "instance": iname,
        "data": {
            "messages": [
                {
                    "key": {
                        "remoteJid": "212777796939949@lid",
                        "fromMe": False,
                    },
                    "message": {"conversation": "oi"},
                }
            ]
        },
    }
    await process_evolution_payload(AsyncMock(), payload)
    send.assert_awaited()
    assert send.await_args[0][1] == "212777796939949@lid"


@pytest.mark.asyncio
async def test_webhook_senderPn_no_corpo_quando_lid_sem_alt(monkeypatch, school_a_id):
    import evolution_inbound as ei

    iname = evolution_instance_name(school_a_id)
    cfg = MagicMock()
    cfg.data = {"isPaused": False, "tools": {}, "assistantName": "Bot"}
    send = AsyncMock(return_value=True)

    monkeypatch.setattr(ei, "get_config_by_school", AsyncMock(return_value=cfg))
    monkeypatch.setattr(
        ei.wa_chat_repository,
        "recent_history_for_contact",
        AsyncMock(return_value=[]),
    )
    monkeypatch.setattr(ei, "process_chat_message", AsyncMock(return_value={"text": "ok"}))
    monkeypatch.setattr(ei.evolution_service, "send_text", send)
    monkeypatch.setattr(ei.wa_chat_repository, "append_wa_message", AsyncMock())

    payload = {
        "event": "messages.upsert",
        "instance": iname,
        "data": {
            "messages": [
                {
                    "key": {"remoteJid": "212777796939949@lid", "fromMe": False},
                    "senderPn": "554197594890@s.whatsapp.net",
                    "message": {"conversation": "oi"},
                }
            ]
        },
    }
    await process_evolution_payload(AsyncMock(), payload)
    send.assert_awaited()
    assert send.await_args[0][1] == "554197594890"


@pytest.mark.asyncio
async def test_webhook_remoteJidAlt_so_no_corpo_da_mensagem(monkeypatch, school_a_id):
    import evolution_inbound as ei

    iname = evolution_instance_name(school_a_id)
    cfg = MagicMock()
    cfg.data = {"isPaused": False, "tools": {}, "assistantName": "Bot"}
    send = AsyncMock(return_value=True)

    monkeypatch.setattr(ei, "get_config_by_school", AsyncMock(return_value=cfg))
    monkeypatch.setattr(
        ei.wa_chat_repository,
        "recent_history_for_contact",
        AsyncMock(return_value=[]),
    )
    monkeypatch.setattr(ei, "process_chat_message", AsyncMock(return_value={"text": "ok"}))
    monkeypatch.setattr(ei.evolution_service, "send_text", send)
    monkeypatch.setattr(ei.wa_chat_repository, "append_wa_message", AsyncMock())

    payload = {
        "event": "messages.upsert",
        "instance": iname,
        "data": {
            "messages": [
                {
                    "key": {"remoteJid": "212777796939949@lid", "fromMe": False},
                    "remoteJidAlt": "554197594890@s.whatsapp.net",
                    "message": {"conversation": "oi"},
                }
            ]
        },
    }
    await process_evolution_payload(AsyncMock(), payload)
    send.assert_awaited()
    assert send.await_args[0][1] == "554197594890"


@pytest.mark.asyncio
async def test_connection_state_evolution_falha_rede_nao_explode(monkeypatch):
    monkeypatch.setattr(settings, "evolution_api_url", "http://127.0.0.1:9")
    monkeypatch.setattr(settings, "evolution_api_key", "k")

    class Boom:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return None

        async def get(self, *a, **k):
            raise httpx.ConnectError("offline")

    monkeypatch.setattr("evolution_service.httpx.AsyncClient", lambda **kw: Boom())
    sid = uuid.uuid4()
    out = await evolution_service.connection_state_for_school(sid)
    assert out["configured"] is True
    assert out["connected"] is False


@pytest.mark.asyncio
async def test_create_instance_evolution_timeout_retorna_erro(monkeypatch):
    iname = evolution_instance_name(uuid.uuid4())

    class TimeoutClient:
        async def post(self, *a, **k):
            raise httpx.ReadTimeout("slow")

        async def get(self, *a, **k):
            raise httpx.ReadTimeout("slow")

    school = MagicMock()
    school.evolution_instance_token = None
    client = TimeoutClient()
    out = await evolution_service._ensure_instance_exists(client, AsyncMock(), school, iname)
    assert isinstance(out, dict)
    assert out.get("status") == "error"
    assert "Evolution API" in (out.get("message") or "")


def test_instance_token_from_create_hash_string():
    assert _instance_token_from_create_body({"hash": "plain_token"}) == "plain_token"


def test_instance_token_from_create_hash_dict_apikey():
    assert _instance_token_from_create_body({"hash": {"apikey": "k1"}}) == "k1"


def test_instance_token_from_create_instance_nested():
    assert _instance_token_from_create_body({"instance": {"token": "t2"}}) == "t2"
