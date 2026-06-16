"""
30 testes focados em SSO/embed (HMAC handshake) e Chatwoot identity HMAC.
Executar na pasta backend: pytest tests/test_sso_embed_30.py -q
"""

from __future__ import annotations

import hashlib
import hmac
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from chatwoot.service import generate_chatwoot_hmac
from core.config import settings
from jose import JWTError

from core.security import decode_access_token
from schools.models import School
from schools.schemas import EmbedHandshakeRequest
from schools.service import embed_handshake_school
from whatsapp_chat.models import WaChatMessage
from whatsapp_chat.repository import recent_history_for_contact


def _embed_sig(secret: str, slug: str, ts: int) -> str:
    msg = f"{slug}.{ts}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()


def _school(**kwargs) -> School:
    defaults = dict(
        id=uuid.uuid4(),
        name="Escola Teste",
        slug="escola-teste",
        password_hash="x",
        is_active=True,
        created_at=datetime.now(timezone.utc),
    )
    defaults.update(kwargs)
    return School(**defaults)


# --- Chatwoot HMAC (1–8) ---


def test_chatwoot_hmac_empty_when_identity_token_missing(monkeypatch):
    monkeypatch.setattr(settings, "chatwoot_identity_token", "")
    assert generate_chatwoot_hmac("user-1") == ""


def test_chatwoot_hmac_empty_when_identity_token_none(monkeypatch):
    monkeypatch.setattr(settings, "chatwoot_identity_token", None)
    assert generate_chatwoot_hmac("x") == ""


def test_chatwoot_hmac_deterministic(monkeypatch):
    monkeypatch.setattr(settings, "chatwoot_identity_token", "cw-secret-fixed")
    a = generate_chatwoot_hmac("escola-alpha")
    b = generate_chatwoot_hmac("escola-alpha")
    assert a == b and len(a) == 64


def test_chatwoot_hmac_differs_by_identifier(monkeypatch):
    monkeypatch.setattr(settings, "chatwoot_identity_token", "same-key")
    assert generate_chatwoot_hmac("a") != generate_chatwoot_hmac("b")


def test_chatwoot_hmac_unicode_identifier(monkeypatch):
    monkeypatch.setattr(settings, "chatwoot_identity_token", "k")
    h = generate_chatwoot_hmac("café-日本")
    assert len(h) == 64 and all(c in "0123456789abcdef" for c in h)


def test_chatwoot_hmac_long_identifier(monkeypatch):
    monkeypatch.setattr(settings, "chatwoot_identity_token", "token")
    long_id = "u" * 4000
    h = generate_chatwoot_hmac(long_id)
    assert len(h) == 64


def test_chatwoot_hmac_empty_identifier_still_hex(monkeypatch):
    monkeypatch.setattr(settings, "chatwoot_identity_token", "z")
    h = generate_chatwoot_hmac("")
    assert len(h) == 64


def test_chatwoot_hmac_uses_sha256_hex(monkeypatch):
    monkeypatch.setattr(settings, "chatwoot_identity_token", "ident")
    manual = hmac.new(b"ident", b"id", hashlib.sha256).hexdigest()
    assert generate_chatwoot_hmac("id") == manual


# --- Mensagem assinada embed (9–10) ---


def test_embed_message_bytes_are_slug_dot_ts():
    slug, ts = "colegio-x", 1700000000
    assert f"{slug}.{ts}".encode("utf-8") == b"colegio-x.1700000000"


def test_embed_sig_changes_if_ts_changes():
    sec = "s3cret"
    assert _embed_sig(sec, "a", 1) != _embed_sig(sec, "a", 2)


# --- embed_handshake_school (11–24) ---


@pytest.mark.asyncio
async def test_embed_handshake_success(monkeypatch):
    monkeypatch.setattr(settings, "embed_trust_secret", "trust-me")
    monkeypatch.setattr(settings, "embed_hmac_ttl_seconds", 600)
    sch = _school(slug="demo-slug")
    ts = int(datetime.now(timezone.utc).timestamp())
    sig = _embed_sig("trust-me", sch.slug, ts)
    body = EmbedHandshakeRequest(school_slug=sch.slug, ts=ts, sig=sig)
    mock_db = AsyncMock()
    with patch("schools.service.repository.get_school_by_slug", new=AsyncMock(return_value=sch)):
        with patch("schools.service.persist_login_session_after_token", new=AsyncMock()):
            out = await embed_handshake_school(mock_db, body)
    assert out.access_token
    assert out.school.slug == sch.slug
    pl = decode_access_token(out.access_token)
    assert pl.get("school_id") == str(sch.id)


