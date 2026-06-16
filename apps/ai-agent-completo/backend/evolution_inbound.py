"""
Processa eventos recebidos da Evolution API (webhook) e responde no WhatsApp com RAG da escola.
"""

from __future__ import annotations

import base64
import binascii
import json
import logging
import re
from uuid import UUID

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from agent_config.repository import get_config_by_school
from ai.assistant import process_chat_message
from ai.transcription import transcribe_audio_bytes
from evolution_service import evolution_service, school_id_from_evolution_instance
from whatsapp_chat import repository as wa_chat_repository

logger = logging.getLogger(__name__)

# Limite seguro por bolha WhatsApp (Evolution sendText); respostas longas viram várias mensagens.
_MAX_SEND_CHARS = 3500


def _split_reply_for_whatsapp(text: str, max_len: int = _MAX_SEND_CHARS) -> list[str]:
    """Parte o texto em até max_len caracteres, preferindo quebras de linha."""
    t = (text or "").strip()
    if not t:
        return []
    if len(t) <= max_len:
        return [t]
    parts: list[str] = []
    rest = t
    while rest:
        if len(rest) <= max_len:
            parts.append(rest)
            break
        chunk = rest[:max_len]
        cut = chunk.rfind("\n\n")
        if cut < max_len // 4:
            cut = chunk.rfind("\n")
        if cut < max_len // 4:
            cut = max_len
        parts.append(rest[:cut].strip())
        rest = rest[cut:].strip()
    return [p for p in parts if p]


def _normalize_event(raw: str) -> str:
    return str(raw or "").replace(".", "_").upper()


def _digits_from_remote_jid(remote_jid: str) -> str | None:
    if not remote_jid or "@g.us" in remote_jid:
        return None
    m = re.match(r"^(\d+)(?:@|\D)", remote_jid)
    if m:
        return m.group(1)
    m2 = re.match(r"^(\d{10,15})$", remote_jid)
    return m2.group(1) if m2 else None


def _message_key(msg: dict) -> dict:
    """Monta o `key`; webhooks às vezes trazem `remoteJidAlt` / `senderPn` só no corpo da mensagem."""
    raw = msg.get("key") if isinstance(msg.get("key"), dict) else {}
    key = dict(raw)
    if not isinstance(msg, dict):
        return key
    if not key.get("remoteJidAlt"):
        alt = msg.get("remoteJidAlt")
        if isinstance(alt, str) and alt.strip():
            key["remoteJidAlt"] = alt.strip()
    if not key.get("senderPn"):
        sp = msg.get("senderPn")
        if isinstance(sp, str) and sp.strip():
            key["senderPn"] = sp.strip()
    return key


def _pn_jid_from_key_when_lid(key: dict) -> str | None:
    """JID de telefone quando o Baileys manda `remoteJid` em `@lid`."""
    alt = str(key.get("remoteJidAlt") or "").strip()
    alt_low = alt.lower()
    if alt and ("@s.whatsapp.net" in alt_low or alt_low.endswith("@c.us")):
        return alt
    sender_pn = str(key.get("senderPn") or "").strip()
    sp_low = sender_pn.lower()
    if sender_pn and ("@s.whatsapp.net" in sp_low or sp_low.endswith("@c.us")):
        return sender_pn
    return None


def _effective_remote_jid_for_pn(key: dict) -> str:
    """
    O WhatsApp/Baileys às vezes envia `remoteJid` em `@lid`. O JID de telefone pode vir em
    `remoteJidAlt` ou `senderPn` (Baileys recente). Sem isso, o envio pela HTTP da Evolution
    costuma falhar (exists: false).
    """
    if not isinstance(key, dict):
        return ""
    rj = str(key.get("remoteJid") or "").strip()
    if rj.lower().endswith("@lid"):
        pn = _pn_jid_from_key_when_lid(key)
        if pn:
            return pn
    return rj


def _send_recipient_and_contact(key: dict) -> tuple[str, str] | None:
    """
    Retorna (valor para Evolution `sendText.number`, id estável para histórico no PG).

    Sem `remoteJidAlt` PN, um `...@lid` não pode virar só dígitos — a Evolution interpreta como
    `@s.whatsapp.net` e devolve exists:false. Nesse caso o destino do envio é o JID completo `@lid`.
    """
    remote = _effective_remote_jid_for_pn(key)
    if not remote:
        return None
    low = remote.lower()
    if low.endswith("@lid"):
        pn_jid = _pn_jid_from_key_when_lid(key)
        if pn_jid:
            digits = _digits_from_remote_jid(pn_jid)
            if digits:
                return (digits, digits)
        alt = str(key.get("remoteJidAlt") or "").strip()
        alt_low = alt.lower()
        if alt and ("@s.whatsapp.net" in alt_low or alt_low.endswith("@c.us")):
            digits = _digits_from_remote_jid(alt)
            if digits:
                return (digits, digits)
        lid_digits = _digits_from_remote_jid(remote)
        contact = lid_digits if lid_digits else remote.split("@", 1)[0]
        return (remote, contact)
    digits = _digits_from_remote_jid(remote)
    if digits:
        return (digits, digits)
    return None


