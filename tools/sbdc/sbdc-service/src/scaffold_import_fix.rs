use crate::error::{Result, SbdcError};
use sbdc_entity::{deck, deck_narrative_arc, generated_prompt};
use sea_orm::{NotSet, ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set, TransactionSession, TransactionTrait};
use std::path::Path;
use tokio::fs;
use tracing;
