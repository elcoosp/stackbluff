use serde::{Deserialize, Serialize};
use strum::{Display, EnumIter, IntoEnumIterator};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct MissionId(pub u32);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Mission {
    pub id: MissionId,
    pub mission_type: String,
    pub description: String,
    pub reward_chips: i64,
    pub completed: bool,
    pub progress: u32,
    pub target: u32,
    pub category: MissionCategory,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MissionCategory {
    Easy,
    Medium,
    Viral,
    Weekly,
}

#[derive(Debug, Clone, Display, EnumIter, PartialEq, Eq)]
pub enum MissionType {
    #[strum(to_string = "win_flush")]           WinFlush,
    #[strum(to_string = "bluff_success_2")]      BluffSuccess2,
    #[strum(to_string = "win_three_hands")]      WinThreeHands,
    #[strum(to_string = "fold_preflop_5")]        FoldPreflop5,
    #[strum(to_string = "call_bluff")]           CallBluff,
    #[strum(to_string = "all_in_win")]           AllInWin,
    #[strum(to_string = "high_card_win")]        HighCardWin,
    #[strum(to_string = "pair_win")]             PairWin,
    #[strum(to_string = "two_pair_win")]         TwoPairWin,
    #[strum(to_string = "trips_win")]            TripsWin,
    #[strum(to_string = "straight_win")]         StraightWin,
    #[strum(to_string = "flush_win")]            FlushWin,
    #[strum(to_string = "full_house_win")]       FullHouseWin,
    #[strum(to_string = "quads_win")]            QuadsWin,
    #[strum(to_string = "straight_flush_win")]   StraightFlushWin,
    #[strum(to_string = "check_raise_success")]  CheckRaiseSuccess,
    #[strum(to_string = "steal_blinds_2")]        StealBlinds2,
    #[strum(to_string = "survive_all_in")]       SurviveAllIn,
    #[strum(to_string = "win_no_showdown")]      WinNoShowdown,
    #[strum(to_string = "play_10_hands")]        Play10Hands,
    #[strum(to_string = "play_20_hands")]        Play20Hands,
    #[strum(to_string = "win_two_consecutive")]  WinTwoConsecutive,
    #[strum(to_string = "bust_1_player")]        Bust1Player,
    #[strum(to_string = "river_win")]            RiverWin,
    #[strum(to_string = "bad_beat_win")]         BadBeatWin,
    #[strum(to_string = "raise_preflop_10")]      RaisePreflop10,
    #[strum(to_string = "showdown_5")]           Showdown5,
    #[strum(to_string = "button_win")]           ButtonWin,
    #[strum(to_string = "all_in_3")]             AllIn3,
    #[strum(to_string = "bluff_river_2folds")]   BluffRiver2Folds,
    #[strum(to_string = "high_stake_5")]          HighStake5,
    #[strum(to_string = "share_replay")]         ShareReplay,
    #[strum(to_string = "referral_5_hands")]     Referral5Hands,
    #[strum(to_string = "oracle_student")]       OracleStudent,
}

pub fn all_mission_definitions() -> Vec<(String, String, i64, u32, MissionCategory)> {
    use MissionType::*;
    use MissionCategory::*;
    MissionType::iter().map(|mt| {
        match mt {
            WinFlush            => ("win_flush".into(), "Win a hand with a flush".into(), 500, 1u32, Medium),
            BluffSuccess2       => ("bluff_success_2".into(), "Bluff successfully 2 times".into(), 400, 2u32, Medium),
            WinThreeHands       => ("win_three_hands".into(), "Win 3 hands in a row".into(), 600, 3u32, Medium),
            FoldPreflop5        => ("fold_preflop_5".into(), "Fold preflop 5 times".into(), 200, 5u32, Easy),
            CallBluff           => ("call_bluff".into(), "Call a bluff correctly".into(), 350, 1u32, Medium),
            AllInWin            => ("all_in_win".into(), "Win an all‑in confrontation".into(), 700, 1u32, Medium),
            HighCardWin         => ("high_card_win".into(), "Win with high card".into(), 300, 1u32, Easy),
            PairWin             => ("pair_win".into(), "Win with one pair".into(), 250, 1u32, Easy),
            TwoPairWin          => ("two_pair_win".into(), "Win with two pair".into(), 300, 1u32, Easy),
            TripsWin            => ("trips_win".into(), "Win with three of a kind".into(), 450, 1u32, Easy),
            StraightWin         => ("straight_win".into(), "Win with a straight".into(), 500, 1u32, Medium),
            FlushWin            => ("flush_win".into(), "Win with a flush".into(), 550, 1u32, Medium),
            FullHouseWin        => ("full_house_win".into(), "Win with a full house".into(), 650, 1u32, Medium),
            QuadsWin            => ("quads_win".into(), "Win with four of a kind".into(), 800, 1u32, Medium),
            StraightFlushWin    => ("straight_flush_win".into(), "Win with a straight flush".into(), 1000, 1u32, Medium),
            CheckRaiseSuccess   => ("check_raise_success".into(), "Successfully check‑raise".into(), 350, 1u32, Medium),
            StealBlinds2        => ("steal_blinds_2".into(), "Steal blinds twice".into(), 300, 2u32, Medium),
            SurviveAllIn        => ("survive_all_in".into(), "Survive an all‑in without winning".into(), 250, 1u32, Easy),
            WinNoShowdown       => ("win_no_showdown".into(), "Win without showdown".into(), 200, 1u32, Easy),
            Play10Hands         => ("play_10_hands".into(), "Play 10 hands".into(), 150, 10u32, Easy),
            Play20Hands         => ("play_20_hands".into(), "Play 20 hands".into(), 300, 20u32, Easy),
            WinTwoConsecutive   => ("win_two_consecutive".into(), "Win 2 consecutive hands".into(), 400, 2u32, Medium),
            Bust1Player         => ("bust_1_player".into(), "Eliminate a player".into(), 500, 1u32, Medium),
            RiverWin            => ("river_win".into(), "Win a hand on the river".into(), 400, 1u32, Medium),
            BadBeatWin          => ("bad_beat_win".into(), "Win as an underdog".into(), 450, 1u32, Medium),
            RaisePreflop10      => ("raise_preflop_10".into(), "Raise pre‑flop 10 times".into(), 250, 10u32, Easy),
            Showdown5           => ("showdown_5".into(), "Go to showdown 5 times".into(), 200, 5u32, Easy),
            ButtonWin           => ("button_win".into(), "Win a hand from the button".into(), 350, 1u32, Easy),
            AllIn3              => ("all_in_3".into(), "Go all‑in 3 times".into(), 300, 3u32, Easy),
            BluffRiver2Folds    => ("bluff_river_2folds".into(), "Make 2 players fold to your river bet".into(), 500, 2u32, Medium),
            HighStake5          => ("high_stake_5".into(), "Play 5 hands at highest stake".into(), 400, 5u32, Medium),
            ShareReplay         => ("share_replay".into(), "Share a replay card".into(), 300, 1u32, Viral),
            Referral5Hands      => ("referral_5_hands".into(), "Refer a friend who plays 5 hands".into(), 500, 1u32, Viral),
            OracleStudent       => ("oracle_student".into(), "Use The Oracle 2 times".into(), 250, 2u32, Easy),
        }
    }).collect()
}
