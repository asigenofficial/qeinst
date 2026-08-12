#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:8000/api/v1}"
if [[ -f "backend/artisan" ]]; then (cd backend && php artisan cache:clear >/dev/null 2>&1 || true); fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
pass=0
fail=0
check_code() {
  local name="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    printf 'PASS %-34s HTTP %s\n' "$name" "$actual"
    pass=$((pass+1))
  else
    printf 'FAIL %-34s expected HTTP %s got %s\n' "$name" "$expected" "$actual"
    fail=$((fail+1))
  fi
}
get_json() {
  curl -sS -H 'Accept: application/json' "$1"
}
status=$(curl -sS -o "$TMP/root.json" -w '%{http_code}' -H 'Accept: application/json' "${BASE%/api/v1}/")
check_code root 200 "$status"
for endpoint in categories programs corporate-solutions galleries clients success-stories; do
  status=$(curl -sS -o "$TMP/${endpoint//\//_}.json" -w '%{http_code}' -H 'Accept: application/json' "$BASE/$endpoint")
  check_code "GET $endpoint" 200 "$status"
done
status=$(curl -sS -o "$TMP/program.json" -w '%{http_code}' -H 'Accept: application/json' "$BASE/programs?limit=2")
check_code 'GET programs limit' 200 "$status"
slug=$(python3 - "$TMP/program.json" <<'PY'
import json,sys
p=json.load(open(sys.argv[1]))
data=p.get('data') or []
assert data
print(data[0].get('slug',''))
PY
)
status=$(curl -sS -o "$TMP/program_detail.json" -w '%{http_code}' -H 'Accept: application/json' "$BASE/programs/$slug")
check_code 'GET program detail' 200 "$status"
status=$(curl -sS -o "$TMP/invalid.json" -w '%{http_code}' -H 'Accept: application/json' -X POST "$BASE/contact" -H 'Content-Type: application/json' --data '{"email":"bad"}')
check_code 'POST contact invalid' 422 "$status"
status=$(curl -sS -o "$TMP/contact.json" -w '%{http_code}' -H 'Accept: application/json' -H 'Content-Type: application/json' -X POST "$BASE/contact" --data '{"full_name":"اختبار آلي","email":"qa-contact@example.com","subject":"اختبار","message":"رسالة اختبار آلية"}')
check_code 'POST contact valid' 201 "$status"
status=$(curl -sS -o "$TMP/corporate.json" -w '%{http_code}' -H 'Accept: application/json' -H 'Content-Type: application/json' -X POST "$BASE/corporate-requests" --data '{"applicant_name":"اختبار آلي","company_name":"شركة اختبار","phone":"+966501234567","email":"qa-corporate@example.com","need_description":"طلب اختبار تكامل","execution_mode":"عن بُعد"}')
check_code 'POST corporate valid' 201 "$status"
status=$(curl -sS -o "$TMP/registration.json" -w '%{http_code}' -H 'Accept: application/json' -H 'Content-Type: application/json' -X POST "$BASE/registrations" --data '{"national_id":"1234567890","full_name":"اختبار آلي","email":"qa-registration@example.com","phone":"+966501234568","city":"الرياض","qualification":"بكالوريوس","company_name":"شركة اختبار","job_title":"مهندس","entity_type":"خاص","program_id":1}')
check_code 'POST registration valid' 201 "$status"
readarray -t regdata < <(python3 - "$TMP/registration.json" <<'PY'
import json,sys
p=json.load(open(sys.argv[1]))
assert p.get('status') is True
print(p['registration_number'])
print(p['summary_token'])
PY
)
reg_number="${regdata[0]}"
token="${regdata[1]}"
status=$(curl -sS -o "$TMP/summary.html" -w '%{http_code}' -H 'Accept: text/html' "$BASE/registrations/$reg_number/summary?token=$token")
check_code 'GET registration summary valid' 200 "$status"
status=$(curl -sS -o "$TMP/summary_bad.json" -w '%{http_code}' -H 'Accept: application/json' "$BASE/registrations/$reg_number/summary?token=invalid")
check_code 'GET registration summary invalid' 403 "$status"
if grep -q 'اختبار آلي' "$TMP/summary.html"; then
  printf 'PASS %-34s summary contains submitted name\n' 'summary persistence'
  pass=$((pass+1))
else
  printf 'FAIL %-34s summary missing submitted name\n' 'summary persistence'
  fail=$((fail+1))
fi
printf 'RESULT pass=%s fail=%s\n' "$pass" "$fail"
[[ "$fail" -eq 0 ]]
