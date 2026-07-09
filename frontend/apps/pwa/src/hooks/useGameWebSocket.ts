import { useEntitlementsStore } from '../stores/entitlementsStore';
import { UserUpdatedPayloadSchema } from '../lib/wsMessages';
import { useAuthStore } from '../stores/authStore';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useGameStore, TableState, ActionRequired } from '@stackbluff/shared/stores/gameStore';
import { toast } from 'sonner';
import { useTournamentStore } from '@stackbluff/shared/stores/tournamentStore';
import { generateAndSubmitFingerprint } from '@/services/fingerprint';

function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

// ── Rank & suit mapping ──
const rankDisplayMap: Record<string, string> = {
  Two: '2', Three: '3', Four: '4', Five: '5', Six: '6',
  Seven: '7', Eight: '8', Nine: '9', Ten: '10',
  Jack: 'J', Queen: 'Q', King: 'K', Ace: 'A',
};

const suitDisplayMap: Record<string, string> = {
  hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠',
};

function convertCard(card: any) {
  if (!card) return { rank: '?', suit: '?' };
  return {
    rank: rankDisplayMap[card.rank] ?? card.rank,
    suit: suitDisplayMap[card.suit] ?? card.suit,
  };
}

// ── Parse backend messages ──
const parseMessage = (data: any) => {
  switch (data.type) {
    case 'Connected': {
      return {
        type: 'Connected',
        room_id: data.room_id,
        user_id: data.user_id,
        seat_index: data.seat_index,
      };
    }

    case 'RoomAssigned': {
      return {
        type: 'RoomAssigned',
        table_id: data.table_id,
        room_id: data.room_id,
      };
    }

    case 'TableState': {
      if (!data.players) return null;
      const seats: any[] = data.players.map((p: any) => ({
        seat: p.seat,
        user_id: p.user_id,
        display_name: p.display_name || 'Player',
        stack: typeof p.stack === "number" ? p.stack : Number(p.stack) || 0,
        current_bet: typeof p.current_bet === "number" ? p.current_bet : Number(p.current_bet) || 0,
        is_all_in: p.is_all_in,
        is_folded: p.is_folded,
        is_leaving: p.is_leaving || false,
        is_active: !p.is_folded && !p.is_all_in,
        avatar_url: p.avatar_url || undefined,
        position_badge: p.position_badge || undefined,
        action: p.last_action || undefined,
        stats: p.stats || undefined,
      }));
      const communityCards = (data.community_cards || []).map(convertCard);
      return {
        type: 'TableState',
        room_id: data.room_id,
        seats,
        community_cards: communityCards,
        pot: data.pot,
        side_pots: data.side_pots || [],
        street: data.street,
        current_hand_in_progress: data.current_hand_in_progress,
        current_turn_user_id: data.current_turn_user_id,
        current_turn_expires_at: data.current_turn_expires_at || null,
        current_turn_timeout_ms: data.current_turn_timeout_ms || null,
      };
    }
    case 'ActionRequired': {
      return {
        type: 'ActionRequired',
        room_id: data.room_id,
        player_id: data.player_id,
        expires_at: data.expires_at,
        timeout_ms: data.timeout_ms,
        to_call: data.to_call,
        min_raise: data.min_raise,
        can_check: data.can_check,
        pot: data.pot,
      };
    }

    case 'ActionBroadcast': {
      return {
        type: 'ActionBroadcast',
        room_id: data.room_id,
        player_id: data.player_id,
        action: data.action ? data.action.toUpperCase() : data.action,
        amount: data.amount ?? undefined,
        new_stack: data.new_stack,
        new_pot: data.new_pot,
      };
    }

    case 'ShowdownReveal': {
      const players = (data.players || []).map((p: any) => ({
        user_id: p.user_id,
        seat: p.seat,
        display_name: p.display_name || 'Player',
        hole_cards: (p.hole_cards || []).map(convertCard),
        hand_description: p.hand_description || '',
        is_winner: p.is_winner || false,
        win_amount: p.win_amount || 0,
        winning_cards: (p.winning_cards || []).map(convertCard),
      }));
      const communityCards = (data.community_cards || []).map(convertCard);
      return {
        type: 'ShowdownReveal',
        room_id: data.room_id,
        players,
        community_cards: communityCards,
        pot: data.pot || 0,
      };
    }

    case 'HandResult': {
      const winners = (data.winners || []).map((w: any) => {
        if (typeof w === 'string') {
          return { user_id: '', display_name: w, amount: 0, hand_rank: '' };
        }
        return {
          user_id: w.user_id || '',
          display_name: w.display_name || 'Player',
          amount: w.amount || 0,
          hand_rank: w.hand_rank || '',
        };
      });
      return {
        type: 'HandResult',
        room_id: data.room_id,
        winners,
        pot: data.pot || 0,
      };
    }

    case 'PrivateMessage': {
      if (data.payload?.type === 'your_hole_cards') {
        const holeCards = (data.payload.hole_cards || []).map(convertCard);
        return { type: 'YourHoleCards', room_id: data.room_id, holeCards };
      }
      if (data.payload?.type === 'analytics') {
        const analyticsData = data.payload.analytics;
        return {
          type: 'Analytics',
          room_id: data.room_id,
          analytics: {
            winProb: analyticsData.win_prob,
            potOdds: analyticsData.pot_odds,
            bestHand: analyticsData.best_hand,
            strength: analyticsData.strength,
          }
        };
      }
      return null;
    }

    // ─── Tournament events ──────────────────────────────────────
    case 'TournamentState': {
      useTournamentStore.getState().setTournamentState(data.tournament_id, {
        status: data.status,
        registered_count: data.registered_count,
        max_players: data.max_players,
        prize_pool: data.prize_pool,
        blind_level: data.blind_level,
        players_remaining: data.players_remaining,
        tables: data.tables,
        next_blind_at: data.next_blind_at,
      });
      if (data.players_remaining !== undefined && data.players_remaining <= 9) {
        window.dispatchEvent(new CustomEvent('tournament:finalTable', { detail: { tournamentId: data.tournament_id } }));
      }
      return null;
    }

    case 'TournamentRegistered': {
      const store = useTournamentStore.getState();
      store.setTournament(data.tournament_id, {
        registered: data.current_players,
      });
      const userId = data.user_id;
      if (userId) {
        store.setRegistered(data.tournament_id, userId, true);
      }
      return null;
    }

    case 'TournamentStarting': {
      window.dispatchEvent(new CustomEvent('tournament:starting', {
        detail: { tournamentId: data.tournament_id, startsInSeconds: data.starts_in_seconds }
      }));
      return null;
    }

    case 'TournamentBlindLevel': {
      useTournamentStore.getState().setTournamentState(data.tournament_id, {
        blind_level: data.level,
      });
      window.dispatchEvent(new CustomEvent('tournament:blindLevel', {
        detail: { tournamentId: data.tournament_id, level: data.level, blinds: data.blinds }
      }));
      return null;
    }

    case 'TournamentElimination': {
      window.dispatchEvent(new CustomEvent('tournament:elimination', {
        detail: { tournamentId: data.tournament_id, playerName: data.player_name, position: data.position }
      }));
      return null;
    }

    case 'TournamentTableChanged': {
      const state = useTournamentStore.getState();
      state.setTournamentState(data.tournament_id, {
        my_table_id: data.new_room_id,
      });
      window.dispatchEvent(new CustomEvent('tournament:tableChanged', {
        detail: { tournamentId: data.tournament_id, newRoomId: data.new_room_id, newSeat: data.new_seat }
      }));
      return null;
    }

    case 'TournamentResult': {
      useTournamentStore.getState().setResults(data.tournament_id, data.results);
      window.dispatchEvent(new CustomEvent('tournament:result', {
        detail: { tournamentId: data.tournament_id, results: data.results }
      }));
      return null;
    }

    default:
      return null;
  }
};

