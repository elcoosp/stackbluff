use serde::Deserialize;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum IngestValidationError {
    #[error("invalid rank: {0}. Must be 2-10, J, Q, K, A")]
    InvalidRank(String),
    #[error("invalid suit: {0}. Must be s, h, d, c")]
    InvalidSuit(String),
    #[error("empty content on lore entry: {0}")]
    EmptyLoreContent(String),
}

const VALID_RANKS: &[&str] = &["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const VALID_SUITS: &[&str] = &["s", "h", "d", "c"];

#[derive(Deserialize, Debug)]
pub struct IngestPayload {
    pub lore_entries: Option<Vec<LoreEntryPayload>>,
    pub character_relationships: Option<Vec<RelationshipPayload>>,
    pub narrative_arcs: Option<Vec<ArcPayload>>,
}

#[derive(Deserialize, Debug)]
pub struct LoreEntryPayload {
    pub parent_entity: String,
    pub parent_id: String,
    pub category: String,
    pub title: String,
    pub content: String,
    pub source: String,
    pub status: String,
    pub injectable: bool,
    pub injection_weight: i32,
}

#[derive(Deserialize, Debug)]
pub struct RelationshipPayload {
    pub character_id_a: String,
    pub character_id_b: String,
    pub relationship_type: String,
    pub description: String,
    pub deck_id: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct ArcPayload {
    pub rank: String,
    pub suit: String,
    pub description: String,
}

impl IngestPayload {
    pub fn validate(&self) -> Result<(), IngestValidationError> {
        if let Some(lores) = &self.lore_entries {
            for l in lores {
                if l.content.trim().is_empty() {
                    return Err(IngestValidationError::EmptyLoreContent(l.title.clone()));
                }
            }
        }
        if let Some(arcs) = &self.narrative_arcs {
            for a in arcs {
                if !VALID_RANKS.contains(&a.rank.as_str()) {
                    return Err(IngestValidationError::InvalidRank(a.rank.clone()));
                }
                if !VALID_SUITS.contains(&a.suit.as_str()) {
                    return Err(IngestValidationError::InvalidSuit(a.suit.clone()));
                }
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_payload_passes() {
        let payload = IngestPayload {
            lore_entries: None,
            character_relationships: None,
            narrative_arcs: Some(vec![ArcPayload { rank: "A".into(), suit: "s".into(), description: "test".into() }]),
        };
        assert!(payload.validate().is_ok());
    }

    #[test]
    fn invalid_rank_fails() {
        let payload = IngestPayload {
            lore_entries: None,
            character_relationships: None,
            narrative_arcs: Some(vec![ArcPayload { rank: "1".into(), suit: "s".into(), description: "test".into() }]),
        };
        assert!(matches!(payload.validate(), Err(IngestValidationError::InvalidRank(_))));
    }

    #[test]
    fn invalid_suit_fails() {
        let payload = IngestPayload {
            lore_entries: None,
            character_relationships: None,
            narrative_arcs: Some(vec![ArcPayload { rank: "2".into(), suit: "x".into(), description: "test".into() }]),
        };
        assert!(matches!(payload.validate(), Err(IngestValidationError::InvalidSuit(_))));
    }
}