def _extract_text(msg: dict) -> str | None:
    inner = msg.get("message") or {}
    if isinstance(inner.get("conversation"), str) and inner["conversation"].strip():
        return inner["conversation"].strip()
    et = inner.get("extendedTextMessage") or {}
    if isinstance(et.get("text"), str) and et["text"].strip():
        return et["text"].strip()
    img = inner.get("imageMessage") or {}
    if isinstance(img.get("caption"), str) and img["caption"].strip():
        return img["caption"].strip()
    return None


def _audio_filename_from_mimetype(mimetype: str | None) -> str:
    if not mimetype:
        return "audio.ogg"
    low = mimetype.lower().split(";")[0].strip()
    if "mpeg" in low or low.endswith("/mp3"):
        return "audio.mp3"
    if "ogg" in low or "opus" in low:
        return "audio.ogg"
    if "wav" in low:
        return "audio.wav"
    if "m4a" in low or "mp4" in low:
        return "audio.m4a"
    if "webm" in low:
        return "audio.webm"
    return "audio.bin"


def _audio_dict_from_inner(inner: dict) -> dict | None:
    if not isinstance(inner, dict):
        return None
    am = inner.get("audioMessage")
    if isinstance(am, dict) and am:
        return am
    ptv = inner.get("ptvMessage")
    if isinstance(ptv, dict) and ptv:
        return ptv
    doc = inner.get("documentMessage")
    if isinstance(doc, dict):
        mime = doc.get("mimetype")
        if isinstance(mime, str) and mime.startswith("audio/"):
            return doc
    return None


async def _load_audio_bytes_from_msg(msg: dict) -> tuple[bytes, str] | None:
    """Baixa ou decodifica áudio da mensagem Baileys / Evolution."""
    inner = msg.get("message") or {}
    audio = _audio_dict_from_inner(inner if isinstance(inner, dict) else {})
    if not audio:
        return None

    b64 = audio.get("base64")
    if isinstance(b64, str) and b64.strip():
        try:
            raw = base64.standard_b64decode(b64.strip())
            fn = _audio_filename_from_mimetype(
                audio.get("mimetype") if isinstance(audio.get("mimetype"), str) else None
            )
            return raw, fn
        except (ValueError, binascii.Error):
            logger.warning("Falha ao decodificar base64 de áudio.")
            return None

    url = audio.get("url")
    if isinstance(url, str) and url.startswith(("http://", "https://")):
        try:
            timeout = httpx.Timeout(45.0, connect=10.0)
            async with httpx.AsyncClient(timeout=timeout) as client:
                res = await client.get(url)
                res.raise_for_status()
                fn = _audio_filename_from_mimetype(
                    audio.get("mimetype") if isinstance(audio.get("mimetype"), str) else None
                )
                return res.content, fn
        except httpx.HTTPError as e:
            logger.warning("Download de áudio falhou: %s", e)
            return None

    return None


async def _extract_user_content(msg: dict) -> str | None:
    """Texto direto ou transcrição Whisper para mensagens de áudio."""
    direct = _extract_text(msg)
    if direct:
        return direct
    loaded = await _load_audio_bytes_from_msg(msg)
    if not loaded:
        return None
    raw, fn = loaded
    return await transcribe_audio_bytes(audio_bytes=raw, filename=fn)


def _coerce_data_block(payload: dict) -> dict:
    data = payload.get("data")
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except json.JSONDecodeError:
            data = {}
    if not isinstance(data, dict):
        data = {}
    return data


def _iter_messages(payload: dict, data: dict) -> list[dict]:
    msgs = data.get("messages")
    if isinstance(msgs, list):
        return [m for m in msgs if isinstance(m, dict)]
    if isinstance(msgs, dict):
        return [msgs]
    if "key" in data and "message" in data:
        return [data]
    return []


