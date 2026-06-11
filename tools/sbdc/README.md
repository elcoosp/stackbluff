# SBDC — StackBluff Deck Creator

A tool for generating a full 52-card deck of illustrated playing cards using AI image generation, with a coherent pipeline from world-building through final output.

## Architecture

```
CLI (setup)     →  SQLite DB  ←  HTTP Server  ←  Chrome Extension (generation)
                                                    ↕
                                              perchance.org/fluxgen
```

- **CLI**: Handles init, scaffold, ingest, build-prompts, and clean (phases 1 & 3)
- **Server**: Exposes REST API that the extension drives during generation (phase 2)
- **Extension**: Content script on perchance.org/fluxgen fetches prompts, fills the UI, generates images, and submits takes back to the server

## User Flow

### Phase 1: Setup (CLI)

```bash
# Initialize project — seeds universe, clans, characters
cargo run --bin sbdc -- init

# Scaffold a deck — creates 52 prompt slots + narrative arcs
cargo run --bin sbdc -- scaffold --deck-id mydeck --season-id default_season

# (Optional) Ingest lore and narrative overrides
cargo run --bin sbdc -- ingest-json --deck-id mydeck --file lore.json

# Build prompts — assembles final_positive/negative from all layers
cargo run --bin sbdc -- build-prompts --deck-id mydeck
```

### Phase 2: Generate (Server + Extension)

```bash
# Start the server
cargo run --bin sbdc -- serve --port 8899
```

Then:
1. Build the extension: `cd sbdc-extension && ./build.sh`
2. Load it in Chrome (Developer mode → Load unpacked → select `dist/`)
3. Open https://perchance.org/fluxgen
4. Click the extension icon, set Server URL, Deck ID, and Takes per prompt
5. Click **Start** to load the generation queue
6. The content script automatically generates all prompts and submits takes

### Phase 3: Review & Finalize

```bash
# After selecting best takes (via extension or API):
cargo run --bin sbdc -- clean --deck-id mydeck
```

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/decks/{deck_id}/start` | Start generation queue |
| GET | `/api/decks/{deck_id}/status` | Deck progress |
| GET | `/api/decks/{deck_id}/prompts/next` | Next prompt to generate |
| POST | `/api/decks/{deck_id}/prompts/{id}/takes` | Submit generated images |
| GET | `/api/decks/{deck_id}/takes` | List all takes |
| POST | `/api/decks/{deck_id}/takes/{id}/select` | Select best take |

## Prompt Assembly

Each card's `final_positive` is assembled from multiple layers:
- **Universe**: background invariant, lighting invariant
- **Clan**: silhouette, color palette, pip texture
- **Character** (face cards): bust description, artifact
- **Narrative Arc** (number cards): scene description
- **Lore**: injectable approved lore entries
- **Deck**: art style, theme, junction type
- **Creative Pattern, Framing, Virality**: structural prompts

## Development

```bash
# Run all tests
cargo test --workspace --manifest-path tools/sbdc/Cargo.toml

# Check compilation
cargo check --workspace --manifest-path tools/sbdc/Cargo.toml
