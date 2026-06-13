use super::HandAnalysisParams;
use serde::Deserialize;

static TEMPLATES_JSON: &str = include_str!("../assets/templates.json");

#[derive(Debug, Clone, Deserialize)]
pub struct Template {
    pub id: String,
    pub name: String,
    pub output_text: String,
    pub rules: TemplateRules,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TemplateRules {
    pub positions: Option<Vec<String>>,
    pub min_pot_odds_ratio: Option<f64>,
    pub max_pot_odds_ratio: Option<f64>,
    pub min_hand_strength: Option<f64>,
    pub max_hand_strength: Option<f64>,
    pub is_bluff_catching: Option<bool>,
    pub is_cbet_situation: Option<bool>,
    pub min_stack_bb: Option<f64>,
    pub max_stack_bb: Option<f64>,
}

pub struct TemplateLibrary { templates: Vec<Template> }

impl TemplateLibrary {
    pub fn load() -> Self {
        let templates: Vec<Template> = serde_json::from_str(TEMPLATES_JSON).expect("invalid templates.json");
        Self { templates }
    }
    pub fn select(&self, params: &HandAnalysisParams) -> Option<&Template> {
        self.templates.iter().find(|t| t.rules.matches(params))
    }
}

impl Template {
    pub fn render(&self, params: &HandAnalysisParams) -> String {
        self.output_text
            .replace("{pot_odds}", &format!("{:.1}:1", params.pot_odds_ratio))
            .replace("{hand_strength}", &format!("{:.2}", params.hand_strength))
            .replace("{position}", &params.position)
            .replace("{stack_bb}", &format!("{:.1}", params.stack_bb))
    }
}

impl TemplateRules {
    fn matches(&self, params: &HandAnalysisParams) -> bool {
        if let Some(ref positions) = self.positions { if !positions.contains(&params.position) { return false; } }
        if let Some(min) = self.min_pot_odds_ratio { if params.pot_odds_ratio < min { return false; } }
        if let Some(max) = self.max_pot_odds_ratio { if params.pot_odds_ratio > max { return false; } }
        if let Some(min) = self.min_hand_strength { if params.hand_strength < min { return false; } }
        if let Some(max) = self.max_hand_strength { if params.hand_strength > max { return false; } }
        if let Some(expect) = self.is_bluff_catching { if params.is_bluff_catching != expect { return false; } }
        if let Some(expect) = self.is_cbet_situation { if params.is_cbet_situation != expect { return false; } }
        if let Some(min) = self.min_stack_bb { if params.stack_bb < min { return false; } }
        if let Some(max) = self.max_stack_bb { if params.stack_bb > max { return false; } }
        true
    }
}