@pytest.mark.asyncio
async def test_embed_handshake_school_not_found(monkeypatch):
    monkeypatch.setattr(settings, "embed_trust_secret", "t")
    monkeypatch.setattr(settings, "embed_hmac_ttl_seconds", 600)
    ts = int(datetime.now(timezone.utc).timestamp())
    sig = _embed_sig("t", "missing", ts)
    body = EmbedHandshakeRequest(school_slug="missing", ts=ts, sig=sig)
    mock_db = AsyncMock()
    with patch("schools.service.repository.get_school_by_slug", new=AsyncMock(return_value=None)):
        with pytest.raises(HTTPException) as ei:
            await embed_handshake_school(mock_db, body)
    assert ei.value.status_code == 401


@pytest.mark.asyncio
async def test_embed_handshake_school_inactive(monkeypatch):
    monkeypatch.setattr(settings, "embed_trust_secret", "t")
    monkeypatch.setattr(settings, "embed_hmac_ttl_seconds", 600)
    sch = _school(slug="off", is_active=False)
    ts = int(datetime.now(timezone.utc).timestamp())
    sig = _embed_sig("t", sch.slug, ts)
    body = EmbedHandshakeRequest(school_slug=sch.slug, ts=ts, sig=sig)
    mock_db = AsyncMock()
    with patch("schools.service.repository.get_school_by_slug", new=AsyncMock(return_value=sch)):
        with pytest.raises(HTTPException) as ei:
            await embed_handshake_school(mock_db, body)
    assert ei.value.status_code == 401


@pytest.mark.asyncio
async def test_embed_handshake_ts_too_old(monkeypatch):
    monkeypatch.setattr(settings, "embed_trust_secret", "t")
    monkeypatch.setattr(settings, "embed_hmac_ttl_seconds", 60)
    now = int(datetime.now(timezone.utc).timestamp())
    ts = now - 120
    sig = _embed_sig("t", "any", ts)
    body = EmbedHandshakeRequest(school_slug="any", ts=ts, sig=sig)
    mock_db = AsyncMock()
    with pytest.raises(HTTPException) as ei:
        await embed_handshake_school(mock_db, body)
    assert ei.value.status_code == 401


@pytest.mark.asyncio
async def test_embed_handshake_ts_too_far_future(monkeypatch):
    monkeypatch.setattr(settings, "embed_trust_secret", "t")
    monkeypatch.setattr(settings, "embed_hmac_ttl_seconds", 60)
    now = int(datetime.now(timezone.utc).timestamp())
    ts = now + 99999
    sig = _embed_sig("t", "any", ts)
    body = EmbedHandshakeRequest(school_slug="any", ts=ts, sig=sig)
    mock_db = AsyncMock()
    with pytest.raises(HTTPException) as ei:
        await embed_handshake_school(mock_db, body)
    assert ei.value.status_code == 401


@pytest.mark.asyncio
async def test_embed_handshake_wrong_sig(monkeypatch):
    monkeypatch.setattr(settings, "embed_trust_secret", "secret")
    monkeypatch.setattr(settings, "embed_hmac_ttl_seconds", 600)
    sch = _school()
    ts = int(datetime.now(timezone.utc).timestamp())
    body = EmbedHandshakeRequest(school_slug=sch.slug, ts=ts, sig="0" * 64)
    mock_db = AsyncMock()
    with patch("schools.service.repository.get_school_by_slug", new=AsyncMock(return_value=sch)):
        with pytest.raises(HTTPException) as ei:
            await embed_handshake_school(mock_db, body)
    assert ei.value.status_code == 401


@pytest.mark.asyncio
async def test_embed_handshake_sig_wrong_length(monkeypatch):
    monkeypatch.setattr(settings, "embed_trust_secret", "secret")
    monkeypatch.setattr(settings, "embed_hmac_ttl_seconds", 600)
    sch = _school()
    ts = int(datetime.now(timezone.utc).timestamp())
    body = EmbedHandshakeRequest(school_slug=sch.slug, ts=ts, sig="ab" * 31)  # 62 chars
    mock_db = AsyncMock()
    with patch("schools.service.repository.get_school_by_slug", new=AsyncMock(return_value=sch)):
        with pytest.raises(HTTPException) as ei:
            await embed_handshake_school(mock_db, body)
    assert ei.value.status_code == 401


