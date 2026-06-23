use sb_shared_types::{ChipAmount, StakeLevel, TableConfig, TableId, UserId};
use sb_table_registry::actor::{spawn_table_actor, InternalCommand, LeaveResult};
use sb_table_registry::game_room::RoomMessage;
use sb_contracts::stats_api::PlayerStatsRepo;
use std::sync::Arc;
use tokio::sync::mpsc;

struct DummyStatsRepo;
impl PlayerStatsRepo for DummyStatsRepo {
    async fn get(&self, _user_id: &str) -> Result<sb_shared_types::player_stats::PlayerStatsDto, sb_shared_types::AppError> {
        Ok(sb_shared_types::player_stats::PlayerStatsDto::default())
    }
}

#[tokio::test]
async fn kick_vote_passes_and_refunds() {
    let (event_tx, _) = tokio::sync::broadcast::channel(1);
    let stats_repo = Arc::new(DummyStatsRepo);
    let active_players = Arc::new(std::sync::atomic::AtomicU8::new(0));
    let config = TableConfig {
        min_buy_in: ChipAmount::new(100).unwrap(),
        max_buy_in: ChipAmount::new(10000).unwrap(),
        stake_level: StakeLevel::Low,
        max_players: 6,
        turn_time_limit_ms: 30000,
    };
    let (actor_tx, _handle) = spawn_table_actor(
        TableId::new(uuid::Uuid::new_v4()),
        TableId::new(uuid::Uuid::new_v4()),
        config.clone(),
        event_tx,
        stats_repo,
        active_players,
    );

    // Helper to join a player
    async fn join_player(tx: &mpsc::Sender<InternalCommand>, user_id: UserId, stack: i64) -> mpsc::UnboundedReceiver<RoomMessage> {
        let (msg_tx, msg_rx) = mpsc::unbounded_channel();
        let (respond_tx, respond_rx) = tokio::sync::oneshot::channel();
        tx.send(InternalCommand::Join {
            user_id,
            display_name: format!("Player{}", user_id),
            seat: None,
            stack: ChipAmount::new(stack).unwrap(),
            msg_tx,
            respond_to: respond_tx,
        }).await.unwrap();
        let _ = respond_rx.await.unwrap();
        msg_rx
    }

    let u1 = UserId::new(uuid::Uuid::new_v4());
    let u2 = UserId::new(uuid::Uuid::new_v4());
    let u3 = UserId::new(uuid::Uuid::new_v4());
    let u4 = UserId::new(uuid::Uuid::new_v4());

    let _rx1 = join_player(&actor_tx, u1, 1000).await;
    let _rx2 = join_player(&actor_tx, u2, 1000).await;
    let _rx3 = join_player(&actor_tx, u3, 1000).await;
    let mut rx4 = join_player(&actor_tx, u4, 1000).await;

    // Make u4 sit out
    actor_tx.send(InternalCommand::SitOut { user_id: u4, sitting_out: true }).await.unwrap();
    // Wait for TableState to confirm
    if let Some(RoomMessage::TableState(state)) = rx4.recv().await {
        assert!(state.players.iter().find(|p| p.user_id == u4).unwrap().sitting_out);
    }

    // Start kick vote by u1 against u4
    let (refund_tx, mut refund_rx) = tokio::sync::oneshot::channel();
    actor_tx.send(InternalCommand::StartKickVote {
        initiator_id: u1,
        target_id: u4,
        respond_to: Some(refund_tx),
    }).await.unwrap();

    // Retrieve the actual kick_vote_id from the KickVoteStarted message sent to u4
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    let mut kick_vote_id = None;
    while let Ok(msg) = rx4.try_recv() {
        if let RoomMessage::KickVoteStarted { kick_vote_id: vid, .. } = msg {
            kick_vote_id = Some(vid);
            break;
        }
    }
    let vid = kick_vote_id.expect("Did not receive KickVoteStarted");

    // Vote yes by u2 and u3 (majority required: 2 out of 3 active players)
    actor_tx.send(InternalCommand::VoteKickYes { voter_id: u2, kick_vote_id: vid }).await.unwrap();
    actor_tx.send(InternalCommand::VoteKickYes { voter_id: u3, kick_vote_id: vid }).await.unwrap();

    // Expect refund and removal message
    let refund = refund_rx.await.expect("Refund oneshot should fire");
    assert!(refund > ChipAmount::new(0).unwrap(), "Refund should be positive");
    let removed_msg = rx4.recv().await.unwrap();
    assert!(matches!(removed_msg, RoomMessage::PlayerRemoved { .. }));

    // Shutdown
    actor_tx.send(InternalCommand::Shutdown).await.unwrap();
}
