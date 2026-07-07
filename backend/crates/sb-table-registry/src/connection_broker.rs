use dashmap::DashMap;
use sb_shared_types::{TableId, UserId};
use std::sync::Arc;
use tokio::sync::mpsc;

use crate::game_room::RoomMessage;

/// Global message router. Users register their sender on connect; tournament
/// actors subscribe users to room broadcasts (identified by TableId).
#[derive(Debug)]
pub struct ConnectionBroker {
    senders: Arc<DashMap<UserId, mpsc::UnboundedSender<RoomMessage>>>,
    room_subscribers: Arc<DashMap<TableId, Vec<UserId>>>,
}

impl ConnectionBroker {
    pub fn new() -> Self {
        Self {
            senders: Arc::new(DashMap::new()),
            room_subscribers: Arc::new(DashMap::new()),
        }
    }

    /// Called by WS handler on new connection.
    pub fn register_user(&self, user_id: UserId, tx: mpsc::UnboundedSender<RoomMessage>) {
        self.senders.insert(user_id, tx);
    }

    /// Called by WS handler on disconnect.
    pub fn unregister_user(&self, user_id: UserId) {
        self.senders.remove(&user_id);
        // Remove user from all room subscriptions
        for mut entry in self.room_subscribers.iter_mut() {
            let subs: &mut Vec<UserId> = entry.value_mut();
            subs.retain(|uid| *uid != user_id);
        }
        // Remove empty subscriber lists
        self.room_subscribers.retain(|_k, subs| !subs.is_empty());
    }

    /// Send a message to a single user if connected.
    pub fn send_to_user(&self, user_id: UserId, msg: RoomMessage) {
        if let Some(tx_ref) = self.senders.get(&user_id) {
            let tx: &mpsc::UnboundedSender<RoomMessage> = tx_ref.value();
            let _ = tx.send(msg);
        }
    }

    /// Subscribe a user to a room's broadcast.
    pub fn subscribe_to_room(&self, room_id: TableId, user_id: UserId) {
        self.room_subscribers
            .entry(room_id)
            .or_default()
            .push(user_id);
    }

    /// Unsubscribe a user from a room.
    pub fn unsubscribe_from_room(&self, room_id: TableId, user_id: UserId) {
        if let Some(mut subs_ref) = self.room_subscribers.get_mut(&room_id) {
            let subs: &mut Vec<UserId> = subs_ref.value_mut();
            subs.retain(|uid| *uid != user_id);
            if subs.is_empty() {
                drop(subs_ref);
                self.room_subscribers.remove(&room_id);
            }
        }
    }

    /// Broadcast a message to all subscribers of a room.
    pub fn broadcast_to_room(&self, room_id: TableId, msg: RoomMessage) {
        if let Some(subscribers_ref) = self.room_subscribers.get(&room_id) {
            let subscribers = subscribers_ref.value();
            for uid in subscribers.iter() {
                self.send_to_user(*uid, msg.clone());
            }
        }
    }
}

impl Default for ConnectionBroker {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sb_shared_types::TournamentId;

    #[test]
    fn test_broadcast_to_room_delivers_to_subscribers() {
        let broker = ConnectionBroker::new();
        let room = TableId::generate();
        let user_a = UserId::new(uuid::Uuid::new_v4());
        let user_b = UserId::new(uuid::Uuid::new_v4());

        let (tx_a, mut rx_a) = mpsc::unbounded_channel::<RoomMessage>();
        let (tx_b, mut rx_b) = mpsc::unbounded_channel::<RoomMessage>();

        broker.register_user(user_a, tx_a);
        broker.register_user(user_b, tx_b);
        broker.subscribe_to_room(room, user_a);
        broker.subscribe_to_room(room, user_b);

        let msg = RoomMessage::TournamentState(crate::game_room::TournamentStateUpdate {
            tournament_id: TournamentId::generate(),
            status: "Registering".to_string(),
            registered_count: 2,
            max_players: 9,
            prize_pool: 2000,
            blind_level: None,
        });
        broker.broadcast_to_room(room, msg);

        assert!(rx_a.try_recv().is_ok(), "user_a should receive message");
        assert!(rx_b.try_recv().is_ok(), "user_b should receive message");
    }

    #[test]
    fn test_unsubscribe_stops_delivery() {
        let broker = ConnectionBroker::new();
        let room = TableId::generate();
        let user = UserId::new(uuid::Uuid::new_v4());

        let (tx, mut rx) = mpsc::unbounded_channel::<RoomMessage>();
        broker.register_user(user, tx);
        broker.subscribe_to_room(room, user);
        broker.unsubscribe_from_room(room, user);

        let msg = RoomMessage::Error {
            room_id: None,
            target_user_id: None,
            message: "test".to_string(),
        };
        broker.broadcast_to_room(room, msg);

        assert!(
            rx.try_recv().is_err(),
            "no message expected after unsubscribe"
        );
    }
}
