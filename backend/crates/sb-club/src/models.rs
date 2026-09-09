use sb_contracts::LeaderboardPage;
use sb_shared_types::ClubId;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
pub struct CreateClubRequest {
    pub name: String,
    pub logo_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CreateClubResponse {
    pub club_id: ClubId,
}

#[derive(Debug, Clone, Serialize)]
pub struct JoinClubResponse {
    pub success: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct GetLeaderboardResponse {
    pub club_id: ClubId,
    pub division: u32,
    pub total_divisions: u32,
    pub total_members: u64,
    pub entries: Vec<LeaderboardEntryDto>,
}

#[derive(Debug, Clone, Serialize)]
pub struct LeaderboardEntryDto {
    pub rank: u32,
    pub user_id: String,
    pub weekly_xp: i64,
}

impl From<LeaderboardPage> for GetLeaderboardResponse {
    fn from(page: LeaderboardPage) -> Self {
        Self {
            club_id: page.club_id,
            division: page.division,
            total_divisions: page.total_divisions,
            total_members: page.total_members,
            entries: page
                .entries
                .into_iter()
                .map(|e| LeaderboardEntryDto {
                    rank: e.rank,
                    user_id: e.user_id.to_string(),
                    weekly_xp: e.weekly_xp,
                })
                .collect(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct GetUserDivisionResponse {
    pub division: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RebalanceResponse {
    pub success: bool,
}
