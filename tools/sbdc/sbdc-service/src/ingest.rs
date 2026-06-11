use crate::error::{Result, SbdcError};
use sbdc_dto::ingest::IngestPayload;
use sbdc_entity::{character_relationship, deck, deck_narrative_arc, lore_entry};
use sea_orm::{ActiveModelTrait, EntityTrait, QueryFilter, Set};
use std::collections::HashMap;
use std::path::Path;
use tracing;

pub async fn run_ingest_json(
    db: &sea_orm::DatabaseConnection,
    deck_id: &str,
    file_path: &Path,
) -> Result<()> {
    // Verify deck exists
    let deck_exists = deck::Entity::find()
        .filter(deck::COLUMN.deck_id.eq(deck_id))
        .one(db)
        .await?
        .is_some();
    if !deck_exists {
        return Err(SbdcError::DeckNotFound(deck_id.into()));
    }

    let content = tokio::fs::read_to_string(file_path).await?;
    let payload: IngestPayload = serde_json::from_str(&content)?;
    payload
        .validate()
        .map_err(|e| SbdcError::Validation(e.to_string()))?;

    // Batch insert lore entries
    if let Some(lores) = &payload.lore_entries {
        let models: Vec<lore_entry::ActiveModel> = lores
            .iter()
            .map(|l| lore_entry::ActiveModel {
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
            })
            .collect();
        if !models.is_empty() {
            lore_entry::Entity::insert_many(models).exec(db).await?;
        }
    }

    // Batch insert character relationships
    if let Some(rels) = &payload.character_relationships {
        let models: Vec<character_relationship::ActiveModel> = rels
            .iter()
            .map(|r| character_relationship::ActiveModel {
                relationship_id: Set(uuid::Uuid::new_v4().to_string()),
                character_id_a: Set(r.character_id_a.clone()),
                character_id_b: Set(r.character_id_b.clone()),
                relationship_type: Set(r.relationship_type.clone()),
                description: Set(r.description.clone()),
                deck_id: Set(r.deck_id.clone()),
            })
            .collect();
        if !models.is_empty() {
            character_relationship::Entity::insert_many(models)
                .exec(db)
                .await?;
        }
    }

    // Upsert narrative arcs
    if let Some(arcs) = &payload.narrative_arcs {
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
                deck_narrative_arc::ActiveModel {
                    arc_id: Set(uuid::Uuid::new_v4().to_string()),
                    deck_id: Set(deck_id.to_string()),
                    rank: Set(a.rank.clone()),
                    suit: Set(a.suit.clone()),
                    description: Set(a.description.clone()),
                    step_order: Set(0),
                }
                .insert(db)
                .await?;
            }
        }
    }

    tracing::info!(deck_id, "ingest completed");
    Ok(())
}
