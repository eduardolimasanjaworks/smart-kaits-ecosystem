"""Comportamento opcional MOCK_LOGIN_AUTO_PROVISION_SCHOOL no login escola."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from core.config import settings
from schools.schemas import LoginRequest
from schools.service import login_school


@pytest.mark.asyncio
async def test_mock_provision_off_unknown_slug_is_401(monkeypatch):
    monkeypatch.setattr(settings, "mock_login_auto_provision_school", False)
    mock_db = AsyncMock()
    with patch(
        "schools.service.repository.get_school_by_slug",
        new_callable=AsyncMock,
        return_value=None,
    ):
        with pytest.raises(HTTPException) as ei:
            await login_school(mock_db, LoginRequest(slug="escola-novinha", password="senha12345"))
    assert ei.value.status_code == 401


@pytest.mark.asyncio
async def test_mock_provision_on_short_slug_is_400(monkeypatch):
    monkeypatch.setattr(settings, "mock_login_auto_provision_school", True)
    mock_db = AsyncMock()
    with patch(
        "schools.service.repository.get_school_by_slug",
        new_callable=AsyncMock,
        return_value=None,
    ):
        with pytest.raises(HTTPException) as ei:
            await login_school(mock_db, LoginRequest(slug="ab", password="senha12345"))
    assert ei.value.status_code == 400


@pytest.mark.asyncio
async def test_mock_provision_on_invalid_slug_chars_is_400(monkeypatch):
    monkeypatch.setattr(settings, "mock_login_auto_provision_school", True)
    mock_db = AsyncMock()
    with patch(
        "schools.service.repository.get_school_by_slug",
        new_callable=AsyncMock,
        return_value=None,
    ):
        with pytest.raises(HTTPException) as ei:
            await login_school(mock_db, LoginRequest(slug="Escola Errada", password="senha12345"))
    assert ei.value.status_code == 400
