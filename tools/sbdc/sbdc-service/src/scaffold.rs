use crate::error::{Result, SbdcError};
use sbdc_entity::{deck, deck_narrative_arc, generated_prompt};
use sea_orm::{
    ActiveModelTrait, ConnectionTrait, EntityTrait, NotSet, QueryFilter, Set,
    TransactionSession, TransactionTrait,
};
use std::path::Path;
use tokio::fs;
use tracing;

const RANKS: [&str; 13] = [
    "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A",
];
const SUITS: [&str; 4] = ["s", "h", "d", "c"];

async fn create_deck_dirs(project_dir: &Path, season_id: &str, deck_id: &str) -> Result<()> {
    let base = project_dir.join("decks").join(season_id).join(deck_id);
    let dirs = ["0-takes", "1-selected", "2-masks", "3-clean"];
    for d in dirs {
        fs::create_dir_all(base.join(d)).await?;
    }
    Ok(())
}

async fn insert_deck_record<C>(txn: &C, deck_id: &str, season_id: &str) -> Result<()>
where
    C: ConnectionTrait,
{
    let deck = deck::ActiveModel {
        deck_id: Set(deck_id.to_string()),
        season_id: Set(season_id.to_string()),
        status: Set("pending".into()),
        art_style: Set("realistic fantasy illustration, detailed".into()),
        theme: Set("epic conflict".into()),
        junction_type: Set("junction-battle".into()),
    };
    deck.insert(txn).await?;
    Ok(())
}

async fn insert_narrative_arcs<C>(txn: &C, deck_id: &str, _ordering: &str) -> Result<()>
where
    C: ConnectionTrait,
{
    let mut arcs = Vec::new();
    let mut order = 0;
    for suit in SUITS {
        for rank in RANKS {
            let arc_id = format!("{}_{}_{}", deck_id, suit, rank);
            let description = format!("Card {} of {}: placeholder arc description", rank, suit);
            arcs.push(deck_narrative_arc::ActiveModel {
                arc_id: Set(arc_id),
                deck_id: Set(deck_id.to_string()),
                rank: Set(rank.to_string()),
                suit: Set(suit.to_string()),
                description: Set(description),
                step_order: Set(order),
            });
            order += 1;
        }
    }
    deck_narrative_arc::Entity::insert_many(arcs)
        .exec(txn)
        .await?;
    tracing::info!("inserted {} narrative arcs", order);
    Ok(())
}

async fn insert_prompt_slots<C>(txn: &C, deck_id: &str) -> Result<()>
where
    C: ConnectionTrait,
{
    let mut prompts = Vec::new();
    for suit in SUITS {
        for rank in RANKS {
            let target_card = format!("{}{}", rank, suit);
            let is_face = matches!(rank, "J" | "Q" | "K" | "A");
            let layer = if is_face { "subject" } else { "env" };
            let variant = if is_face { "full" } else { "background" };
            prompts.push(generated_prompt::ActiveModel {
                prompt_id: NotSet,
                deck_id: Set(deck_id.to_string()),
                target_card: Set(target_card.clone()),
                target_layer: Set(layer.to_string()),
                target_variant: Set(variant.to_string()),
                final_positive: Set(String::new()),
                final_negative: Set(String::new()),
                status: Set("pending".into()),
                target_file: Set(format!("{}_{}.png", deck_id, target_card)),
            });
        }
    }
    generated_prompt::Entity::insert_many(prompts)
        .exec(txn)
        .await?;
    Ok(())
}

pub async fn run_scaffold(
    db: &impl TransactionTrait,
    project_dir: &Path,
    deck_id: &str,
    season_id: &str,
) -> Result<()> {
    let txn = db.begin().await?;

    let existing = deck::Entity::find()
        .filter(deck::COLUMN.deck_id.eq(deck_id))
        .one(&txn)
        .await?;

    if existing.is_some() {
        return Err(SbdcError::DeckAlreadyExists(deck_id.into()));
    }

    create_deck_dirs(project_dir, season_id, deck_id).await?;
    insert_deck_record(&txn, deck_id, season_id).await?;
    insert_narrative_arcs(&txn, deck_id, "sequential-by-rank").await?;
    insert_prompt_slots(&txn, deck_id).await?;

    txn.commit().await?;
    tracing::info!(
        "scaffolded deck {} with {} prompt slots",
        deck_id,
        RANKS.len() * SUITS.len()
    );
    Ok(())
}
