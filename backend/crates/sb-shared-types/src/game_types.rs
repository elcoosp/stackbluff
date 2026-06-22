/// Hand result data for mission progress updates.
#[derive(Debug, Clone)]
pub struct HandResult {
    pub hero_raised_preflop: bool,
    pub went_to_showdown: bool,
    pub hero_went_allin: bool,
}
