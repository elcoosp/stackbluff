#!/bin/bash

set -e

# Find all Cargo.toml files in the backend directory
TOML_FILES=$(find backend -name "Cargo.toml" -type f)

for file in $TOML_FILES; do
    echo "⬆️ Updating dependencies in $file..."

    # axum-test: 17 -> 20
    sed -i '' -E 's/axum-test = "17(\.[0-9.]+)?"/axum-test = "20"/g' "$file"
    sed -i '' -E 's/axum-test = \{ version = "17(\.[0-9.]+)?"/axum-test = { version = "20"/g' "$file"

    # crypto-common: 0.1.6 -> 0.1.7
    sed -i '' -E 's/crypto-common = "0\.1\.6"/crypto-common = "0.1.7"/g' "$file"
    sed -i '' -E 's/crypto-common = \{ version = "0\.1\.6"/crypto-common = { version = "0.1.7"/g' "$file"

    # hmac: 0.12 -> 0.13
    sed -i '' -E 's/hmac = "0\.12(\.[0-9.]+)?"/hmac = "0.13"/g' "$file"
    sed -i '' -E 's/hmac = \{ version = "0\.12(\.[0-9.]+)?"/hmac = { version = "0.13"/g' "$file"

    # jsonwebtoken: 10.3 -> 10.4
    sed -i '' -E 's/jsonwebtoken = "10\.3(\.[0-9.]+)?"/jsonwebtoken = "10.4"/g' "$file"
    sed -i '' -E 's/jsonwebtoken = \{ version = "10\.3(\.[0-9.]+)?"/jsonwebtoken = { version = "10.4"/g' "$file"

    # matchit: 0.8.4 -> 0.8.6
    sed -i '' -E 's/matchit = "0\.8\.4"/matchit = "0.8.6"/g' "$file"
    sed -i '' -E 's/matchit = \{ version = "0\.8\.4"/matchit = { version = "0.8.6"/g' "$file"

    # metrics: 0.23 -> 0.24
    sed -i '' -E 's/metrics = "0\.23(\.[0-9.]+)?"/metrics = "0.24"/g' "$file"
    sed -i '' -E 's/metrics = \{ version = "0\.23(\.[0-9.]+)?"/metrics = { version = "0.24"/g' "$file"

    # prometheus: 0.13 -> 0.14
    sed -i '' -E 's/prometheus = "0\.13(\.[0-9.]+)?"/prometheus = "0.14"/g' "$file"
    sed -i '' -E 's/prometheus = \{ version = "0\.13(\.[0-9.]+)?"/prometheus = { version = "0.14"/g' "$file"

    # reqwest: 0.12 -> 0.13
    sed -i '' -E 's/reqwest = "0\.12(\.[0-9.]+)?"/reqwest = "0.13"/g' "$file"
    sed -i '' -E 's/reqwest = \{ version = "0\.12(\.[0-9.]+)?"/reqwest = { version = "0.13"/g' "$file"

    # secrecy: 0.8 -> 0.10
    sed -i '' -E 's/secrecy = "0\.8(\.[0-9.]+)?"/secrecy = "0.10"/g' "$file"
    sed -i '' -E 's/secrecy = \{ version = "0\.8(\.[0-9.]+)?"/secrecy = { version = "0.10"/g' "$file"

    # sha2: 0.10 -> 0.11
    sed -i '' -E 's/sha2 = "0\.10(\.[0-9.]+)?"/sha2 = "0.11"/g' "$file"
    sed -i '' -E 's/sha2 = \{ version = "0\.10(\.[0-9.]+)?"/sha2 = { version = "0.11"/g' "$file"

    # smol_str / smol-str: 0.3.2 -> 0.3.6
    sed -i '' -E 's/(smol[-_]str) = "0\.3(\.[0-9.]+)?"/\1 = "0.3.6"/g' "$file"
    sed -i '' -E 's/(smol[-_]str) = \{ version = "0\.3(\.[0-9.]+)?"/\1 = { version = "0.3.6"/g' "$file"

    # teloxide: 0.13 -> 0.17
    sed -i '' -E 's/teloxide = "0\.13(\.[0-9.]+)?"/teloxide = "0.17"/g' "$file"
    sed -i '' -E 's/teloxide = \{ version = "0\.13(\.[0-9.]+)?"/teloxide = { version = "0.17"/g' "$file"

    # tower: 0.4 -> 0.5
    sed -i '' -E 's/tower = "0\.4(\.[0-9.]+)?"/tower = "0.5"/g' "$file"
    sed -i '' -E 's/tower = \{ version = "0\.4(\.[0-9.]+)?"/tower = { version = "0.5"/g' "$file"

    # tower-http: 0.5 -> 0.6
    sed -i '' -E 's/tower-http = "0\.5(\.[0-9.]+)?"/tower-http = "0.6"/g' "$file"
    sed -i '' -E 's/tower-http = \{ version = "0\.5(\.[0-9.]+)?"/tower-http = { version = "0.6"/g' "$file"
done

echo "✅ Cargo.toml files updated."
echo "🔄 Running cargo update to apply changes and regenerate Cargo.lock..."
cd backend
cargo update

echo "🔍 Running cargo check to verify updates (some major bumps may require code changes)..."
cargo check --workspace
