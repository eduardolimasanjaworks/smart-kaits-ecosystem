#!/usr/bin/env python3
"""
Smoke test HTTP síncrono contra a Evolution (sem FastAPI).

Fluxo linear:
  1) POST /instance/create (idempotente se 409)
  2) GET /instance/connect várias vezes + opcional POST restart no meio
  3) Imprime último JSON

Uso:
  export EVOLUTION_API_URL=http://127.0.0.1:8091
  export EVOLUTION_API_KEY=<mesma da Evolution>
  python3 scripts/verify_evolution_qr.py sk_a1111111111141118111111111110001

Ou sem argumento: gera nome sk_<uuid>.
"""
from __future__ import annotations

import json
import os
import sys
import time
import uuid

import httpx


def _flatten(data):
    if isinstance(data, list) and data:
        data = data[0]
    if not isinstance(data, dict):
        return {}
    m = dict(data)
    for k in ("data", "response", "result"):
        inner = data.get(k)
        if isinstance(inner, dict):
            m = {**inner, **m}
    inst = m.get("instance")
    if isinstance(inst, dict):
        m = {**inst, **m}
    q = m.get("qrcode")
    if isinstance(q, dict) and isinstance(q.get("base64"), str):
        m.setdefault("base64", q["base64"])
    return m


def _has_qr(data: dict) -> bool:
    d = _flatten(data)
    for k in ("base64", "base64Image"):
        v = d.get(k)
        if isinstance(v, str) and len(v) > 80:
            return True
    q = d.get("qrcode")
    if isinstance(q, dict):
        v = q.get("base64") or q.get("base64Image")
        if isinstance(v, str) and len(v) > 80:
            return True
    return bool(d.get("pairingCode"))


def main() -> int:
    base = (os.environ.get("EVOLUTION_API_URL") or "").rstrip("/")
    key = (os.environ.get("EVOLUTION_API_KEY") or "").strip()
    if not base or not key:
        print("Defina EVOLUTION_API_URL e EVOLUTION_API_KEY.", file=sys.stderr)
        return 1

    instance = sys.argv[1] if len(sys.argv) > 1 else f"sk_{uuid.uuid4().hex}"
    h = {"apikey": key, "Content-Type": "application/json"}

    with httpx.Client(timeout=95.0) as client:
        r = client.post(
            f"{base}/instance/create",
            json={
                "instanceName": instance,
                "integration": "WHATSAPP-BAILEYS",
                "qrcode": True,
                "groupsIgnore": True,
            },
            headers=h,
        )
        print("create:", r.status_code, (r.text or "")[:300])

        did_restart = False
        last = {}
        for i in range(40):
            if i == 20 and not did_restart:
                did_restart = True
                rr = client.post(f"{base}/instance/restart/{instance}", headers=h)
                print("restart:", rr.status_code)
                time.sleep(2.0)

            r2 = client.get(f"{base}/instance/connect/{instance}", headers=h)
            try:
                last = r2.json() if r2.content else {}
            except Exception:
                last = {}
            print(f"connect[{i}] HTTP {r2.status_code} keys={list(_flatten(last).keys())[:12]}")

            if r2.status_code == 200 and _has_qr(last):
                print("OK: QR ou pairing detectado.")
                print(json.dumps(last, indent=2)[:2500])
                return 0

            time.sleep(0.55)

        print("Última resposta connect:")
        print(json.dumps(last, indent=2)[:2500])
        r3 = client.get(f"{base}/instance/connectionState/{instance}", headers=h)
        print("connectionState:", r3.status_code, (r3.text or "")[:400])

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
