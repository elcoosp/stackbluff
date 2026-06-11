#!/usr/bin/env bash
set -uo pipefail

cd tools/sbdc || { echo "ERROR: cannot cd to tools/sbdc"; exit 1; }

echo "=== Fix test helpers: use execute_unprepared with ConnectionTrait ==="

# Patch init.rs test module
cat > sbdc-service/src/init_test_fixed2.rs << 'INIT_TEST_FIXED2'
#[cfg(test)]
mod tests {
    use super::*;
    use sea_orm::{Database, DatabaseConnection, ConnectionTrait};
    use sbdc_migration::Migrator;
    use sbdc_migration::MigratorTrait;
    use tempfile::tempdir;

    async fn setup_test_db() -> DatabaseConnection {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        // Enable foreign keys for SQLite
        db.execute_unprepared("PRAGMA foreign_keys = ON;").await.unwrap();
        Migrator::up(&db, None).await.unwrap();
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
INIT_TEST_FIXED2

python3 << 'PYEOF'
import re
with open('sbdc-service/src/init.rs', 'r') as f:
    content = f.read()
content = re.sub(r'#\[cfg\(test\)\].*$', '', content, flags=re.DOTALL)
with open('sbdc-service/src/init_test_fixed2.rs', 'r') as test_f:
    test_content = test_f.read()
content += '\n' + test_content
with open('sbdc-service/src/init.rs', 'w') as f:
    f.write(content)
PYEOF

# Patch scaffold.rs test module
cat > sbdc-service/src/scaffold_test_fixed2.rs << 'SCAFFOLD_TEST_FIXED2'
#[cfg(test)]
mod tests {
    use super::*;
    use sea_orm::{Database, DatabaseConnection, ConnectionTrait};
    use crate::init::run_init;
    use sbdc_migration::Migrator;
    use sbdc_migration::MigratorTrait;
    use tempfile::tempdir;

    async fn setup_test_db() -> DatabaseConnection {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        db.execute_unprepared("PRAGMA foreign_keys = ON;").await.unwrap();
        Migrator::up(&db, None).await.unwrap();
        db
    }

    #[tokio::test]
    async fn scaffold_creates_deck_and_arcs() {
        let db = setup_test_db().await;
        let dir = tempdir().unwrap();
        run_init(&db, dir.path()).await.unwrap();
        run_scaffold(&db, dir.path(), "test-deck", "default_season").await.unwrap();

        let deck = deck::Entity::find().filter(deck::COLUMN.deck_id.eq("test-deck")).one(&db).await.unwrap();
        assert!(deck.is_some());
        let arcs = deck_narrative_arc::Entity::find().filter(deck_narrative_arc::COLUMN.deck_id.eq("test-deck")).all(&db).await.unwrap();
        assert_eq!(arcs.len(), 52);
        let prompts = generated_prompt::Entity::find().filter(generated_prompt::COLUMN.deck_id.eq("test-deck")).all(&db).await.unwrap();
        assert_eq!(prompts.len(), 52);
    }

    #[tokio::test]
    async fn scaffold_fails_on_duplicate() {
        let db = setup_test_db().await;
        let dir = tempdir().unwrap();
        run_init(&db, dir.path()).await.unwrap();
        run_scaffold(&db, dir.path(), "dup-deck", "default_season").await.unwrap();
        let result = run_scaffold(&db, dir.path(), "dup-deck", "default_season").await;
        assert!(matches!(result, Err(SbdcError::DeckAlreadyExists(_))));
    }
}
SCAFFOLD_TEST_FIXED2

python3 << 'PYEOF'
import re
with open('sbdc-service/src/scaffold.rs', 'r') as f:
    content = f.read()
content = re.sub(r'#\[cfg\(test\)\].*$', '', content, flags=re.DOTALL)
with open('sbdc-service/src/scaffold_test_fixed2.rs', 'r') as test_f:
    test_content = test_f.read()
content += '\n' + test_content
with open('sbdc-service/src/scaffold.rs', 'w') as f:
    f.write(content)
PYEOF

# Patch ingest.rs test module
cat > sbdc-service/src/ingest_test_fixed2.rs << 'INGEST_TEST_FIXED2'
#[cfg(test)]
mod tests {
    use super::*;
    use sea_orm::{Database, DatabaseConnection, ConnectionTrait};
    use crate::init::run_init;
    use crate::scaffold::run_scaffold;
    use sbdc_migration::Migrator;
    use sbdc_migration::MigratorTrait;
    use tempfile::tempdir;

    async fn setup_test_db() -> DatabaseConnection {
        let db = Database::connect("sqlite::memory:").await.unwrap();
        db.execute_unprepared("PRAGMA foreign_keys = ON;").await.unwrap();
        Migrator::up(&db, None).await.unwrap();
        db
    }

    #[tokio::test]
    async fn ingest_valid_payload_updates_arcs() {
        let db = setup_test_db().await;
        let dir = tempdir().unwrap();
        run_init(&db, dir.path()).await.unwrap();

        let deck_id = "ingest-test";
        run_scaffold(&db, dir.path(), deck_id, "default_season").await.unwrap();

        let json_path = dir.path().join("ingest.json");
        let payload = serde_json::json!({
            "narrative_arcs": [
                {"rank": "2", "suit": "s", "description": "Updated breach description"},
                {"rank": "3", "suit": "h", "description": "New heart arc"}
            ]
        });
        let json_string = serde_json::to_string(&payload).unwrap();
        tokio::fs::write(&json_path, json_string).await.unwrap();

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
INGEST_TEST_FIXED2

python3 << 'PYEOF'
import re
with open('sbdc-service/src/ingest.rs', 'r') as f:
    content = f.read()
content = re.sub(r'#\[cfg\(test\)\].*$', '', content, flags=re.DOTALL)
with open('sbdc-service/src/ingest_test_fixed2.rs', 'r') as test_f:
    test_content = test_f.read()
content += '\n' + test_content
with open('sbdc-service/src/ingest.rs', 'w') as f:
    f.write(content)
PYEOF

echo "=== Running cargo test ==="

if cargo test -p sbdc-service -- --nocapture 2>&1; then
  echo "All tests passed"
  COMPILE_OK=true
else
  echo "Tests still failing"
  COMPILE_OK=false
fi

if [ "$COMPILE_OK" = true ]; then
  echo "All fixes applied. Committing."
  git add -A
  git commit -m "fix: use execute_unprepared with ConnectionTrait in test helpers, correct PRAGMA for foreign keys"
fi

exit 0
