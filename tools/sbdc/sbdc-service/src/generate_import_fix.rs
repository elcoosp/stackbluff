use crate::error::{Result, SbdcError};
use sbdc_entity::{generated_prompt, prompt_take, deck};
use sea_orm::{NotSet, ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
use serde::{Deserialize, Serialize};
use std::path::Path;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;
use tracing;
