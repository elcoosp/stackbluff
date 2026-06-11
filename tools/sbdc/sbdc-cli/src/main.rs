use clap::{Parser, Subcommand};
use std::path::PathBuf;
use tracing_subscriber::EnvFilter;
use tokio::fs;

#[derive(Parser)]
#[command(name = "sbdc", about = "StackBluff Deck Creator", version)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
    #[arg(long, default_value = ".", global = true)]
    project_dir: PathBuf,
}

#[derive(Subcommand)]
enum Commands {
    Init,
    Scaffold {
        #[arg(short, long)]
        deck_id: String,
        #[arg(short, long, default_value = "default_season")]
        season_id: String,
    },
    IngestJson {
        #[arg(short, long)]
        deck_id: String,
        #[arg(short, long)]
        file: PathBuf,
    },
    BuildPrompts {
        #[arg(short, long)]
        deck_id: String,
    },
    Clean {
        #[arg(short, long)]
        deck_id: String,
    },
    Where {
        #[arg(short, long)]
        deck_id: String,
    },
    Serve {
        #[arg(long, default_value_t = 8899)]
        port: u16,
    },
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    tracing_subscriber::fmt().with_env_filter(EnvFilter::from_default_env().add_directive("sbdc=info".parse()?)).init();

    // Ensure .sbdc directory exists before connecting to database
    let sbdc_dir = cli.project_dir.join(".sbdc");
    fs::create_dir_all(&sbdc_dir).await?;

    let db_url = sbdc_service::db::db_url(&cli.project_dir);
    let db = sbdc_service::db::connect(&db_url).await?;

    let result = match cli.command {
        Commands::Init => sbdc_service::init::run_init(&db, &cli.project_dir).await,
        Commands::Scaffold { deck_id, season_id } => sbdc_service::scaffold::run_scaffold(&db, &cli.project_dir, &deck_id, &season_id).await,
        Commands::IngestJson { deck_id, file } => sbdc_service::ingest::run_ingest_json(&db, &deck_id, &file).await,
        Commands::BuildPrompts { deck_id } => sbdc_service::build_prompts::run_build_prompts(&db, &deck_id).await,
        Commands::Serve { port } => sbdc_service::server::run_server(db, cli.project_dir, port).await,
        Commands::Clean { deck_id } => sbdc_service::clean::run_clean(&db, &cli.project_dir, &deck_id).await,
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
    };
    result?;
    Ok(())
}
