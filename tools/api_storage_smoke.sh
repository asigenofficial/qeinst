#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:8000/api/v1}"
if [[ -f "backend/artisan" ]]; then (cd backend && php artisan cache:clear >/dev/null 2>&1 || true); fi
TMP_DIR="$(mktemp -d)"
TMP="$TMP_DIR/response.json"
ATTACHMENT="${ATTACHMENT:-$TMP_DIR/attachment.txt}"
printf 'QEI storage integration test attachment\n' > "$ATTACHMENT"
trap 'rm -rf "$TMP_DIR"' EXIT
status=$(curl -sS -o "$TMP" -w '%{http_code}' -H 'Accept: application/json' -X POST "$BASE/corporate-requests" \
  -F 'applicant_name=اختبار تخزين' \
  -F 'company_name=شركة تخزين' \
  -F 'phone=+966501234569' \
  -F 'email=qa-storage@example.com' \
  -F 'need_description=اختبار رفع مرفق وتخزينه' \
  -F 'execution_mode=عن بُعد' \
  -F "attachment=@${ATTACHMENT};type=text/plain")
if [[ "$status" != "201" ]]; then
  echo "FAIL attachment upload HTTP $status"
  cat "$TMP"
  exit 1
fi
path=$(grep -o '"attachment_path"[[:space:]]*:[[:space:]]*"[^"]*"' "$TMP" | sed -E 's/.*"attachment_path"[[:space:]]*:[[:space:]]*"([^"]*)"/\1/' | sed 's#\\/#/#g' | head -1)
if [[ -z "$path" || ! -f "/home/ubuntu/qeinst/backend/storage/app/public/$path" ]]; then
  echo "FAIL attachment storage path=$path"
  exit 1
fi
echo "PASS attachment upload and storage path=$path"
