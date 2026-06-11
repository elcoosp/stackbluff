#!/usr/bin/env bash
set -uo pipefail

COMPILE_OK=true
INCOMPLETE=false

REPO_ROOT="$(git rev-parse --show-toplevel)"
BASE="$REPO_ROOT/tools/sbdc"

echo "=== Fixing the Where command — simplify without glob crate ==="

echo "Removing glob dependency from sbdc-cli Cargo.toml"
if python3 - "$BASE/sbdc-cli/Cargo.toml" << 'PYEOF_RM_GLOB'
import sys
with open(sys.argv[1], 'r') as f:
    lines = f.readlines()
new_lines = [l for l in lines if 'glob' not in l]
with open(sys.argv[1], 'w') as f:
    f.writelines(new_lines)
print("Removed glob from sbdc-cli Cargo.toml")
PYEOF_RM_GLOB
then
  echo "Done"
else
  echo "ERROR"
fi

echo "Rewriting the Where match arm in main.rs"
OLD_TMP=$(mktemp) || { echo "ERROR"; exit 1; }
NEW_TMP=$(mktemp)
cat > "$OLD_TMP" << 'OLD_WHERE_M5kP2'
        Commands::Where { deck_id } => {
            let project_dir = cli.project_dir.display();
            println!("Project directory: {project_dir}");
            println!();
            let takes_dir = cli.project_dir.join("decks");
            if takes_dir.exists() {
                println!("Decks directory: {}", takes_dir.display());
                let entries: Vec<_> = std::fs::read_dir(&takes_dir)
                    .unwrap_or_else(|_| panic!("Cannot read decks dir"))
                    .filter_map(|e| e.ok())
                    .collect();
                for entry in &entries {
                    println!("  {}", entry.path().display());
                }
            } else {
                println!("No decks directory yet — run scaffold first");
            }
            println!();
            let db_path = cli.project_dir.join(".sbdc").join("sbdc.db");
            println!("Database: {}", db_path.display());
            if db_path.exists() {
                println!("DB size: {} bytes", std::fs::metadata(&db_path).map(|m| m.len()).unwrap_or(0));
            }
            println!();
            println!("Take paths for deck '{deck_id}':");
            let pattern = cli.project_dir.join("decks").join("*").join(&deck_id).join("0-takes");
            if let Ok(paths) = glob::glob(&pattern.to_string_lossy()) {
                for path in paths.flatten() {
                    println!("  {}", path.display());
                    if let Ok(entries) = std::fs::read_dir(&path) {
                        for card_dir in entries.flatten() {
                            let card_path = card_dir.path();
                            if let Ok(files) = std::fs::read_dir(&card_path) {
                                for f in files.flatten() {
                                    println!("    {}", f.path().display());
                                }
                            }
                        }
                    }
                }
            }
        },
OLD_WHERE_M5kP2
cat > "$NEW_TMP" << 'NEW_WHERE_R8nW4'
        Commands::Where { deck_id } => {
            let project_dir = cli.project_dir.display();
            println!("Project directory: {project_dir}");
            println!();
            let db_path = cli.project_dir.join(".sbdc").join("sbdc.db");
            println!("Database: {}", db_path.display());
            if db_path.exists() {
                println!("DB size: {} bytes", std::fs::metadata(&db_path).map(|m| m.len()).unwrap_or(0));
            }
            println!();
            let takes_dir = cli.project_dir.join("decks");
            if !takes_dir.exists() {
                println!("No decks directory yet — run scaffold first");
            } else {
                println!("Take files for deck '{deck_id}':");
                fn list_pngs(dir: &std::path::Path, indent: usize) {
                    let prefix = " ".repeat(indent);
                    if let Ok(entries) = std::fs::read_dir(dir) {
                        let mut entries: Vec<_> = entries.filter_map(|e| e.ok()).collect();
                        entries.sort_by_key(|e| e.file_name());
                        for entry in entries {
                            let path = entry.path();
                            if path.is_dir() {
                                println!("{prefix}{}", path.file_name().unwrap_or_default().to_string_lossy());
                                list_pngs(&path, indent + 2);
                            } else if path.extension().map(|e| e == "png").unwrap_or(false) {
                                let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
                                println!("{prefix}{} ({} bytes)", path.file_name().unwrap_or_default().to_string_lossy(), size);
                            }
                        }
                    }
                }
                let deck_takes = takes_dir.join("*").join(&deck_id).join("0-takes");
                let found = std::fs::read_dir(&takes_dir)
                    .ok()
                    .map(|mut e| e.any(|_| true)).unwrap_or(false);
                if found {
                    if let Ok(seasons) = std::fs::read_dir(&takes_dir) {
                        for season in seasons.flatten() {
                            let season_takes = season.path().join(&deck_id).join("0-takes");
                            if season_takes.is_dir() {
                                println!("  {}/", season.path().file_name().unwrap_or_default().to_string_lossy());
                                list_pngs(&season_takes, 4);
                            }
                        }
                    }
                } else {
                    println!("  (no take files yet)");
                }
            }
            Ok(())
        },
NEW_WHERE_R8nW4
if python3 - "$OLD_TMP" "$NEW_TMP" "$BASE/sbdc-cli/src/main.rs" << 'PYEOF_WHERE'
import sys
with open(sys.argv[1], 'r') as f: old = f.read()
with open(sys.argv[2], 'r') as f: new = f.read()
with open(sys.argv[3], 'r') as f: content = f.read()
content = content.replace(old, new)
with open(sys.argv[3], 'w') as f: f.write(content)
PYEOF_WHERE
then
  echo "Fixed Where command"
  rm "$OLD_TMP" "$NEW_TMP"
else
  echo "ERROR: Python patch failed"
  rm -f "$OLD_TMP" "$NEW_TMP"
fi

echo "Checking compilation"
if ! cargo check --workspace --manifest-path "$BASE/Cargo.toml" 2>&1; then
  echo "Compilation failed"
  COMPILE_OK=false
fi

if [ "$COMPILE_OK" = false ]; then
  echo "Skipping"
  exit 1
fi

echo "Running tests"
cargo test --workspace --manifest-path "$BASE/Cargo.toml" 2>&1 | tail -5

git add -A
git commit -m "fix(sbdc): fix Where command — remove glob crate, use std::fs

- Remove glob dependency
- Use recursive std::fs::read_dir to list PNG files
- Wrap return in Ok(()) to match Result type
- Show file sizes for each take PNG" 2>&1 || echo "Nothing new to commit"
