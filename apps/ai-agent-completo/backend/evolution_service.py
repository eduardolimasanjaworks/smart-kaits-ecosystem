"""
Integração Evolution API v2 — uma instância WhatsApp por escola (nome determinístico sk_<uuid_hex>).
Configura webhook para o Smart Kaits responder com RAG da mesma escola.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from schools import repository
from schools.models import School

logger = logging.getLogger(__name__)


def evolution_configured() -> bool:
    return bool((settings.evolution_api_url or "").strip() and (settings.evolution_api_key or "").strip())


def evolution_instance_name(school_id: uuid.UUID) -> str:
    """Nome estável da instância na Evolution (sem caracteres especiais)."""
    return f"sk_{school_id.hex}"


def school_id_from_evolution_instance(instance_name: str) -> uuid.UUID | None:
    if not instance_name.startswith("sk_") or len(instance_name) != 3 + 32:
        return None
    try:
        return uuid.UUID(hex=instance_name[3:])
    except ValueError:
        return None


def _evo_url(path: str) -> str:
    base = (settings.evolution_api_url or "").rstrip("/")
    p = path if path.startswith("/") else f"/{path}"
    return f"{base}{p}"


def _headers() -> dict[str, str]:
    key = (settings.evolution_api_key or "").strip()
    return {
        "apikey": key,
        "Content-Type": "application/json",
    }


def _webhook_url() -> str | None:
    base = (settings.evolution_webhook_public_base or "").strip().rstrip("/")
    if not base:
        return None
    return f"{base}/api/v1/webhooks/evolution"


def _instance_token_from_create_body(data: Any) -> str | None:
    """Extrai token/apikey da resposta POST /instance/create (hash pode ser dict ou string)."""
    if not isinstance(data, dict):
        return None
    h = data.get("hash")
    if isinstance(h, dict):
        v = h.get("apikey")
        if isinstance(v, str) and v.strip():
            return v.strip()
    elif isinstance(h, str) and h.strip():
        return h.strip()
    inst = data.get("instance")
    if isinstance(inst, dict):
        for k in ("token", "apikey", "instanceToken"):
            v = inst.get(k)
            if isinstance(v, str) and v.strip():
                return v.strip()
        ih = inst.get("hash")
        if isinstance(ih, dict):
            v = ih.get("apikey")
            if isinstance(v, str) and v.strip():
                return v.strip()
        elif isinstance(ih, str) and ih.strip():
            return ih.strip()
    return None


def _instances_from_fetch_payload(data: Any) -> list[dict[str, Any]]:
    """Normaliza o JSON de GET /instance/fetchInstances para lista de dicts."""
    instances: list[Any] = []
    if isinstance(data, list):
        instances = data
    elif isinstance(data, dict):
        inst = data.get("instance")
        if isinstance(inst, list):
            instances = inst
        elif isinstance(inst, dict):
            instances = [inst]
        resp = data.get("response")
        if isinstance(resp, dict) and isinstance(resp.get("instance"), list):
            instances = resp["instance"]
        elif isinstance(resp, list):
            instances = resp
    out: list[dict[str, Any]] = []
    for row in instances:
        if isinstance(row, dict):
            out.append(row)
    return out


def _row_instance_name(row: dict[str, Any]) -> str | None:
    inner = row.get("instance")
    if isinstance(inner, dict):
        n = inner.get("instanceName") or inner.get("name")
        if isinstance(n, str) and n.strip():
            return n.strip()
    n = row.get("instanceName") or row.get("name")
    return str(n).strip() if isinstance(n, str) and n.strip() else None


def _flatten_connect_payload(data: Any) -> dict[str, Any]:
    """Evolution pode devolver o objeto qrCode plano ou dentro de data/response/qrcode/instance."""
    if isinstance(data, list) and data:
        data = data[0]
    if not isinstance(data, dict):
        return {}
    merged: dict[str, Any] = dict(data)
    for key in ("data", "response", "result"):
        inner = data.get(key)
        if isinstance(inner, dict):
            merged = {**inner, **merged}
    inst = merged.get("instance")
    if isinstance(inst, dict):
        merged = {**inst, **merged}
    q = merged.get("qrcode")
    if isinstance(q, dict):
        if isinstance(q.get("base64"), str):
            merged.setdefault("base64", q.get("base64"))
        if isinstance(q.get("pairingCode"), str):
            merged.setdefault("pairingCode", q.get("pairingCode"))
        if isinstance(q.get("code"), str):
            merged.setdefault("code", q.get("code"))
        if isinstance(q.get("count"), int):
            merged.setdefault("count", q.get("count"))
    return merged


def _looks_like_wa_session_ref(s: str) -> bool:
    """Campo `code` na Evolution é referência de sessão Baileys (ex.: 2@...), não PNG."""
    t = (s or "").strip()
    return bool(t) and (t.startswith("2@") or t.startswith("3@"))


def _is_plausible_qr_base64(s: str) -> bool:
    t = (s or "").strip().replace("\n", "").replace("\r", "")
    if len(t) < 80:
        return False
    if "data:image/" in (s or "")[:120]:
        return True
    if t.startswith("iVBORw0KGgo"):
        return True
    if t.startswith("/9j/"):
        return True
    return False


def extract_qr_base64_from_connect_payload(data: Any) -> str | None:
    """Extrai imagem QR (base64); ignora `code` de sessão WhatsApp."""
    d = _flatten_connect_payload(data)
    candidates: list[str] = []
    q = d.get("qrcode")
    if isinstance(q, str) and _is_plausible_qr_base64(q) and not _looks_like_wa_session_ref(q):
        return q.strip()
    if isinstance(q, dict):
        for k in ("base64", "base64Image"):
            v = q.get(k)
            if isinstance(v, str):
                candidates.append(v)
    for k in ("base64", "base64Image"):
        v = d.get(k)
        if isinstance(v, str):
            candidates.append(v)
    for c in candidates:
        if _is_plausible_qr_base64(c) and not _looks_like_wa_session_ref(c):
            return c.strip()
    return None


def extract_pairing_from_connect_payload(data: Any) -> str | None:
    d = _flatten_connect_payload(data)
    q = d.get("qrcode")
    for src in (d, q if isinstance(q, dict) else {}):
        if not isinstance(src, dict):
            continue
        p = src.get("pairingCode")
        if isinstance(p, str) and p.strip():
            return p.strip()
    return None


def connect_payload_reports_error(data: Any) -> str | None:
    """Evolution às vezes responde HTTP 200 com { error: true, message: ... }."""
    d = _flatten_connect_payload(data)
    if d.get("error") is True:
        return str(d.get("message") or "Erro retornado pela Evolution no connect.")
    return None


def _webhook_block() -> dict[str, Any] | None:
    url = _webhook_url()
    if not url:
        return None
    block: dict[str, Any] = {
        "url": url,
        "byEvents": False,
        "base64": False,
        "events": [
            "MESSAGES_UPSERT",
            "CONNECTION_UPDATE",
            "QRCODE_UPDATED",
        ],
    }
    sec = (settings.evolution_webhook_secret or "").strip()
    if sec:
        block["headers"] = {"X-Smart-Kaits-Webhook-Secret": sec}
    return block


class EvolutionService:
    async def _fetch_all_evolution_instance_names(
        self, client: httpx.AsyncClient
    ) -> set[str] | None:
        """
        Lista completa de nomes num único GET /instance/fetchInstances (sem filtro).
        Existência: `iname in conjunto`. None = falha de rede/HTTP — não inferir «não existe».
        """
        url = _evo_url("/instance/fetchInstances")
        try:
            res = await client.get(url, headers=_headers())
        except httpx.RequestError:
            return None
        if res.status_code != 200:
            return None
        try:
            data = res.json() if res.content else {}
        except Exception:
            return None
        out: set[str] = set()
        for row in _instances_from_fetch_payload(data):
            n = _row_instance_name(row)
            if n:
                out.add(n)
        return out

    async def _reload_evolution_instance_names(
        self, client: httpx.AsyncClient, into: set[str]
    ) -> bool:
        """Atualiza `into` com fetch completo. False = não atualizado (rede/HTTP); preserva conteúdo anterior."""
        snap = await self._fetch_all_evolution_instance_names(client)
        if snap is None:
            return False
        into.clear()
        into.update(snap)
        return True

    async def _reconcile_local_token_if_instance_missing(
        self,
        client: httpx.AsyncClient,
        db: AsyncSession,
        school: School,
        iname: str,
        evo_names: set[str],
    ) -> None:
        """
        Se a instância foi apagada no Evolution Manager, o apikey guardado na escola deixa de ser válido.
        Limpa o token local para o próximo POST /instance/create não reutilizar credencial órfã.
        Usa o conjunto já obtido por `_fetch_all_evolution_instance_names` (sem novo GET).
        """
        if iname in evo_names:
            return
        if (getattr(school, "evolution_instance_token", None) or "").strip():
            logger.info(
                "Instância %s não existe na Evolution — limpando evolution_instance_token na escola.",
                iname,
            )
        school.evolution_instance_token = None  # type: ignore[assignment]
        await db.flush()

    async def _names_for_instance_checks(
        self, client: httpx.AsyncClient, evo_names: set[str] | None
    ) -> set[str] | None:
        """Resolve conjunto para checagens 403/409; um GET só quando o fluxo QR não passou snapshot."""
        if evo_names is not None:
            return evo_names
        return await self._fetch_all_evolution_instance_names(client)

    async def ensure_qr_for_school(self, db: AsyncSession, school_id: uuid.UUID) -> dict[str, Any]:
        """
        Garante instância Evolution + webhook apontando para este backend e devolve QR (base64) para parear.
        Chamado a cada pedido de QR (ex.: novo JWT da escola) — reutiliza a mesma instância por school_id.
        """
        if not evolution_configured():
            return {
                "status": "error",
                "message": "Evolution API não configurada (EVOLUTION_API_URL / EVOLUTION_API_KEY).",
            }

        school = await repository.get_school_by_id(db, school_id)
        if not school:
            return {"status": "error", "message": "Escola não encontrada."}

        iname = evolution_instance_name(school_id)
        if school.evolution_instance_name != iname:
            school.evolution_instance_name = iname  # type: ignore[assignment]
            await db.flush()

        # Já pareado: não insistir em /instance/connect (evita QR vazio / count 0).
        conn_preview = await self.connection_state_for_school(school_id)
        if conn_preview.get("connected"):
            return {
                "status": "success",
                "instance": iname,
                "already_connected": True,
                "qrcode": None,
                "message": "WhatsApp já está conectado para esta escola.",
            }

        # Poll longo + leitura HTTP generosa: proxy/browser precisam de timeout alto no /whatsapp/connect.
        timeout = httpx.Timeout(95.0, connect=12.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            evo_names: set[str] = set()
            snapshot_ok = await self._reload_evolution_instance_names(client, evo_names)
            if snapshot_ok:
                await self._reconcile_local_token_if_instance_missing(client, db, school, iname, evo_names)
            else:
                logger.warning("fetchInstances falhou — reconcile de token omitido; checagens extra sob demanda.")

            names_arg: set[str] | None = evo_names if snapshot_ok else None

            created = await self._ensure_instance_exists(client, db, school, iname, names_arg)
            if isinstance(created, dict) and created.get("status") == "error":
                return created

            await self._ensure_webhook(client, iname)

            # Preso em «connecting» sem QR: sessão zumbi Baileys — logout e novo ciclo de pareamento.
            st_pre = await self._connection_state_raw(client, iname)
            if st_pre == "connecting":
                logger.info("QR: Evolution em «connecting» — logout uma vez antes do GET connect.")
                await self._logout_via_client(client, iname)
                await asyncio.sleep(2.0)

            qr_out = await self._poll_connect_qr_linear(client, iname)
            for recovery_i in range(2):
                if qr_out.get("http_status") != 404:
                    break
                logger.warning(
                    "Evolution connect 404 (%s/2) para %s — delete + recreate + novo poll.",
                    recovery_i + 1,
                    iname,
                )
                rec_err = await self._recover_after_connect_404(
                    client, db, school, iname, evo_names, snapshot_ok
                )
                if isinstance(rec_err, dict) and rec_err.get("status") == "error":
                    return rec_err
                qr_out = await self._poll_connect_qr_linear(client, iname)

            if qr_out.get("status") == "error" and qr_out.get("http_status") != 401:
                logger.info("QR: segunda chance — restart + poll linear %s", iname)
                await self._restart_via_client(client, iname)
                await asyncio.sleep(2.5)
                qr_out = await self._poll_connect_qr_linear(client, iname)

            # Instância zumbi (só «count», estado connecting): apaga na Evolution e recria o mesmo sk_<uuid>.
            lk = (qr_out.get("debug") or {}).get("last_keys") or []
            if qr_out.get("status") == "error" and lk == ["count"]:
                logger.warning(
                    "QR: último recurso — DELETE instância %s na Evolution + recreate + novo poll.",
                    iname,
                )
                del_out = await self.delete_instance(iname)
                logger.info("Evolution delete_instance %s → %s", iname, del_out.get("status"))
                school.evolution_instance_token = None  # type: ignore[assignment]
                await db.flush()
                await asyncio.sleep(5.0)
                if snapshot_ok:
                    await self._reload_evolution_instance_names(client, evo_names)
                created3 = await self._ensure_instance_exists(client, db, school, iname, names_arg)
                if isinstance(created3, dict) and created3.get("status") == "error":
                    return created3
                await self._ensure_webhook(client, iname)
                qr_out = await self._poll_connect_qr_linear(client, iname)

            return qr_out

    async def _ensure_instance_exists(
        self,
        client: httpx.AsyncClient,
        db: AsyncSession,
        school: School,
        iname: str,
        evo_names: set[str] | None = None,
    ) -> dict[str, Any] | None:
        url = _evo_url("/instance/create")
        body: dict[str, Any] = {
            "instanceName": iname,
            "integration": "WHATSAPP-BAILEYS",
            "qrcode": True,
            "groupsIgnore": True,
        }
        tok = (getattr(school, "evolution_instance_token", None) or "").strip()
        if isinstance(tok, str) and tok:
            body["token"] = tok
        wh = _webhook_block()
        if wh:
            body["webhook"] = wh

        try:
            res = await client.post(url, json=body, headers=_headers())
        except httpx.RequestError as e:
            logger.warning("Evolution create request falhou: %s", e)
            return {"status": "error", "message": "Não foi possível contactar a Evolution API."}

        if res.status_code == 401:
            logger.warning("Evolution create 401 — apikey global não coincide com AUTHENTICATION_API_KEY.")
            return {
                "status": "error",
                "message": (
                    "Evolution recusou a chave API (401). No backend, EVOLUTION_API_KEY deve ser "
                    "exatamente o mesmo valor que AUTHENTICATION_API_KEY / EVOLUTION_AUTH_KEY do container."
                ),
            }

        if res.status_code in (200, 201):
            try:
                data = res.json() if res.content else {}
            except Exception:
                logger.warning("Evolution create: corpo JSON inválido (%s)", res.text[:300])
                return {"status": "error", "message": "Resposta inválida da Evolution ao criar instância."}
            tok = _instance_token_from_create_body(data)
            if isinstance(tok, str) and tok:
                school.evolution_instance_token = tok  # type: ignore[assignment]
                await db.flush()
            if evo_names is not None:
                evo_names.add(iname)
            return None

        if res.status_code in (403, 409):
            names = await self._names_for_instance_checks(client, evo_names)
            if names is None:
                logger.info(
                    "Instância Evolution tratada como existente (HTTP %s, lista indisponível): %s",
                    res.status_code,
                    iname,
                )
                return None
            if iname in names:
                logger.info("Instância Evolution já existe (HTTP %s): %s", res.status_code, iname)
                return None
            logger.warning(
                "Evolution create %s para %s mas nome não está na lista completa — delete + novo POST.",
                res.status_code,
                iname,
            )
            school.evolution_instance_token = None  # type: ignore[assignment]
            await db.flush()
            await self._delete_instance_via_client(client, iname)
            if evo_names is not None:
                evo_names.discard(iname)
            await asyncio.sleep(1.5)
            body_retry: dict[str, Any] = {
                "instanceName": iname,
                "integration": "WHATSAPP-BAILEYS",
                "qrcode": True,
                "groupsIgnore": True,
            }
            if wh:
                body_retry["webhook"] = wh
            try:
                res = await client.post(url, json=body_retry, headers=_headers())
            except httpx.RequestError as e:
                logger.warning("Evolution create (retry) falhou: %s", e)
                return {"status": "error", "message": "Não foi possível contactar a Evolution API."}
            if res.status_code == 401:
                return {
                    "status": "error",
                    "message": (
                        "Evolution recusou a chave API (401). No backend, EVOLUTION_API_KEY deve ser "
                        "exatamente o mesmo valor que AUTHENTICATION_API_KEY / EVOLUTION_AUTH_KEY do container."
                    ),
                }
            if res.status_code in (200, 201):
                try:
                    data = res.json() if res.content else {}
                except Exception:
                    logger.warning("Evolution create retry: JSON inválido (%s)", res.text[:300])
                    return {"status": "error", "message": "Resposta inválida da Evolution ao criar instância."}
                tok2 = _instance_token_from_create_body(data)
                if isinstance(tok2, str) and tok2:
                    school.evolution_instance_token = tok2  # type: ignore[assignment]
                    await db.flush()
                if evo_names is not None:
                    evo_names.add(iname)
                return None
            if res.status_code in (403, 409):
                fresh = await self._fetch_all_evolution_instance_names(client)
                if fresh is not None and iname in fresh:
                    logger.info("Instância %s passou a existir após retry (HTTP %s).", iname, res.status_code)
                    if evo_names is not None:
                        evo_names.add(iname)
                    return None
            logger.warning("Evolution create retry HTTP %s: %s", res.status_code, res.text[:500])
            return {"status": "error", "message": "Evolution recusou criar instância após limpeza do nome."}

        logger.warning("Evolution create HTTP %s: %s", res.status_code, res.text[:500])
        return {"status": "error", "message": "Evolution recusou criar/reutilizar a instância."}

    async def _ensure_webhook(self, client: httpx.AsyncClient, iname: str) -> None:
        url_wh = _webhook_url()
        if not url_wh:
            logger.warning("EVOLUTION_WEBHOOK_PUBLIC_BASE vazio — webhook não registado na Evolution.")
            return
        url = _evo_url(f"/webhook/set/{iname}")
        # Evolution v2.2.x valida o corpo com schema em que a raiz exige a propriedade "webhook"
        # (campos planos tipo webhookByEvents no topo devolvem 400 "instance requires property \"webhook\"").
        block: dict[str, Any] = {
            "enabled": True,
            "url": url_wh,
            "byEvents": False,
            "base64": False,
            "events": [
                "MESSAGES_UPSERT",
                "CONNECTION_UPDATE",
                "QRCODE_UPDATED",
            ],
        }
        sec = (settings.evolution_webhook_secret or "").strip()
        if sec:
            block["headers"] = {"X-Smart-Kaits-Webhook-Secret": sec}
        payload = {"webhook": block}
        try:
            r = await client.post(url, json=payload, headers=_headers())
            if r.status_code not in (200, 201):
                logger.warning("webhook/set %s: %s %s", iname, r.status_code, r.text[:300])
            else:
                logger.info("webhook/set OK para instância %s", iname)
        except httpx.RequestError as e:
            logger.warning("webhook/set falhou: %s", e)

    async def _connection_state_raw(self, client: httpx.AsyncClient, iname: str) -> str | None:
        url = _evo_url(f"/instance/connectionState/{iname}")
        try:
            res = await client.get(url, headers=_headers())
        except httpx.RequestError:
            return None
        if res.status_code != 200:
            return None
        try:
            data = res.json() if res.content else {}
        except Exception:
            return None
        inst = data.get("instance") or {}
        s = str(inst.get("state") or "").strip().lower()
        return s or None

    async def _logout_via_client(self, client: httpx.AsyncClient, iname: str) -> None:
        url = _evo_url(f"/instance/logout/{iname}")
        try:
            r = await client.delete(url, headers=_headers())
            logger.info("Evolution logout %s → HTTP %s", iname, r.status_code)
        except httpx.RequestError as e:
            logger.warning("Evolution logout %s falhou: %s", iname, e)

    async def _delete_instance_via_client(self, client: httpx.AsyncClient, iname: str) -> int:
        """DELETE /instance/delete/{iname} com o mesmo cliente do fluxo QR (evita estado inconsistente)."""
        url = _evo_url(f"/instance/delete/{iname}")
        try:
            r = await client.delete(url, headers=_headers())
            return int(r.status_code)
        except httpx.RequestError as e:
            logger.warning("Evolution delete %s falhou: %s", iname, e)
            return 0

    async def _recover_after_connect_404(
        self,
        client: httpx.AsyncClient,
        db: AsyncSession,
        school: School,
        iname: str,
        evo_names: set[str],
        snapshot_ok: bool,
    ) -> dict[str, Any] | None:
        """
        connect devolveu 404: força remoção na Evolution e recriação (reconcile sozinho não basta
        se create devolve 409 com instância «fantasma» ou connect aponta para registo inexistente).
        """
        school.evolution_instance_token = None  # type: ignore[assignment]
        await db.flush()
        code = await self._delete_instance_via_client(client, iname)
        logger.info("Pós-connect-404: delete %s → HTTP %s; a recriar instância.", iname, code)
        if snapshot_ok:
            evo_names.discard(iname)
        await asyncio.sleep(2.0)
        names_arg: set[str] | None = evo_names if snapshot_ok else None
        created = await self._ensure_instance_exists(client, db, school, iname, names_arg)
        if isinstance(created, dict) and created.get("status") == "error":
            return created
        await self._ensure_webhook(client, iname)
        await asyncio.sleep(1.0)
        if snapshot_ok:
            await self._reload_evolution_instance_names(client, evo_names)
        return None

    async def _restart_via_client(self, client: httpx.AsyncClient, iname: str) -> None:
        url = _evo_url(f"/instance/restart/{iname}")
        try:
            r = await client.post(url, headers=_headers())
            logger.info("Evolution restart %s → HTTP %s", iname, r.status_code)
        except httpx.RequestError as e:
            logger.warning("Evolution restart %s falhou: %s", iname, e)

    async def _poll_connect_qr_linear(self, client: httpx.AsyncClient, iname: str) -> dict[str, Any]:
        """
        Um único loop: GET /instance/connect repetido + um POST restart no meio.
        Sem asyncio.wait_for cortando antes da Evolution responder.
        """
        url = _evo_url(f"/instance/connect/{iname}")
        params: dict[str, str] = {}
        num_digits = "".join(c for c in (settings.evolution_connect_number or "") if c.isdigit())
        if len(num_digits) >= 10:
            params["number"] = num_digits
        last_body: Any = {}
        did_mid_restart = False
        for i in range(48):
            if i > 0:
                await asyncio.sleep(0.55)
            if i == 22 and not did_mid_restart:
                did_mid_restart = True
                logger.info("QR: meio do poll — restart Evolution %s", iname)
                await self._restart_via_client(client, iname)
                await asyncio.sleep(2.0)

            try:
                res = await client.get(url, headers=_headers(), params=params or None)
            except httpx.RequestError as e:
                return {"status": "error", "message": str(e)}

            if res.status_code == 401:
                return {
                    "status": "error",
                    "message": (
                        "Evolution recusou a apikey (401). EVOLUTION_API_KEY no backend deve ser igual a "
                        "AUTHENTICATION_API_KEY da Evolution."
                    ),
                    "http_status": 401,
                }

            if res.status_code != 200:
                msg = "Instância não pronta ou sem QR disponível."
                if res.status_code == 404:
                    msg = "Instância não encontrada na Evolution (recriar)."
                return {"status": "error", "message": msg, "http_status": res.status_code}

            try:
                last_body = res.json() if res.content else {}
            except Exception:
                last_body = {}

            err_msg = connect_payload_reports_error(last_body)
            if err_msg:
                logger.warning("Evolution connect erro no corpo: %s", err_msg[:300])
                return {"status": "error", "message": err_msg[:800]}

            b64 = extract_qr_base64_from_connect_payload(last_body)
            if b64:
                return {"status": "success", "instance": iname, "qrcode": b64}

            pairing = extract_pairing_from_connect_payload(last_body)
            if pairing:
                return {
                    "status": "partial",
                    "instance": iname,
                    "qrcode": None,
                    "pairing_code": pairing,
                    "message": "Use o código de pareamento no WhatsApp.",
                }

        flat = _flatten_connect_payload(last_body)
        return {
            "status": "error",
            "instance": iname,
            "message": (
                "Evolution não devolveu QR após várias tentativas. No Manager: apague a instância ou faça logout "
                "e use «Atualizar QR». Confira também timeout do proxy neste path (≥120s)."
            ),
            "debug": {"last_keys": list(flat.keys())[:24]} if isinstance(flat, dict) else {},
        }

    async def connection_state_for_school(self, school_id: uuid.UUID) -> dict[str, Any]:
        """
        Consulta Evolution `GET /instance/connectionState/{instance}`.
        `state == open` → WhatsApp ligado à instância da escola.
        """
        if not evolution_configured():
            return {"configured": False, "connected": False, "state": None}

        iname = evolution_instance_name(school_id)
        url = _evo_url(f"/instance/connectionState/{iname}")
        timeout = httpx.Timeout(20.0, connect=8.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                res = await client.get(url, headers=_headers())
            except httpx.RequestError:
                return {"configured": True, "connected": False, "state": None}

        if res.status_code != 200:
            return {"configured": True, "connected": False, "state": None}

        data = res.json() if res.content else {}
        inst = data.get("instance") or {}
        state_raw = inst.get("state")
        state = str(state_raw or "").lower()
        connected = state == "open"
        return {"configured": True, "connected": connected, "state": state or None}

    async def send_text(self, instance_name: str, number: str, text: str) -> bool:
        """Evolution POST /message/sendText/{instance}. `number`: só dígitos (E.164) ou JID completo (ex. `...@lid`)."""
        if not evolution_configured():
            return False
        url = _evo_url(f"/message/sendText/{instance_name}")
        body = {"number": number, "text": text}
        timeout = httpx.Timeout(45.0, connect=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                r = await client.post(url, json=body, headers=_headers())
                if r.status_code in (200, 201):
                    return True
                logger.warning("sendText %s: %s %s", instance_name, r.status_code, r.text[:300])
            except httpx.RequestError as e:
                logger.warning("sendText erro: %s", e)
        return False

    async def fetch_instances(
        self,
        *,
        instance_name: str | None = None,
        instance_id: str | None = None,
    ) -> dict[str, Any]:
        """Evolution GET /instance/fetchInstances — filtro opcional por nome ou id."""
        if not evolution_configured():
            return {"status": "error", "message": "Evolution não configurada.", "instances": []}
        params: dict[str, str] = {}
        if instance_name:
            params["instanceName"] = instance_name
        if instance_id:
            params["instanceId"] = instance_id
        url = _evo_url("/instance/fetchInstances")
        timeout = httpx.Timeout(30.0, connect=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                res = await client.get(url, headers=_headers(), params=params or None)
            except httpx.RequestError as e:
                return {"status": "error", "message": str(e), "instances": []}
        data: Any = {}
        try:
            data = res.json() if res.content else {}
        except Exception:
            data = {}
        if res.status_code != 200:
            return {
                "status": "error",
                "message": f"Evolution HTTP {res.status_code}",
                "instances": [],
                "raw": data if isinstance(data, dict) else None,
            }
        instances = _instances_from_fetch_payload(data)
        return {"status": "ok", "instances": instances, "raw": data if isinstance(data, dict) else None}

    async def fetch_instance_for_school(self, school_id: uuid.UUID) -> dict[str, Any]:
        """Metadados da instância `sk_<uuid>` desta escola (uma entrada)."""
        iname = evolution_instance_name(school_id)
        out = await self.fetch_instances(instance_name=iname)
        if out.get("status") != "ok":
            return out
        rows = out.get("instances") or []
        return {
            "status": "ok",
            "instance_name": iname,
            "instances": rows,
            "count": len(rows),
        }

    async def restart_instance(self, instance_name: str) -> dict[str, Any]:
        """Evolution v2.2.x: POST /instance/restart/{instance} (PUT devolve 404 «Cannot PUT …»)."""
        if not evolution_configured():
            return {"status": "error", "message": "Evolution não configurada."}
        url = _evo_url(f"/instance/restart/{instance_name}")
        timeout = httpx.Timeout(60.0, connect=15.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                res = await client.post(url, headers=_headers())
            except httpx.RequestError as e:
                return {"status": "error", "message": str(e)}
        if res.status_code in (200, 201):
            try:
                payload = res.json() if res.content else {}
            except Exception:
                payload = {}
            return {"status": "success", "data": payload}
        return {
            "status": "error",
            "message": f"Evolution HTTP {res.status_code}: {(res.text or '')[:400]}",
        }

    async def logout_instance(self, instance_name: str) -> dict[str, Any]:
        """Evolution DELETE /instance/logout/{instance}."""
        if not evolution_configured():
            return {"status": "error", "message": "Evolution não configurada."}
        url = _evo_url(f"/instance/logout/{instance_name}")
        timeout = httpx.Timeout(45.0, connect=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                res = await client.delete(url, headers=_headers())
            except httpx.RequestError as e:
                return {"status": "error", "message": str(e)}
        if res.status_code in (200, 201):
            try:
                payload = res.json() if res.content else {}
            except Exception:
                payload = {}
            return {"status": "success", "data": payload}
        return {
            "status": "error",
            "message": f"Evolution HTTP {res.status_code}: {(res.text or '')[:400]}",
        }

    async def delete_instance(self, instance_name: str) -> dict[str, Any]:
        """Evolution DELETE /instance/delete/{instance}."""
        if not evolution_configured():
            return {"status": "error", "message": "Evolution não configurada."}
        url = _evo_url(f"/instance/delete/{instance_name}")
        timeout = httpx.Timeout(45.0, connect=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                res = await client.delete(url, headers=_headers())
            except httpx.RequestError as e:
                return {"status": "error", "message": str(e)}
        if res.status_code in (200, 201):
            try:
                payload = res.json() if res.content else {}
            except Exception:
                payload = {}
            return {"status": "success", "data": payload}
        return {
            "status": "error",
            "message": f"Evolution HTTP {res.status_code}: {(res.text or '')[:400]}",
        }

    async def delete_instance_for_school(self, db: AsyncSession, school_id: uuid.UUID) -> dict[str, Any]:
        """Apaga instância na Evolution e limpa campos locais em `schools`."""
        school = await repository.get_school_by_id(db, school_id)
        if not school:
            return {"status": "error", "message": "Escola não encontrada."}
        iname = evolution_instance_name(school_id)
        out = await self.delete_instance(iname)
        if out.get("status") == "success":
            school.evolution_instance_name = None  # type: ignore[assignment]
            school.evolution_instance_token = None  # type: ignore[assignment]
            await db.flush()
        return out

    async def mark_messages_as_read(
        self,
        instance_name: str,
        read_messages: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Evolution POST /chat/markMessageAsRead/{instance}."""
        if not evolution_configured():
            return {"status": "error", "message": "Evolution não configurada."}
        url = _evo_url(f"/chat/markMessageAsRead/{instance_name}")
        body = {"readMessages": read_messages}
        timeout = httpx.Timeout(30.0, connect=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                res = await client.post(url, json=body, headers=_headers())
            except httpx.RequestError as e:
                return {"status": "error", "message": str(e)}
        if res.status_code in (200, 201):
            try:
                payload = res.json() if res.content else {}
            except Exception:
                payload = {}
            return {"status": "success", "data": payload}
        return {
            "status": "error",
            "message": f"Evolution HTTP {res.status_code}: {(res.text or '')[:400]}",
        }


evolution_service = EvolutionService()
