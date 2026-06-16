#!/usr/bin/env bash
# Verifica reachability da Evolution e se a API responde (não garante QR sem instância válida).
# Uso: export EVOLUTION_API_URL=https://evo.exemplo.com  EVOLUTION_API_KEY=...
#       bash scripts/check_evolution.sh [nome_instancia_opcional]

set -euo pipefail
BASE="${EVOLUTION_API_URL:-}"
KEY="${EVOLUTION_API_KEY:-}"
INST="${1:-}"

if [[ -z "$BASE" || -z "$KEY" ]]; then
  echo "Defina EVOLUTION_API_URL e EVOLUTION_API_KEY." >&2
  exit 1
fi

BASE="${BASE%/}"
echo "GET $BASE/ (ou health)…"
code=$(curl -sS -o /tmp/evo_head.txt -w "%{http_code}" -H "apikey: $KEY" "$BASE/" || true)
echo "HTTP $code"
head -c 400 /tmp/evo_head.txt || true
echo

if [[ -n "$INST" ]]; then
  echo
  echo "GET instance/connect/$INST (QR / estado)…"
  code2=$(curl -sS -o /tmp/evo_conn.json -w "%{http_code}" -H "apikey: $KEY" "$BASE/instance/connect/$INST" || true)
  echo "HTTP $code2"
  if command -v jq >/dev/null 2>&1; then
    jq 'if type == "object" then {base64: (.base64 != null), keys: (keys)} else . end' /tmp/evo_conn.json 2>/dev/null || cat /tmp/evo_conn.json
  else
    head -c 800 /tmp/evo_conn.json
  fi
  echo
fi

echo "Feito. Se HTTP 200 no connect e existir base64/qrcode, a instância está a expor QR."
