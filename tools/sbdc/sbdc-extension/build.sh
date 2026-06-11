#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "Installing dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

echo "Building extension..."
pnpm run build

echo ""
echo "Build complete. Files in dist/:"
find dist -type f | sort

echo ""
echo "Load in Chrome: chrome://extensions/ → Developer mode → Load unpacked → select dist/"
