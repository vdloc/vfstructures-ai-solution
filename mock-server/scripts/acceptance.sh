#!/usr/bin/env bash
# Mirrors the acceptance in ship/02-hop-dong.md §7 against the mock.
# Usage: BASE=http://localhost:8787 ./scripts/acceptance.sh   (server started with MOCK_DELAY_SCALE=1)
set -euo pipefail
BASE="${BASE:-http://localhost:8787}"
TOKEN="${TOKEN:-dev-user}"
fail() { echo "FAIL: $*" >&2; exit 1; }

echo "== 1. Events arrive spaced out, not in one flush =="
stamps=$(curl -sN -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"conversationId":"c-accept-1","message":"ping","context":{}}' \
  "$BASE/v1/chat" | while IFS= read -r line; do
    if [[ $line == event:* ]]; then echo "$(date +%s%3N) ${line#event: }"; fi
  done)
echo "$stamps"
first=$(echo "$stamps" | head -1 | cut -d' ' -f1)
last=$(echo "$stamps" | tail -1 | cut -d' ' -f1)
(( last - first > 1500 )) || fail "stream took $((last - first)) ms; events were buffered"
echo "$stamps" | tail -1 | grep -q ' done$' || fail "last event is not done"

echo "== 2. Disconnect mid-stream is stored as aborted =="
timeout 3 curl -sN -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"conversationId":"c-accept-2","message":"/mock:long","context":{}}' \
  "$BASE/v1/chat" >/dev/null || true
sleep 0.5
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/v1/conversations/c-accept-2" | grep -q '"status":"aborted"' \
  || fail "conversation c-accept-2 has no aborted message"

echo "== 3. Refusal has no token =="
events=$(curl -sN -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"conversationId":"c-accept-3","message":"/mock:refusal","context":{}}' "$BASE/v1/chat" | grep '^event:' | tr '\n' ' ')
[[ $events == "event: status event: refusal event: done " ]] || fail "refusal sequence was: $events"

echo "OK"
