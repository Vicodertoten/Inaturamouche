#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <base_url>"
  exit 2
fi

BASE_URL="${1%/}"
SMOKE_RETRIES="${SMOKE_RETRIES:-24}"
SMOKE_SLEEP_SECONDS="${SMOKE_SLEEP_SECONDS:-5}"
SMOKE_TIMEOUT_SECONDS="${SMOKE_TIMEOUT_SECONDS:-10}"

tmp_health_body="$(mktemp)"
tmp_packs_body="$(mktemp)"
tmp_packs_headers="$(mktemp)"
trap 'rm -f "$tmp_health_body" "$tmp_packs_body" "$tmp_packs_headers"' EXIT

echo "[smoke] Base URL: ${BASE_URL}"

for attempt in $(seq 1 "${SMOKE_RETRIES}"); do
  health_code="$(curl -sS -o "${tmp_health_body}" -w "%{http_code}" --max-time "${SMOKE_TIMEOUT_SECONDS}" "${BASE_URL}/healthz" || true)"
  packs_code="$(curl -sS -D "${tmp_packs_headers}" -o "${tmp_packs_body}" -w "%{http_code}" --max-time "${SMOKE_TIMEOUT_SECONDS}" "${BASE_URL}/api/packs" || true)"

  health_ok=false
  packs_ok=false

  if [[ "${health_code}" == "200" ]] && grep -Eq '"ok"[[:space:]]*:[[:space:]]*true' "${tmp_health_body}"; then
    health_ok=true
  fi

  if [[ "${packs_code}" == "200" ]] && grep -Ei '^content-type:[[:space:]]*application/json' "${tmp_packs_headers}" >/dev/null; then
    packs_ok=true
  fi

  if [[ "${health_ok}" == "true" ]] && [[ "${packs_ok}" == "true" ]]; then
    echo "[smoke] Success on attempt ${attempt}/${SMOKE_RETRIES}"
    exit 0
  fi

  echo "[smoke] Attempt ${attempt}/${SMOKE_RETRIES} failed: health=${health_code}, packs=${packs_code}"
  sleep "${SMOKE_SLEEP_SECONDS}"
done

echo "[smoke] Failed after ${SMOKE_RETRIES} attempts"
exit 1
