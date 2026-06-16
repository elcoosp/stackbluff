#!/bin/bash
BASE="http://localhost:3000"

# Step 1: Get the current LIVE table ID (no auth, in-memory only)
TABLE_ID=$(curl -s "$BASE/api/tables" \
  | python3 -c "import sys,json; tables=json.load(sys.stdin)['tables']; print(tables[0]['table_id'] if tables else '')" 2>/dev/null)

if [ -z "$TABLE_ID" ]; then
  echo "ERROR: No active tables. Is the server running?"
  exit 1
fi

echo "Live table ID: $TABLE_ID"

# Step 2: Get tokens (login first, register as fallback)
ALICE_TOKEN=$(curl -s -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@test.com","password":"password1"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)

if [ -z "$ALICE_TOKEN" ]; then
  ALICE_TOKEN=$(curl -s -X POST "$BASE/auth/register" \
    -H 'Content-Type: application/json' \
    -d '{"username":"Alice","email":"alice@test.com","password":"password1"}' \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
fi

BOB_TOKEN=$(curl -s -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"bob@test.com","password":"password2"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)

if [ -z "$BOB_TOKEN" ]; then
  BOB_TOKEN=$(curl -s -X POST "$BASE/auth/register" \
    -H 'Content-Type: application/json' \
    -d '{"username":"Bob","email":"bob@test.com","password":"password2"}' \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
fi

if [ -z "$ALICE_TOKEN" ] || [ -z "$BOB_TOKEN" ]; then
  echo "ERROR: Could not get tokens"
  exit 1
fi

echo "Alice: ${ALICE_TOKEN:0:20}..."
echo "Bob:   ${BOB_TOKEN:0:20}..."
echo ""
echo "=========================================="
echo "  Open TWO terminals and paste these:"
echo "=========================================="
echo ""
echo "TERMINAL 1 (Alice):"
echo ""
echo "  websocat 'ws://localhost:3000/ws/game?token=$ALICE_TOKEN'"
echo ""
echo "  {\"type\":\"join_table\",\"table_id\":\"$TABLE_ID\",\"seat\":0,\"buy_in\":1000}"
echo ""
echo ""
echo "TERMINAL 2 (Bob):"
echo ""
echo "  websocat 'ws://localhost:3000/ws/game?token=$BOB_TOKEN'"
echo ""
echo "  {\"type\":\"join_table\",\"table_id\":\"$TABLE_ID\",\"seat\":1,\"buy_in\":1000}"
echo ""
echo ""
echo "AFTER BOTH JOIN — hand auto-starts. Alternate actions:"
echo ""
echo "  {\"type\":\"player_action\",\"action\":\"call\"}"
echo "  {\"type\":\"player_action\",\"action\":\"check\"}"
echo "  {\"type\":\"player_action\",\"action\":\"raise\",\"amount\":50}"
echo "  {\"type\":\"player_action\",\"action\":\"fold\"}"
echo ""