@pytest.mark.asyncio
async def test_embed_handshake_secret_only_whitespace(monkeypatch):
    monkeypatch.setattr(settings, "embed_trust_secret", "   \n\t  ")
    ts = int(datetime.now(timezone.utc).timestamp())
    body = EmbedHandshakeRequest(school_slug="x", ts=ts, sig="0" * 64)
    mock_db = AsyncMock()
    with pytest.raises(HTTPException) as ei:
        await embed_handshake_school(mock_db, body)
    assert ei.value.status_code == 503


@pytest.mark.asyncio
async def test_embed_handshake_uppercase_sig_accepted(monkeypatch):
    monkeypatch.setattr(settings, "embed_trust_secret", "k")
    monkeypatch.setattr(settings, "embed_hmac_ttl_seconds", 600)
    sch = _school(slug="slug-up")
    ts = int(datetime.now(timezone.utc).timestamp())
    sig_lower = _embed_sig("k", sch.slug, ts)
    body = EmbedHandshakeRequest(school_slug=sch.slug, ts=ts, sig=sig_lower.upper())
    mock_db = AsyncMock()
    with patch("schools.service.repository.get_school_by_slug", new=AsyncMock(return_value=sch)):
        with patch("schools.service.persist_login_session_after_token", new=AsyncMock()):
            out = await embed_handshake_school(mock_db, body)
    assert out.access_token


