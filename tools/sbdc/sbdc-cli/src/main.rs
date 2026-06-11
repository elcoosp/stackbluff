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
    Generate {
        #[arg(short, long)]
        deck_id: String,
        #[arg(long, default_value_t = 4)]
        takes: u32,
        #[arg(long, default_value = "5-15")]
        delay: String,
    },
    Clean {
        #[arg(short, long)]
        deck_id: String,
    },
    Serve {
        #[arg(short, long)]
        deck_id: String,
        #[arg(long, default_value_t = 8899)]
        port: u16,
        #[arg(long, default_value_t = 4)]
        takes: u32,
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
        Commands::Generate { deck_id, takes, delay } => sbdc_service::generate::run_generate(&db, &cli.project_dir, &deck_id, takes, &delay).await,
        Commands::Serve { deck_id: _, port, takes: _ } => sbdc_service::server::run_server(db, cli.project_dir, port).await,
        Commands::Clean { deck_id } => sbdc_service::clean::run_clean(&db, &cli.project_dir, &deck_id).await,
    };
    result?;
    Ok(())
}
