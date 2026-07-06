use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct ClubProSettings {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub banner_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chip_preset_id: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub felt_color: Option<String>,
}

impl ClubProSettings {
    pub fn merge(&mut self, other: ClubProSettings) {
        if other.banner_url.is_some() { self.banner_url = other.banner_url; }
        if other.chip_preset_id.is_some() { self.chip_preset_id = other.chip_preset_id; }
        if other.felt_color.is_some() { self.felt_color = other.felt_color; }
    }

    pub fn validate(&self) -> Result<(), &'static str> {
        const VALID_COLORS: &[&str] = &[
            "#1a6b42", "#2d7a5a", "#3d8b6b", "#4a9c7a",
            "#5aad8a", "#0f4c3a", "#1e5945", "#2a6650",
        ];
        if let Some(id) = self.chip_preset_id
            && !(1..=5).contains(&id) { return Err("chip_preset_id must be 1-5"); }
        if let Some(ref c) = self.felt_color
            && !VALID_COLORS.contains(&c.as_str()) { return Err("invalid felt_color"); }
        if let Some(ref u) = self.banner_url
            && !u.starts_with("https://") { return Err("banner_url must be HTTPS"); }
        Ok(())
    }
}

pub type UpdateClubProSettingsRequest = ClubProSettings;