@pytest.mark.asyncio
async def test_embed_handshake_ts_at_exact_ttl_boundary_allowed(monkeypatch):
    """abs(now - ts) > ttl rejeita; no limiar abs == ttl deve aceitar."""
    monkeypatch.setattr(settings, "embed_trust_secret", "sec")
    ttl = 100
    monkeypatch.setattr(settings, "embed_hmac_ttl_seconds", ttl)
    fixed_now = datetime(2026, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
    ts = int((fixed_now - timedelta(seconds=ttl)).timestamp())

    class _FixedDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return fixed_now

    sig = _embed_sig("sec", "edge", ts)
    body = EmbedHandshakeRequest(school_slug="edge", ts=ts, sig=sig)
    sch = _school(slug="edge")
    mock_db = AsyncMock()
    with patch("schools.service.datetime", _FixedDatetime):
        with patch("schools.service.repository.get_school_by_slug", new=AsyncMock(return_value=sch)):
            with patch("schools.service.persist_login_session_after_token", new=AsyncMock()):
                out = await embed_handshake_school(mock_db, body)
    assert out.access_token


@pytest.mark.asyncio
async def test_embed_handshake_ts_one_second_beyond_ttl_rejected(monkeypatch):
    monkeypatch.setattr(settings, "embed_trust_secret", "sec")
    ttl = 100
    monkeypatch.setattr(settings, "embed_hmac_ttl_seconds", ttl)
    fixed_now = datetime(2026, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
    ts = int((fixed_now - timedelta(seconds=ttl + 1)).timestamp())

    class _FixedDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return fixed_now

    sig = _embed_sig("sec", "edge2", ts)
    body = EmbedHandshakeRequest(school_slug="edge2", ts=ts, sig=sig)
    mock_db = AsyncMock()
    with patch("schools.service.datetime", _FixedDatetime):
        with pytest.raises(HTTPException) as ei:
            await embed_handshake_school(mock_db, body)
    assert ei.value.status_code == 401


@pytest.mark.asyncio
async def test_embed_handshake_persist_session_called_with_school_id(monkeypatch):
    monkeypatch.setattr(settings, "embed_trust_secret", "p")
    monkeypatch.setattr(settings, "embed_hmac_ttl_seconds", 600)
    sch = _school()
    ts = int(datetime.now(timezone.utc).timestamp())
    sig = _embed_sig("p", sch.slug, ts)
    body = EmbedHandshakeRequest(school_slug=sch.slug, ts=ts, sig=sig)
    mock_db = AsyncMock()
    persist = AsyncMock()
    with patch("schools.service.repository.get_school_by_slug", new=AsyncMock(return_value=sch)):
        with patch("schools.service.persist_login_session_after_token", new=persist):
            out = await embed_handshake_school(mock_db, body)
    persist.assert_awaited_once()
    call_kw = persist.await_args
    assert call_kw[0][1] == sch.id
    assert call_kw[0][2] == out.access_token


@pytest.mark.asyncio
async def test_embed_jwt_contains_slug_claim(monkeypatch):
    monkeypatch.setattr(settings, "embed_trust_secret", "s")
    monkeypatch.setattr(settings, "embed_hmac_ttl_seconds", 600)
    sch = _school(slug="jwt-slug-test")
    ts = int(datetime.now(timezone.utc).timestamp())
    sig = _embed_sig("s", sch.slug, ts)
    body = EmbedHandshakeRequest(school_slug=sch.slug, ts=ts, sig=sig)
    mock_db = AsyncMock()
    with patch("schools.service.repository.get_school_by_slug", new=AsyncMock(return_value=sch)):
        with patch("schools.service.persist_login_session_after_token", new=AsyncMock()):
            out = await embed_handshake_school(mock_db, body)
    pl = decode_access_token(out.access_token)
    assert pl.get("slug") == "jwt-slug-test"


# --- Histórico WA formato / mocks (25–30) ---


@pytest.mark.asyncio
async def test_recent_history_maps_roles_to_from_field():
    """Ordem cronológica e mapeamento user/ai sem DB real."""
    sid = uuid.uuid4()
    t0 = datetime(2026, 4, 1, 10, 0, 0, tzinfo=timezone.utc)
    t1 = t0 + timedelta(minutes=1)

    m0 = WaChatMessage(
        school_id=sid, contact_e164="5511999990000", role="user", body="Oi", created_at=t0
    )
    m1 = WaChatMessage(
        school_id=sid,
        contact_e164="5511999990000",
        role="assistant",
        body="Olá",
        created_at=t1,
    )

    class _Scalar:
        def __init__(self, rows):
            self._rows = rows

        def all(self):
            return self._rows

    class _Result:
        def __init__(self, rows):
            self._rows = rows

        def scalars(self):
            return _Scalar(self._rows)

    mock_db = AsyncMock()

    async def _exec(stmt):
        return _Result([m1, m0])

    mock_db.execute = _exec
    hist = await recent_history_for_contact(
        mock_db, school_id=sid, contact_e164="5511999990000", limit=10
    )
    assert hist == [{"from": "user", "text": "Oi"}, {"from": "ai", "text": "Olá"}]


@pytest.mark.asyncio
async def test_recent_history_queries_database():
    class _Empty:
        def scalars(self):
            return self

        def all(self):
            return []

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=_Empty())
    await recent_history_for_contact(
        mock_db, school_id=uuid.uuid4(), contact_e164="5511987654321", limit=7
    )
    mock_db.execute.assert_awaited_once()


def test_decode_access_token_rejects_invalid_jwt():
    with pytest.raises(JWTError):
        decode_access_token("não-é-um-jwt-válido")


def test_wa_chat_message_tablename():
    assert WaChatMessage.__tablename__ == "wa_chat_messages"


def test_two_slugs_same_ts_produce_different_embed_sigs():
    ts = 1700000000
    sec = "one-secret"
    assert _embed_sig(sec, "school-a", ts) != _embed_sig(sec, "school-b", ts)


def test_embed_sig_different_secrets_differ():
    ts = 1
    assert _embed_sig("a", "s", ts) != _embed_sig("b", "s", ts)


@pytest.mark.asyncio
async def test_embed_handshake_wrong_slug_in_message_still_valid_hmac_but_unknown_school(monkeypatch):
    """Assinatura válida para slug X mas pedido com slug Y — repositório devolve None para Y."""
    monkeypatch.setattr(settings, "embed_trust_secret", "z")
    monkeypatch.setattr(settings, "embed_hmac_ttl_seconds", 600)
    ts = int(datetime.now(timezone.utc).timestamp())
    sig_for_alpha = _embed_sig("z", "alpha", ts)
    body = EmbedHandshakeRequest(school_slug="beta", ts=ts, sig=sig_for_alpha)
    mock_db = AsyncMock()
    with patch("schools.service.repository.get_school_by_slug", new=AsyncMock(return_value=None)):
        with pytest.raises(HTTPException) as ei:
            await embed_handshake_school(mock_db, body)
    assert ei.value.status_code == 401


@pytest.mark.asyncio
async def test_embed_handshake_sig_for_different_ts_rejected(monkeypatch):
    monkeypatch.setattr(settings, "embed_trust_secret", "k")
    monkeypatch.setattr(settings, "embed_hmac_ttl_seconds", 600)
    sch = _school(slug="ts-mismatch")
    ts_req = int(datetime.now(timezone.utc).timestamp())
    sig_other = _embed_sig("k", sch.slug, ts_req - 50)
    body = EmbedHandshakeRequest(school_slug=sch.slug, ts=ts_req, sig=sig_other)
    mock_db = AsyncMock()
    with patch("schools.service.repository.get_school_by_slug", new=AsyncMock(return_value=sch)):
        with pytest.raises(HTTPException) as ei:
            await embed_handshake_school(mock_db, body)
    assert ei.value.status_code == 401
