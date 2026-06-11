#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "Installing dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

echo "Building extension..."
pnpm run build

echo ""
echo "Verifying extension files..."
DIST_DIR="dist"
ERRORS=0

if [ ! -f "$DIST_DIR/manifest.json" ]; then
  echo "❌ manifest.json missing"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ manifest.json present"
fi

SW_PATH=$(python3 -c "import json; m=json.load(open('$DIST_DIR/manifest.json')); print(m.get('background',{}).get('service_worker',''))" 2>/dev/null || echo "")
if [ -n "$SW_PATH" ] && [ -f "$DIST_DIR/$SW_PATH" ]; then
  echo "✅ background service_worker → $SW_PATH"
else
  echo "❌ background service_worker missing: $SW_PATH"
  ERRORS=$((ERRORS + 1))
fi

CS_JS=$(python3 -c "import json; m=json.load(open('$DIST_DIR/manifest.json')); [print(j) for cs in m.get('content_scripts',[]) for j in cs.get('js',[])]" 2>/dev/null || echo "")
for js in $CS_JS; do
  if [ -f "$DIST_DIR/$js" ]; then
    echo "✅ content_script → $js"
  else
    echo "❌ content_script missing: $js"
    ERRORS=$((ERRORS + 1))
  fi
done

POPUP_PATH=$(python3 -c "import json; m=json.load(open('$DIST_DIR/manifest.json')); print(m.get('action',{}).get('default_popup',''))" 2>/dev/null || echo "")
if [ -n "$POPUP_PATH" ] && [ -f "$DIST_DIR/$POPUP_PATH" ]; then
  echo "✅ popup → $POPUP_PATH"
else
  echo "❌ popup missing: $POPUP_PATH"
  ERRORS=$((ERRORS + 1))
fi

echo ""
if [ "$ERRORS" -eq 0 ]; then
  echo "✅ Extension build verified — load dist/ in Chrome"
else
  echo "❌ $ERRORS error(s) found"
  exit 1
fi
