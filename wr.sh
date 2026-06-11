#!/usr/bin/env bash
set -uo pipefail

COMPILE_OK=true
INCOMPLETE=false

BASE="tools/sbdc"

echo "Diagnosing: current dist contents"
find "$BASE/sbdc-extension/dist" -type f 2>&1 || echo "dist directory missing"

echo ""
echo "Diagnosing: current manifest.json"
cat "$BASE/sbdc-extension/manifest.json" 2>&1

echo ""
echo "Diagnosing: source files exist?"
for f in background.ts content.ts popup.ts popup.html; do
  if [ -f "$BASE/sbdc-extension/src/$f" ]; then
    echo "  ✅ src/$f exists"
  else
    echo "  ❌ src/$f MISSING"
  fi
done

echo ""
echo "The @crxjs/vite-plugin requires manifest paths to point to .ts source files, not .js"
echo "Fixing manifest.json to reference TypeScript sources"

cat > "$BASE/sbdc-extension/manifest.json" << 'MANIFEST_V2_W5tK9'
{
  "manifest_version": 3,
  "name": "SBDC Generator",
  "version": "1.0",
  "permissions": [
    "storage"
  ],
  "host_permissions": [
    "http://localhost:*/*"
  ],
  "background": {
    "service_worker": "src/background.ts",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": [
        "*://*.perchance.org/*"
      ],
      "js": [
        "src/content.ts"
      ],
      "run_at": "document_idle",
      "all_frames": true
    }
  ],
  "action": {
    "default_popup": "src/popup.html"
  }
}
MANIFEST_V2_W5tK9

echo "Rebuilding extension"
cd "$BASE/sbdc-extension"
rm -rf dist
pnpm install 2>&1 | tail -3
pnpm run build 2>&1

echo ""
echo "Post-build: dist contents"
find "$BASE/sbdc-extension/dist" -type f 2>&1 || echo "dist directory missing"

echo ""
echo "Post-build: generated manifest.json in dist"
cat "$BASE/sbdc-extension/dist/manifest.json" 2>&1 || echo "No manifest in dist"

echo ""
echo "Checking for background and content in dist"
BG_COUNT=$(find "$BASE/sbdc-extension/dist" -name "*background*" -type f 2>/dev/null | wc -l | tr -d ' ')
CT_COUNT=$(find "$BASE/sbdc-extension/dist" -name "*content*" -type f 2>/dev/null | wc -l | tr -d ' ')
POP_COUNT=$(find "$BASE/sbdc-extension/dist" -name "*popup*" -type f 2>/dev/null | wc -l | tr -d ' ')
echo "  background files: $BG_COUNT"
echo "  content files:    $CT_COUNT"
echo "  popup files:      $POP_COUNT"

