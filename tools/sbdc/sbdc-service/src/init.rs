use crate::error::Result;
use sbdc_entity::{universe, clan, character, season, junction_type, creative_pattern, framing_instruction, virality_mechanic};
use sea_orm::{ActiveModelTrait, EntityTrait, Set};
use sbdc_migration::MigratorTrait;
use std::path::Path;
use tokio::fs;
use tracing;

pub async fn run_init(db: &sea_orm::DatabaseConnection, project_dir: &Path) -> Result<()> {
    let sbdc_dir = project_dir.join(".sbdc");
    if !sbdc_dir.exists() {
        fs::create_dir_all(&sbdc_dir).await?;
    }

    // Run production migrations
    sbdc_migration::Migrator::up(db, None).await?;
    tracing::info!("database schema migrated");

    // Seed Universe (if not exists)
    if universe::Entity::find().one(db).await?.is_none() {
        universe::ActiveModel {
            universe_id: Set("default".into()),
            art_direction: Set("Fantasy Illustration".into()),
            background_invariant: Set("pure white background #FFFFFF".into()),
            lighting_invariant: Set("studio lighting, no shadows cast on background".into()),
            animation_philosophy: Set("subtle, slow motion, no camera shake, 2 seconds loop, similar start and end frame".into()),
            hidden_gems_rule: Set("mascot hidden once on each face card".into()),
            default_negative: Set("text, watermark, blurry, deformed".into()),
        }.insert(db).await?;
    }

    // Seed Season
    if season::Entity::find().one(db).await?.is_none() {
        season::ActiveModel {
            season_id: Set("default_season".into()),
            universe_id: Set("default".into()),
            season_name: Set("Season 1".into()),
            global_event: Set("The Convergence".into()),
            season_order: Set(1),
        }.insert(db).await?;
    }

    // Seed 4 Clans
    if clan::Entity::find().one(db).await?.is_none() {
        let clans = [
            ("clan-spades", "Spades", "The Invasion Force", "angular, sharp silhouettes", "#111111", "#EEEEEE", "#888888"),
            ("clan-hearts", "Hearts", "The Resistance", "flowing, organic silhouettes", "#331100", "#FF6666", "#AA4444"),
            ("clan-diamonds", "Diamonds", "The Merchants", "geometric, faceted silhouettes", "#222200", "#FFD700", "#B8860B"),
            ("clan-clubs", "Clubs", "The Commons", "sturdy, grounded silhouettes", "#1a2a1a", "#88AA88", "#446644"),
        ];
        let models: Vec<clan::ActiveModel> = clans.into_iter().map(|(id, name, tagline, sil, dark, accent, sec)| {
            clan::ActiveModel {
                clan_id: Set(id.into()),
                universe_id: Set("default".into()),
                name: Set(name.into()),
                tagline: Set(tagline.into()),
                silhouette: Set(sil.into()),
                border_accent: Set("ornate".into()),
                typography_hint: Set("bold".into()),
                pip_texture: Set("stone".into()),
                primary_dark: Set(dark.into()),
                primary_accent: Set(accent.into()),
                secondary: Set(sec.into()),
                sigil: Set(format!("{}_sigil", name)),
            }
        }).collect();
        clan::Entity::insert_many(models).exec(db).await?;
    }

    // Seed 4 Characters (one per clan)
    if character::Entity::find().one(db).await?.is_none() {
        let chars = [
            ("char-spade-king", "clan-spades", "Spade King", "stern king with iron crown, sharp jawline, wearing black steel armor"),
            ("char-heart-queen", "clan-hearts", "Heart Queen", "graceful queen with flowing gown, soft eyes, wearing silver tiara"),
            ("char-diamond-jack", "clan-diamonds", "Diamond Jack", "cunning merchant with gold-trimmed vest, smirking, holding a gem"),
            ("char-club-joker", "clan-clubs", "Club Joker", "wild jester with wooden mask, grinning, holding a club"),
        ];
        let models: Vec<character::ActiveModel> = chars.into_iter().map(|(id, cid, title, bust)| {
            character::ActiveModel {
                character_id: Set(id.into()),
                clan_id: Set(cid.into()),
                name: Set(title.into()),
                title: Set(title.into()),
                fixed_traits: Set(serde_json::json!({})),
                visual_description: Set(serde_json::json!({})),
                bust_prompt_description: Set(bust.into()),
                artifact_name: Set("Scepter".into()),
                artifact_default_desc: Set("holding an ornate scepter".into()),
                artifact_victory_desc: Set("raising scepter high".into()),
                artifact_defeat_desc: Set("dropping scepter".into()),
            }
        }).collect();
        character::Entity::insert_many(models).exec(db).await?;
    }

    // Seed junction types
    if junction_type::Entity::find().one(db).await?.is_none() {
        let junctions = [
            ("junction-battle", "battle scene, clashing forces"),
            ("junction-dialogue", "two characters speaking, dramatic lighting"),
        ];
        let models: Vec<junction_type::ActiveModel> = junctions.into_iter().map(|(id, frag)| {
            junction_type::ActiveModel {
                junction_id: Set(id.into()),
                prompt_fragment: Set(frag.into()),
            }
        }).collect();
        junction_type::Entity::insert_many(models).exec(db).await?;
    }

    // Seed creative patterns
    if creative_pattern::Entity::find().one(db).await?.is_none() {
        creative_pattern::ActiveModel {
            pattern_id: Set("pattern-1".into()),
            description: Set("dynamic composition, rule of thirds".into()),
        }.insert(db).await?;
    }

    // Seed framing instructions
    if framing_instruction::Entity::find().one(db).await?.is_none() {
        framing_instruction::ActiveModel {
            framing_id: Set("framing-1".into()),
            description: Set("medium shot, eye level".into()),
        }.insert(db).await?;
    }

    // Seed virality mechanics
    if virality_mechanic::Entity::find().one(db).await?.is_none() {
        virality_mechanic::ActiveModel {
            mechanic_id: Set("viral-1".into()),
            description: Set("hidden mascot triggers engagement".into()),
        }.insert(db).await?;
    }

    tracing::info!("init completed with seed data");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sea_orm::Database;
    use tempfile::tempdir;

    async fn setup_test_db() -> DatabaseConnection {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        db.get_schema_registry("sbdc_entity::*").sync(&db).await.unwrap();
        db
    }

    #[tokio::test]
    async fn init_seeds_universe_and_clans() {
        let db = setup_test_db().await;
        let dir = tempdir().unwrap();
        run_init(&db, dir.path()).await.unwrap();

        let clans = clan::Entity::find().all(&db).await.unwrap();
        assert_eq!(clans.len(), 4);
        let chars = character::Entity::find().all(&db).await.unwrap();
        assert_eq!(chars.len(), 4);
        let uni = universe::Entity::find().one(&db).await.unwrap();
        assert!(uni.is_some());
    }
}
