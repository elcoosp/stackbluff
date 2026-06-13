You need **multiple characters per illustration** because number card narrative scenes may depict several characters (e.g., "Spade Soldier fights Heart Thief").

So SBDC must store a **many‑to‑many relationship** between `generated_prompts` (illustrations) and `characters`. This mapping comes from your LLM‑generated narrative arcs (ingested via JSON) and is used during `build-prompts` to populate the link. Then `export-stitch-instruction` outputs the list of face images for each illustration.

---

## What You Need to Add

### 1. Two new tables

```sql
-- Links a narrative arc to characters (declared at deck definition time)
CREATE TABLE arc_characters (
    arc_id TEXT NOT NULL REFERENCES deck_narrative_arcs(arc_id) ON DELETE CASCADE,
    character_id TEXT NOT NULL REFERENCES characters(character_id),
    role TEXT,  -- e.g., 'protagonist', 'opponent', 'background'
    PRIMARY KEY (arc_id, character_id)
);

-- Links a generated prompt (specific illustration) to characters (used at export time)
CREATE TABLE prompt_characters (
    prompt_id INTEGER NOT NULL REFERENCES generated_prompts(prompt_id) ON DELETE CASCADE,
    character_id TEXT NOT NULL REFERENCES characters(character_id),
    role TEXT,
    PRIMARY KEY (prompt_id, character_id)
);
```

### 2. Extend `deck_narrative_arcs` (optional – not strictly needed if we use `arc_characters`, but keep existing table as is)

No change to `deck_narrative_arcs` – the `character_ids` are stored in `arc_characters`.

### 3. Extend `ingest-json` to accept `character_ids` per narrative arc

Your LLM will output JSON like:

```json
{
  "narrative_arcs": [
    {
      "rank": "2",
      "suit": "s",
      "description": "A lone Spade Soldier breaches the wall, facing a Heart Defender.",
      "character_ids": ["spade_soldier", "heart_defender"]
    }
  ]
}
```

### 4. During `build-prompts`, for each `generated_prompt`, copy character associations from `arc_characters` to `prompt_characters`

Because each `generated_prompt` corresponds to a specific card (rank+suit) and layer (subject/env). For number cards, the `deck_narrative_arc` exists for that rank+suit. For face cards, you can either define arcs too, or auto‑assign the clan’s face character (e.g., Spade King for Ks). We'll handle both.

---

## Implementation (Rust Code, Drop into SBDC)

### Migration

Create `m20250217_000004_add_arc_characters_and_prompt_characters.rs`:

```rust
use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(ArcCharacters::Table)
                    .col(string(ArcCharacters::ArcId))
                    .col(string(ArcCharacters::CharacterId))
                    .col(string_null(ArcCharacters::Role))
                    .primary_key(
                        Index::create()
                            .col(ArcCharacters::ArcId)
                            .col(ArcCharacters::CharacterId),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(ArcCharacters::Table, ArcCharacters::ArcId)
                            .to(DeckNarrativeArcs::Table, DeckNarrativeArcs::ArcId)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(ArcCharacters::Table, ArcCharacters::CharacterId)
                            .to(Characters::Table, Characters::CharacterId)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(PromptCharacters::Table)
                    .col(integer(PromptCharacters::PromptId))
                    .col(string(PromptCharacters::CharacterId))
                    .col(string_null(PromptCharacters::Role))
                    .primary_key(
                        Index::create()
                            .col(PromptCharacters::PromptId)
                            .col(PromptCharacters::CharacterId),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(PromptCharacters::Table, PromptCharacters::PromptId)
                            .to(GeneratedPrompts::Table, GeneratedPrompts::PromptId)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(PromptCharacters::Table, PromptCharacters::CharacterId)
                            .to(Characters::Table, Characters::CharacterId)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(PromptCharacters::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(ArcCharacters::Table).to_owned())
            .await?;
        Ok(())
    }
}

#[derive(Iden)]
enum ArcCharacters {
    Table,
    ArcId,
    CharacterId,
    Role,
}
#[derive(Iden)]
enum PromptCharacters {
    Table,
    PromptId,
    CharacterId,
    Role,
}
#[derive(Iden)]
enum DeckNarrativeArcs {
    Table,
    ArcId,
}
#[derive(Iden)]
enum Characters {
    Table,
    CharacterId,
}
#[derive(Iden)]
enum GeneratedPrompts {
    Table,
    PromptId,
}
```

Don't forget to add the new tables to your entity models (create `arc_characters.rs` and `prompt_characters.rs` in `sbdc-entity/src/`).

### Extend `ArcPayload` in DTO

```rust
#[derive(Deserialize, Debug)]
pub struct ArcPayload {
    pub rank: String,
    pub suit: String,
    pub description: String,
    pub character_ids: Option<Vec<String>>,  // new
}
```