export function useGameWebSocket(tableId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mountedRef = useRef(true);
  const reconnectAttempts = useRef(0);

  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [notSeated, setNotSeated] = useState(false);

  const myUserIdRef = useRef<string | null>(null);
  const buyInRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;

    myUserIdRef.current = null;
    setNotSeated(false);

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const baseWs = import.meta.env.VITE_WS_URL || `${proto}://${window.location.host}`;
    const token = getToken();
    const url = token ? `${baseWs}/ws/game?token=${encodeURIComponent(token)}` : `${baseWs}/ws/game`;

    const ws = new WebSocket(url);
    

    wsRef.current = ws;

    ws.onopen = () => {
      // Submit fingerprint on reconnect
      const token = getToken();
      if (token) {
        generateAndSubmitFingerprint(token).catch((err) => {
          console.warn('Fingerprint submission on reconnect failed:', err);
        });
      }
      if (!mountedRef.current) return;
      setConnectionStatus('connected');
      reconnectAttempts.current = 0;

      if (buyInRef.current !== null) {
        wsRef.current?.send(JSON.stringify({ type: 'join_table', table_id: tableId, buy_in: buyInRef.current }));
        buyInRef.current = null;
      } else {
        ws.send(JSON.stringify({ type: 'reconnect', table_id: tableId }));
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = undefined;
        toast.success('Reconnected', { description: 'Back at the table' });
      }
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(event.data);
        // Handle payment-driven entitlement updates
        if (data.type === 'user.updated') {
          const parsed = UserUpdatedPayloadSchema.safeParse(data);
          if (!parsed.success) {
            console.warn('[WS] Ignored malformed user.updated message:', parsed.error.format());
          } else {
            const msg = parsed.data;
            const payload = msg.payload ?? msg.data ?? {};
            if (typeof payload.balance === 'number') {
              useAuthStore.getState().setBalance(payload.balance);
              console.info('[WS] Balance updated:', payload.balance);
            }
            if (payload.season_pass_expires_at !== undefined) {
              useEntitlementsStore.getState().setSeasonPassExpiresAt(payload.season_pass_expires_at);
            }
            if (payload.club_pro_expires_at !== undefined) {
              useEntitlementsStore.getState().setClubProExpiresAt(payload.club_pro_expires_at);
            }
            if (typeof payload.is_club_owner === 'boolean') {
              useEntitlementsStore.getState().setIsClubOwner(payload.is_club_owner);
            }
          }
          return;
        }

        console.debug('[WS Hook] Message received:', data);

        if (data.type === 'Error') {
          if (data.message.includes("Not seated")) {
            setNotSeated(true);
            if (data.room_id) {
              useGameStore.getState().removeRoom(data.room_id);
            } else {
              useGameStore.setState({ rooms: {}, activeRoomId: null });
            }
            return;
          }
          toast.error(data.message || 'Game error');
          return;
        }

        const message = parseMessage(data);
        if (!message) return;

        setNotSeated(false);
        const roomId = message.room_id;
        const store = useGameStore.getState();

        if (roomId && !store.rooms[roomId]) {
          useGameStore.setState((s) => {
            const rooms = { ...s.rooms };
            rooms[roomId] = {
              tableId: tableId,
              seats: {},
              communityCards: [],
              pot: 0,
              side_pots: [],
              street: '',
              current_hand_in_progress: false,
              current_turn_user_id: null,
              current_turn_expires_at: null,
              current_turn_timeout_ms: null,
              heroSeat: null,
              heroHoleCards: [],
              actionRequired: null,
              analytics: null,
              showdownReveal: null,
              lastAction: null,
            } as any;
            return { rooms };
          });
        }

        switch (message.type) {
          case 'Connected': {
            buyInRef.current = null;
            if (myUserIdRef.current === null) {
              myUserIdRef.current = message.user_id;
              setMyUserId(message.user_id);
            }
            if (roomId) {
              store.ensureRoom(roomId);
              store.setHeroSeat(roomId, message.seat_index);
              store.setActiveRoom(roomId);
            }
            break;
          }
          case 'RoomAssigned': {
            useGameStore.setState((s) => {
              const rooms = { ...s.rooms };
              if (rooms[message.room_id]) {
                rooms[message.room_id].tableId = message.table_id;
              }
              return { rooms };
            });
            store.setActiveRoom(message.room_id);
            break;
          }
          case 'YourHoleCards': {
            if (roomId) store.setHeroHoleCards(roomId, message.holeCards);
            break;
          }
          case 'TableState': {
            if (roomId) {
              store.setRoomState(roomId, message as TableState);
              if (useGameStore.getState().activeRoomId !== roomId) {
                store.setActiveRoom(roomId);
              }
              const state = message as TableState;
              if (!state.current_hand_in_progress || state.current_turn_user_id !== myUserIdRef.current) {
                store.clearActionRequired(roomId);
              }
            }
            break;
          }
          case 'ActionRequired': {
            if (roomId) {
              if (myUserIdRef.current && message.player_id && message.player_id === myUserIdRef.current) {
                store.setActionRequired(roomId, message as ActionRequired);
              } else {
                store.clearActionRequired(roomId);
              }
            }
            break;
          }
          case 'ActionBroadcast': {
            if (roomId) {
              store.applyActionBroadcast(roomId, {
                player_id: message.player_id,
                action: message.action,
                amount: message.amount,
                new_stack: message.new_stack,
                new_pot: message.new_pot,
              });
            }
            break;
          }
          case 'ShowdownReveal': {
            if (roomId) {
              store.setAnalytics(roomId, null);
              store.setShowdownReveal(roomId, {
                players: message.players,
                community_cards: message.community_cards,
                pot: message.pot,
              });
              store.clearActionRequired(roomId);
            }
            break;
          }
          case 'Analytics': {
            if (roomId && message.analytics) {
              store.setAnalytics(roomId, message.analytics);
            }
            break;
          }
          case 'HandResult': {
            if (roomId) {
              store.setHandResult(roomId, { winners: message.winners, pot: message.pot });
              store.setAnalytics(roomId, null);
              store.setHeroHoleCards(roomId, []);
            }
            break;
          }
        }
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      wsRef.current = null;
      setConnectionStatus('reconnecting');
      const delay = Math.min(3000 * Math.pow(1.5, reconnectAttempts.current), 30000);
      reconnectAttempts.current += 1;
      reconnectTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, delay);
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
    };
  }, [tableId]);

  useEffect(() => {
    mountedRef.current = true;
    const timer = setTimeout(() => {
      if (mountedRef.current) connect();
    }, 100);
    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = undefined;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const sendJoin = useCallback((amount: number) => {
    buyInRef.current = amount;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'join_table', table_id: tableId, buy_in: amount }));
      buyInRef.current = null;
    } else {
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) connect();
    }
  }, [tableId, connect]);

  const sendRebuy = useCallback((roomId: string, amount: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'rebuy', room_id: roomId, amount }));
    }
  }, []);

  const sendAction = useCallback((roomId: string, action: string, amount?: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const actionMap: Record<string, string> = {
        fold: 'fold', check: 'check', call: 'call',
        raise: 'raise', 'all-in': 'allin', bet: 'bet',
      };
      const mapped = actionMap[action] || action;
      wsRef.current.send(JSON.stringify({ type: 'player_action', room_id: roomId, action: mapped, amount }));
    }
  }, []);

  const sendLeave = useCallback((roomId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'leave_table', room_id: roomId }));
      const nextRoom = Object.keys(useGameStore.getState().rooms).find(id => id !== roomId);
      useGameStore.getState().setActiveRoom(nextRoom || null);
      useGameStore.getState().removeRoom(roomId);
    }
  }, []);

  const sendWsMessage = useCallback((type: string, payload: Record<string, any>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...payload }));
    }
  }, []);

  // Auto-subscribe to tournament if tournamentId in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tournamentId = urlParams.get('tournamentId');
    if (tournamentId && wsRef.current?.readyState === WebSocket.OPEN) {
      sendWsMessage('register_tournament', { tournament_id: tournamentId });
      return () => {
        sendWsMessage('unregister_tournament', { tournament_id: tournamentId });
      };
    }
  }, [tableId, sendWsMessage]);

  return { sendLeave, sendJoin, sendAction, sendRebuy, sendWsMessage, connectionStatus, myUserId, notSeated };
}