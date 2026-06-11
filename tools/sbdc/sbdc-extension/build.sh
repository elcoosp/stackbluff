#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
npm install
npm run build
echo "Extension built in dist/ directory. Load it in chrome://extensions/ (Developer mode -> Load unpacked)"
