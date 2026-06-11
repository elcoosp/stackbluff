use crate::error::{Result, SbdcError};
use sbdc_dto::ingest::IngestPayload;
use sbdc_entity::{deck, lore_entry, character_relationship, deck_narrative_arc};
use sea_orm::{ActiveModelTrait, EntityTrait, QueryFilter, Set};
use std::path::Path;
use std::collections::HashMap;
use tracing;

pub async fn run_ingest_json(db: &sea_orm::DatabaseConnection, deck_id: &str, file_path: &Path) -> Result<()> {
    // 1. Verify deck exists
    let deck_exists = deck::Entity::find()
        .filter(deck::COLUMN.deck_id.eq(deck_id))
        .one(db)
        .await?
        .is_some();
    if !deck_exists {
        return Err(SbdcError::DeckNotFound(deck_id.into()));
    }

    // 2. Read and parse
    let content = tokio::fs::read_to_string(file_path).await?;
    let payload: IngestPayload = serde_json::from_str(&content)?;
    payload.validate().map_err(|e| SbdcError::Validation(e.to_string()))?;

    // 3. Batch insert lore entries
    if let Some(lores) = &payload.lore_entries {
        let models: Vec<lore_entry::ActiveModel> = lores.iter().map(|l| {
            lore_entry::ActiveModel {
                lore_id: Set(uuid::Uuid::new_v4().to_string()),
                parent_entity: Set(l.parent_entity.clone()),
                parent_id: Set(l.parent_id.clone()),
                category: Set(l.category.clone()),
                title: Set(l.title.clone()),
                content: Set(l.content.clone()),
                source: Set(l.source.clone()),
                status: Set(l.status.clone()),
                injectable: Set(l.injectable),
                injection_weight: Set(l.injection_weight),
            }
        }).collect();
        if !models.is_empty() {
            lore_entry::Entity::insert_many(models).exec(db).await?;
        }
    }

    // 4. Batch insert character relationships
    if let Some(rels) = &payload.character_relationships {
        let models: Vec<character_relationship::ActiveModel> = rels.iter().map(|r| {
            character_relationship::ActiveModel {
                relationship_id: Set(uuid::Uuid::new_v4().to_string()),
                character_id_a: Set(r.character_id_a.clone()),
                character_id_b: Set(r.character_id_b.clone()),
                relationship_type: Set(r.relationship_type.clone()),
                description: Set(r.description.clone()),
                deck_id: Set(r.deck_id.clone()),
            }
        }).collect();
        if !models.is_empty() {
            character_relationship::Entity::insert_many(models).exec(db).await?;
        }
    }

    // 5. Upsert narrative arcs (avoid N+1 with HashMap)
    if let Some(arcs) = &payload.narrative_arcs {
        // Load existing arcs for this deck
        let existing_arcs = deck_narrative_arc::Entity::find()
            .filter(deck_narrative_arc::COLUMN.deck_id.eq(deck_id))
            .all(db)
            .await?;
        let existing_map: HashMap<(String, String), deck_narrative_arc::Model> = existing_arcs
            .into_iter()
            .map(|a| ((a.rank.clone(), a.suit.clone()), a))
            .collect();

        for a in arcs {
            let key = (a.rank.clone(), a.suit.clone());
            if let Some(existing) = existing_map.get(&key) {
                let mut active: deck_narrative_arc::ActiveModel = existing.clone().into();
                active.description = Set(a.description.clone());
                active.update(db).await?;
            } else {
                // Create new arc (though normally all should exist from scaffold)
                deck_narrative_arc::ActiveModel {
                    arc_id: Set(uuid::Uuid::new_v4().to_string()),
                    deck_id: Set(deck_id.to_string()),
                    rank: Set(a.rank.clone()),
                    suit: Set(a.suit.clone()),
                    description: Set(a.description.clone()),
                    step_order: Set(0),
                }.insert(db).await?;
            }
        }
    }

    tracing::info!(deck_id, "ingest completed");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sbdc_dto::ingest::ArcPayload;
    use sea_orm::Database;
    use tempfile::tempdir;

    async fn setup_test_db() -> DatabaseConnection {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        db.get_schema_registry("sbdc_entity::*").sync(&db).await.unwrap();
        db
    }

    async fn create_test_deck(db: &DatabaseConnection, deck_id: &str) {
        use sbdc_entity::deck;
        let deck = deck::ActiveModel {
            deck_id: Set(deck_id.to_string()),
            season_id: Set("test_season".to_string()),
            status: Set("pending".to_string()),
            art_style: Set("test".to_string()),
            theme: Set("test".to_string()),
            junction_type: Set("junction-battle".to_string()),
        };
        deck.insert(db).await.unwrap();
    }

    #[tokio::test]
    async fn ingest_valid_payload_updates_arcs() {
        let db = setup_test_db().await;
        let deck_id = "ingest-test";
        create_test_deck(&db, deck_id).await;

        // First scaffold to have initial arcs
        use crate::scaffold::run_scaffold;
        let dir = tempdir().unwrap();
        run_scaffold(&db, dir.path(), deck_id, "test_season").await.unwrap();

        let json_path = dir.path().join("ingest.json");
        let payload = serde_json::json!({
            "narrative_arcs": [
                {"rank": "2", "suit": "s", "description": "Updated breach description"},
                {"rank": "3", "suit": "h", "description": "New heart arc"}
            ]
        });
        tokio::fs::write(&json_path, payload.to_string()).await.unwrap();

        run_ingest_json(&db, deck_id, &json_path).await.unwrap();

        let updated_arc = deck_narrative_arc::Entity::find()
            .filter(deck_narrative_arc::COLUMN.deck_id.eq(deck_id))
            .filter(deck_narrative_arc::COLUMN.rank.eq("2"))
            .filter(deck_narrative_arc::COLUMN.suit.eq("s"))
            .one(&db).await.unwrap()
            .unwrap();
        assert_eq!(updated_arc.description, "Updated breach description");
    }
}
