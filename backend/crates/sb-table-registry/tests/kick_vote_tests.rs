use async_trait::async_trait;
use sb_contracts::{repo_api::PersistenceError, stats_api::PlayerStatsRepo};
use sb_shared_types::{
    ChipAmount, GameVariant, StakeLevel, TableConfig, TableId, UserId, player_stats::StatsDelta,
};
use sb_table_registry::TableActorConfig;
use sb_table_registry::actor::{InternalCommand, spawn_table_actor};
use sb_table_registry::game_room::RoomMessage;
use std::sync::Arc;
use tokio::sync::mpsc;

struct DummyStatsRepo;

#[async_trait]
impl PlayerStatsRepo for DummyStatsRepo {
    async fn get(
        &self,
        _user_id: &str,
    ) -> Result<sb_shared_types::player_stats::PlayerStatsDto, PersistenceError> {
        Ok(sb_shared_types::player_stats::PlayerStatsDto::default())
    }

    async fn apply_delta(&self, _delta: StatsDelta) -> Result<(), PersistenceError> {
        Ok(())
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
        variant: GameVariant::Holdem,
    };
    let (actor_tx, _handle) = spawn_table_actor(TableActorConfig {
        room_id: TableId::new(uuid::Uuid::new_v4()),
        table_id: TableId::new(uuid::Uuid::new_v4()),
        config: config.clone(),
        event_tx,
        stats_repo,
        active_players,
        created_by: UserId::new(uuid::Uuid::nil()),
        chat_id: None,
    });

    async fn join_player(
        tx: &mpsc::Sender<InternalCommand>,
        user_id: UserId,
        stack: i64,
    ) -> mpsc::UnboundedReceiver<RoomMessage> {
        let (msg_tx, msg_rx) = mpsc::unbounded_channel();
        let (respond_tx, respond_rx) = tokio::sync::oneshot::channel();
        tx.send(InternalCommand::Join {
            user_id,
            display_name: format!("Player{}", user_id),
            seat: None,
            stack: ChipAmount::new(stack).unwrap(),
            msg_tx,
            is_bot: false,
            respond_to: respond_tx,
        })
        .await
        .unwrap();
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

    actor_tx
        .send(InternalCommand::SitOut {
            user_id: u4,
            sitting_out: true,
        })
        .await
        .unwrap();
    if let Some(RoomMessage::TableState(state)) = rx4.recv().await {
        assert!(
            state
                .players
                .iter()
                .any(|p| p.user_id == u4 && p.sitting_out)
        );
    }

    let (refund_tx, refund_rx) = tokio::sync::oneshot::channel();
    actor_tx
        .send(InternalCommand::StartKickVote {
            initiator_id: u1,
            target_id: u4,
            respond_to: Some(refund_tx),
        })
        .await
        .unwrap();

    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    let mut kick_vote_id = None;
    while let Ok(msg) = rx4.try_recv() {
        if let RoomMessage::KickVoteStarted {
            kick_vote_id: vid, ..
        } = msg
        {
            kick_vote_id = Some(vid);
            break;
        }
    }
    let vid = kick_vote_id.expect("Did not receive KickVoteStarted");

    actor_tx
        .send(InternalCommand::VoteKickYes {
            voter_id: u2,
            kick_vote_id: vid,
        })
        .await
        .unwrap();
    actor_tx
        .send(InternalCommand::VoteKickYes {
            voter_id: u3,
            kick_vote_id: vid,
        })
        .await
        .unwrap();

    let refund = refund_rx.await.expect("Refund oneshot should fire");
    assert!(
        refund > ChipAmount::new(0).unwrap(),
        "Refund should be positive"
    );

    // u4 is no longer at the table, so their receiver is disconnected.
    // The PlayerRemoved message is sent to remaining players only.
    drop(rx4);

    actor_tx.send(InternalCommand::Shutdown).await.unwrap();
}
