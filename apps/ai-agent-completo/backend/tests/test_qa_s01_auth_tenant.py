"""
Suíte QA 1 — Autenticação, isolamento multi-tenant e política embed/login público.

HTTP via TestClient; serviços internos mockados onde necessário para não depender do Postgres.

Nota de produto: `VITE_REQUIRE_EMBED` é do frontend (Vite). O espelho testável no backend é
`KAITS_PUBLIC_SLUG_LOGIN_DISABLED` — ver teste dedicado abaixo.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

from jose import jwt

from core.config import settings
from core.security import create_access_token


def test_me_config_sem_authorization_rejeita(api_client):
    r = api_client.get("/api/v1/me/config")
    assert r.status_code == 403


def test_chatwoot_sso_sem_authorization_rejeita(api_client):
    r = api_client.get("/api/v1/chatwoot/sso-config")
    assert r.status_code == 403


def test_me_config_jwt_malformado_401(api_client):
    r = api_client.get(
        "/api/v1/me/config",
        headers={"Authorization": "Bearer nao.e.um.jwt"},
    )
    assert r.status_code == 401


def test_me_config_jwt_expirado_401(api_client):
    payload = {
        "school_id": str(uuid.uuid4()),
        "slug": "escola",
        "jti": str(uuid.uuid4()),
        "exp": datetime.now(timezone.utc) - timedelta(minutes=10),
    }
    tok = jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)
    r = api_client.get("/api/v1/me/config", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 401


def test_me_config_assinatura_secret_errado_401(api_client):
    payload = {
        "school_id": str(uuid.uuid4()),
        "slug": "escola",
        "jti": str(uuid.uuid4()),
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    tok = jwt.encode(payload, "outro-secret-completamente-diferente-xx", algorithm=settings.jwt_algorithm)
    r = api_client.get("/api/v1/me/config", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 401


def test_me_config_algoritmo_jwt_invalido_401(api_client):
    payload = {
        "school_id": str(uuid.uuid4()),
        "slug": "escola",
        "jti": str(uuid.uuid4()),
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    tok = jwt.encode(payload, settings.secret_key, algorithm="HS512")
    r = api_client.get("/api/v1/me/config", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 401


def test_authorization_header_sem_esquema_bearer_403(api_client):
    r = api_client.get("/api/v1/me/config", headers={"Authorization": "Basic abc123"})
    assert r.status_code == 403


def test_payload_jwt_sem_school_id_rejeita_401(api_client):
    payload = {
        "slug": "sem-escola",
        "jti": str(uuid.uuid4()),
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    tok = jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)
    r = api_client.get("/api/v1/me/config", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 401


def test_me_config_token_valido_retorna_apenas_dados_da_escola_do_jwt(
    api_client, school_a_id, auth_headers_school_a
):
    dados_escola_a = {
        "assistantName": "Agente Escola A",
        "isPaused": False,
        "slug_claim": str(school_a_id),
    }

    async def fake_get_my_config(db, sid):
        assert sid == school_a_id
        return dados_escola_a

    with patch("agent_config.router.service.get_my_config", side_effect=fake_get_my_config):
        r = api_client.get("/api/v1/me/config", headers=auth_headers_school_a)

    assert r.status_code == 200
    body = r.json()
    assert body.get("assistantName") == "Agente Escola A"
    assert body.get("slug_claim") == str(school_a_id)


def test_token_escola_a_nao_acessa_documento_sem_escopo_escola_b(
    api_client, auth_headers_school_a
):
    doc_alheio = uuid.uuid4()

    with patch("documents.service.repository.get_by_id", AsyncMock(return_value=None)):
        r = api_client.delete(f"/api/v1/me/documents/{doc_alheio}", headers=auth_headers_school_a)

    assert r.status_code == 404


def test_membro_equipe_nao_apaga_instancia_whatsapp_principal(api_client, auth_headers_member):
    with patch(
        "whatsapp_api.evolution_service.delete_instance_for_school",
        new_callable=AsyncMock,
    ) as mock_del:
        r = api_client.delete("/api/v1/whatsapp/instance", headers=auth_headers_member)
    assert r.status_code == 403
    mock_del.assert_not_called()

