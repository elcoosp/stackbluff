#!/usr/bin/env bash
set -uo pipefail

COMPILE_OK=true
INCOMPLETE=false

# Create directories
echo "Creating directories"
mkdir -p src/components src/layouts src/utils scripts public

# Write .gitignore
echo "Writing .gitignore"
cat > .gitignore << 'GITIGNORE_EOF'
node_modules/
dist/
.DS_Store
*.log
.env
*.swp
*.swo
*~
target/
Cargo.lock
GITIGNORE_EOF

# Write package.json
echo "Writing package.json"
cat > package.json << 'PKG_EOF'
{
  "name": "card-compositor-renderer",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "export": "node scripts/export.js"
  },
  "dependencies": {
    "react": "^19.2.6",
    "react-dom": "^19.2.6",
    "react-router-dom": "^7.6.2"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.0",
    "@types/node": "^20.11.30",
    "@types/react": "^19.2.6",
    "@types/react-dom": "^19.2.6",
    "@vitejs/plugin-react": "^4.2.1",
    "puppeteer": "^24.39.1",
    "tailwindcss": "^4.3.0",
    "typescript": "^6.0.3",
    "vite": "^8.0.0"
  }
}
PKG_EOF

# Write vite.config.ts
echo "Writing vite.config.ts"
cat > vite.config.ts << 'VITE_CFG_EOF'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    open: true,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
VITE_CFG_EOF

# Write tsconfig.json
echo "Writing tsconfig.json"
cat > tsconfig.json << 'TS_CFG_EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
TS_CFG_EOF

# Write tsconfig.node.json
echo "Writing tsconfig.node.json"
cat > tsconfig.node.json << 'TS_NODE_EOF'
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
TS_NODE_EOF

# Write index.html
echo "Writing index.html"
cat > index.html << 'HTML_EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Card Composer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
HTML_EOF

# Check compilation (no rust here, but we'll do a quick npm install check? Not needed now)
echo "No compilation to check yet – skipping cargo check"

if [ "$INCOMPLETE" = true ] || [ "$COMPILE_OK" = false ]; then
  echo "Skipping commit due to incomplete files or compilation errors"
  exit 1
fi

# No tests yet, just commit
echo "All files written. Committing initial skeleton."
git add -A
git commit -m "chore: initial project skeleton"
```