async def process_evolution_payload(db: AsyncSession, payload: dict) -> None:
    if isinstance(payload, list):
        for item in payload:
            if isinstance(item, dict):
                await process_evolution_payload(db, item)
        return

    event = _normalize_event(str(payload.get("event") or ""))
    instance = payload.get("instance") or payload.get("instanceName")
    if not isinstance(instance, str):
        return

    school_uuid = school_id_from_evolution_instance(instance)
    if school_uuid is None:
        logger.debug("Instância não reconhecida como escola Smart Kaits: %s", instance)
        return

    if event != "MESSAGES_UPSERT":
        return

    data = _coerce_data_block(payload)
    if isinstance(data, list):
        msg_list = [m for m in data if isinstance(m, dict)]
    else:
        msg_list = _iter_messages(payload, data)
    for msg in msg_list:
        await _handle_one_message(db, school_uuid, instance, msg)


async def _handle_one_message(
    db: AsyncSession,
    school_uuid: UUID,
    instance_name: str,
    msg: dict,
) -> None:
    key = _message_key(msg)
    if key.get("fromMe"):
        return

    rj_raw = str(key.get("remoteJid") or "").strip()
    if rj_raw.lower().endswith("@lid") and _pn_jid_from_key_when_lid(key) is None:
        logger.warning(
            "WhatsApp LID sem JID de telefone no webhook (remoteJidAlt/senderPn úteis vazios). "
            "A Evolution atendai v2.2.x tende a responder sendText 400 exists:false. "
            "Opções: usar EVOLUTION_DOCKER_IMAGE=evoapicloud/evolution-api:latest (compose raiz), atualizar Evolution quando sair fix oficial de @lid, ou contato salvo na agenda do WhatsApp Business. "
            "remoteJid=%r remoteJidAlt=%r senderPn=%r",
            key.get("remoteJid"),
            key.get("remoteJidAlt"),
            key.get("senderPn"),
        )

    ids = _send_recipient_and_contact(key)
    if not ids:
        logger.warning(
            "WhatsApp: não deu para obter destino de envio (remoteJid=%s remoteJidAlt=%s senderPn=%s). Mensagem ignorada.",
            key.get("remoteJid"),
            key.get("remoteJidAlt"),
            key.get("senderPn"),
        )
        return
    send_recipient, number = ids

    try:
        text = await _extract_user_content(msg)
    except ValueError:
        await evolution_service.send_text(
            instance_name,
            send_recipient,
            "Não foi possível processar este áudio (vazio ou grande demais).",
        )
        return
    except Exception:
        logger.exception("Falha na transcrição de áudio escola=%s", school_uuid)
        await evolution_service.send_text(
            instance_name,
            send_recipient,
            "Não consegui transcrever o áudio. Envie em texto ou tente outro arquivo.",
        )
        return

    if not text:
        return

    cfg = await get_config_by_school(db, school_uuid)
    if not cfg:
        logger.warning("Sem AgentConfig para escola %s — ignorando WhatsApp.", school_uuid)
        return

    agent = cfg.data
    if agent.get("isPaused"):
        await evolution_service.send_text(
            instance_name,
            send_recipient,
            "No momento o atendimento automático está pausado. Procure a escola pelos canais oficiais.",
        )
        return

    try:
        history = await wa_chat_repository.recent_history_for_contact(
            db,
            school_id=school_uuid,
            contact_e164=number,
            limit=14,
        )
        result = await process_chat_message(
            user_message=text,
            school_id=str(school_uuid),
            agent_config=agent,
            chat_history=history,
        )
        reply = (result.get("text") or "").strip()
        if not reply:
            reply = "Não consegui formular uma resposta agora."
        bubbles = _split_reply_for_whatsapp(reply)
        if not bubbles:
            bubbles = ["Não consegui formular uma resposta agora."]
        await wa_chat_repository.append_wa_message(
            db,
            school_id=school_uuid,
            contact_e164=number,
            role="user",
            body=text,
        )
        combined_sent = []
        for i, bubble in enumerate(bubbles):
            ok = await evolution_service.send_text(instance_name, send_recipient, bubble)
            if not ok:
                logger.warning(
                    "send_text falhou escola=%s parte=%s/%s",
                    school_uuid,
                    i + 1,
                    len(bubbles),
                )
            combined_sent.append(bubble)
        await wa_chat_repository.append_wa_message(
            db,
            school_id=school_uuid,
            contact_e164=number,
            role="assistant",
            body="\n\n---\n\n".join(combined_sent),
        )
    except Exception:
        logger.exception("Erro ao gerar/enviar resposta WhatsApp escola=%s", school_uuid)
        await evolution_service.send_text(
            instance_name,
            send_recipient,
            "Tive um problema técnico para responder. Tente de novo em instantes.",
        )