### Update `ingest.rs` – Insert into `arc_characters`

Inside the loop that inserts/updates narrative arcs:

```rust
let arc_id = format!("{}_{}_{}", deck_id, a.suit, a.rank);
// Insert or update the arc (existing code)
// ...

// Then, if character_ids provided, replace arc_characters for this arc
if let Some(char_ids) = &a.character_ids {
    // Delete existing
    arc_characters::Entity::delete_many()
        .filter(arc_characters::Column::ArcId.eq(&arc_id))
        .exec(txn)
        .await?;
    // Insert new
    for char_id in char_ids {
        arc_characters::ActiveModel {
            arc_id: Set(arc_id.clone()),
            character_id: Set(char_id.clone()),
            role: Set(None), // optional, could be set via separate field
        }
        .insert(txn)
        .await?;
    }
}
```

### Modify `build_prompts.rs` – Copy associations to `prompt_characters`

After creating/updating each `generated_prompt` row (and before final update), we need to populate `prompt_characters` for that prompt. We can get the character IDs from the corresponding narrative arc (for number cards) or from a default mapping for face cards.

Add after the `active.update(db).await?` (or before, but after prompt ID is known). We'll fetch the arc for the card (if any) and its characters.

```rust
// After prompt is saved (so prompt_id exists), populate prompt_characters
let prompt_id = active.prompt_id.as_ref().unwrap(); // after update

// Clear existing prompt_characters for this prompt
prompt_characters::Entity::delete_many()
    .filter(prompt_characters::Column::PromptId.eq(*prompt_id))
    .exec(db)
    .await?;

// Determine characters for this prompt
let mut character_ids = Vec::new();
if is_face {
    // For face cards, use the clan's face character (e.g., spade_king for Ks)
    if let Some(character) = char_map.get(&clan_id) {
        character_ids.push(character.character_id.clone());
    }
} else {
    // For number cards, look up the narrative arc for this rank+suit
    if let Some(arc) = arc_map.get(&(rank.clone(), suit.clone())) {
        // Get character_ids from arc_characters table
        let arc_chars = arc_characters::Entity::find()
            .filter(arc_characters::Column::ArcId.eq(&arc.arc_id))
            .all(db)
            .await?;
        for ac in arc_chars {
            character_ids.push(ac.character_id);
        }
    }
}

// Insert into prompt_characters
for char_id in character_ids {
    prompt_characters::ActiveModel {
        prompt_id: Set(*prompt_id),
        character_id: Set(char_id),
        role: Set(None),
    }
    .insert(db)
    .await?;
}
```

### Update `export-stitch-instruction` to list multiple face images

In `stitch_export.rs`, instead of a single `face_image`, we query `prompt_characters` joined with `character_assets` to get the face image path for each character. Then output a comma‑separated list.

```rust
// Inside the loop for each prompt:
let char_assets: Vec<String> = prompt_characters::Entity::find()
    .filter(prompt_characters::Column::PromptId.eq(prompt.prompt_id))
    .find_also_related(character_assets::Entity)
    .all(db)
    .await?
    .into_iter()
    .filter_map(|(_, asset)| asset.map(|a| a.face_image_path))
    .collect();

let face_images = if char_assets.is_empty() {
    "none".to_string()
} else {
    char_assets.join(", ")
};

output.push_str(&format!("{} | {} | {} | {}\n",
    illustration_path, face_images, double_head, gem));
```

---

## What You Need to Also Add to Your DB

- `character_assets` table (as previously described) to store face image paths per character.
- Generic characters for number cards (e.g., `spade_soldier`, `heart_soldier`) with their face images.

You can seed these via `init` or manually via SQL.

---

## Summary of Changes

| Component | Change |
|-----------|--------|
| Migration | Add `arc_characters`, `prompt_characters` tables |
| Entity | New `arc_characters.rs`, `prompt_characters.rs` |
| DTO | Add `character_ids` to `ArcPayload` |
| `ingest.rs` | Insert into `arc_characters` when ingesting narrative arcs |
| `build_prompts.rs` | After saving prompt, copy characters from arc to `prompt_characters` (and for face cards, add clan's face character) |
| `stitch_export.rs` | Query `prompt_characters` to list all face images per illustration |

---

## Final Result

- Your LLM can generate narrative arcs that include a list of character IDs.
- SBDC stores that mapping and propagates it to each generated illustration.
- `sbdc export-stitch-instruction` outputs a table where each illustration has **all** the face images that need to be merged, in the order you provided (or you can add a `role` to control order).
- Double‑head flag still applies for J, Q, K, Joker (you can decide if all faces become double‑head or only the main one – I assume the whole illustration is double‑headed).

This gives you full multi‑character support without breaking your existing pipeline.

Would you like me to provide the complete code for all the new entity files and the updated `build_prompts.rs` and `stitch_export.rs`?
