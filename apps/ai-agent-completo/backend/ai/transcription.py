"""
Transcrição de áudio (WhatsApp / Evolution) via OpenAI Whisper.

Usado pelo webhook quando a mensagem é áudio em vez de texto.
"""

from __future__ import annotations

import io
import logging

from ai.client import openai_client

logger = logging.getLogger(__name__)

# Limite conservador (bytes) antes de enviar ao Whisper — evita OOM / rejeição da API.
MAX_AUDIO_BYTES = 25 * 1024 * 1024


async def transcribe_audio_bytes(*, audio_bytes: bytes, filename: str) -> str:
    """
    Envia bytes de áudio para o modelo whisper-1 e devolve o texto transcrito.

    Raises:
        ValueError: áudio vazio ou acima do limite.
    """
    if not audio_bytes:
        raise ValueError("Áudio vazio.")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise ValueError("Áudio excede o tamanho máximo permitido.")

    buf = io.BytesIO(audio_bytes)
    buf.name = filename or "audio.ogg"

    resp = await openai_client.audio.transcriptions.create(
        model="whisper-1",
        file=buf,
    )
    text = getattr(resp, "text", None) or ""
    return text.strip()