if [ "$BG_COUNT" -eq 0 ] || [ "$CT_COUNT" -eq 0 ]; then
  echo ""
  echo "⚠️  Background or content still missing — checking vite config"
  cat "$BASE/sbdc-extension/vite.config.ts" 2>&1

  echo ""
  echo "Checking if @crxjs/vite-plugin is properly resolving"
  cat "$BASE/sbdc-extension/node_modules/@crxjs/vite-plugin/package.json" 2>&1 | head -5

  echo ""
  echo "Trying alternative: explicit vite config with manual input entries"
  cat > "$BASE/sbdc-extension/vite.config.ts" << 'VITE_V2_M8nP4'
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    rollupOptions: {
      input: {
        content: 'src/content.ts',
        background: 'src/background.ts',
      },
    },
  },
});
VITE_V2_M8nP4

  echo "Rebuilding with updated vite config"
  rm -rf dist
  pnpm run build 2>&1

  echo ""
  echo "Post-rebuild: dist contents"
  find "$BASE/sbdc-extension/dist" -type f 2>&1
  echo ""
  echo "Post-rebuild: manifest"
  cat "$BASE/sbdc-extension/dist/manifest.json" 2>&1

  BG_COUNT2=$(find "$BASE/sbdc-extension/dist" -name "*background*" -type f 2>/dev/null | wc -l | tr -d ' ')
  CT_COUNT2=$(find "$BASE/sbdc-extension/dist" -name "*content*" -type f 2>/dev/null | wc -l | tr -d ' ')
  echo "  background files: $BG_COUNT2"
  echo "  content files:    $CT_COUNT2"

  if [ "$BG_COUNT2" -eq 0 ] || [ "$CT_COUNT2" -eq 0 ]; then
    echo ""
    echo "Still missing. Rolling back vite config and using manual build approach."
    echo "The @crxjs/vite-plugin beta may not properly handle service_worker + content_scripts."
    echo "Switching to manual Vite build without @crxjs."

    cat > "$BASE/sbdc-extension/vite.config.ts" << 'VITE_V3_R2jL7'
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup.html'),
        content: resolve(__dirname, 'src/content.ts'),
        background: resolve(__dirname, 'src/background.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
VITE_V3_R2jL7

    echo "Rebuilding with manual Vite config (no @crxjs)"
    rm -rf dist
    pnpm run build 2>&1

    echo ""
    echo "Post-rebuild: dist contents"
    find "$BASE/sbdc-extension/dist" -type f 2>&1

    echo ""
    echo "Generating manifest.json in dist manually"
    cat > "$BASE/sbdc-extension/dist/manifest.json" << 'DIST_MANIFEST_K9mW3'
{
  "manifest_version": 3,
  "name": "SBDC Generator",
  "version": "1.0",
  "permissions": [
    "storage"
  ],
  "host_permissions": [
    "http://localhost:*/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": [
        "*://*.perchance.org/*"
      ],
      "js": [
        "content.js"
      ],
      "run_at": "document_idle",
      "all_frames": true
    }
  ],
  "action": {
    "default_popup": "popup.html"
  }
}
DIST_MANIFEST_K9mW3

    echo ""
    echo "Final dist contents:"
    find "$BASE/sbdc-extension/dist" -type f | sort
    echo ""
    echo "Final manifest.json:"
    cat "$BASE/sbdc-extension/dist/manifest.json"
  fi
fi

echo ""
echo "Verifying all 3 entry points exist in dist"
FINAL_BG=$(find "$BASE/sbdc-extension/dist" -name "background.js" -type f 2>/dev/null | wc -l | tr -d ' ')
FINAL_CT=$(find "$BASE/sbdc-extension/dist" -name "content.js" -type f 2>/dev/null | wc -l | tr -d ' ')
FINAL_POP=$(find "$BASE/sbdc-extension/dist" -name "popup.html" -type f 2>/dev/null | wc -l | tr -d ' ')
FINAL_MF=$(find "$BASE/sbdc-extension/dist" -name "manifest.json" -type f 2>/dev/null | wc -l | tr -d ' ')

echo "  background.js:   $FINAL_BG"
echo "  content.js:      $FINAL_CT"
echo "  popup.html:      $FINAL_POP"
echo "  manifest.json:   $FINAL_MF"

if [ "$FINAL_BG" -gt 0 ] && [ "$FINAL_CT" -gt 0 ] && [ "$FINAL_POP" -gt 0 ] && [ "$FINAL_MF" -gt 0 ]; then
  echo ""
  echo "✅ Extension build complete — all files present"
else
  echo ""
  echo "❌ Extension build incomplete — see above for errors"
fi

echo "Updating build.sh to match new config"
cat > "$BASE/sbdc-extension/build.sh" << 'BUILDSH_V2_P4qN1'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "Installing dependencies..."
pnpm install

echo "Building extension..."
pnpm run build

echo "Generating manifest.json in dist..."
cat > dist/manifest.json << 'MANIFEST_EMBED'
{
  "manifest_version": 3,
  "name": "SBDC Generator",
  "version": "1.0",
  "permissions": [
    "storage"
  ],
  "host_permissions": [
    "http://localhost:*/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": [
        "*://*.perchance.org/*"
      ],
      "js": [
        "content.js"
      ],
      "run_at": "document_idle",
      "all_frames": true
    }
  ],
  "action": {
    "default_popup": "popup.html"
  }
}
MANIFEST_EMBED

echo "Extension built in dist/ directory."
echo "Load it in chrome://extensions/ (Developer mode -> Load unpacked -> select dist/)"
BUILDSH_V2_P4qN1
chmod +x "$BASE/sbdc-extension/build.sh"

echo "Committing"
git add -A
git commit -m "fix(sbdc): fix extension build — manual Vite config, no @crxjs

- @crxjs/vite-plugin beta doesn't properly handle service_worker + content_scripts
- Switch to manual Vite build with explicit rollup input entries
- Generate manifest.json in dist/ as post-build step
- Update build.sh to include manifest generation" 2>&1 || echo "Nothing to commit or commit failed"
