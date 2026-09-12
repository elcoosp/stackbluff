import {
  type ActionRequired,
  type GameRoomState,
  type TableState,
  useGameStore,
} from '@stackbluff/shared/stores/gameStore';
import { useTournamentStore } from '@stackbluff/shared/stores/tournamentStore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { generateAndSubmitFingerprint } from '@/services/fingerprint';
import { UserUpdatedPayloadSchema } from '../lib/wsMessages';
import { useAuthStore } from '../stores/authStore';
import { useEntitlementsStore } from '../stores/entitlementsStore';

function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

// ── Rank & suit mapping ──
const rankDisplayMap: Record<string, string> = {
  Two: '2',
  Three: '3',
  Four: '4',
  Five: '5',
  Six: '6',
  Seven: '7',
  Eight: '8',
  Nine: '9',
  Ten: '10',
  Jack: 'J',
  Queen: 'Q',
  King: 'K',
  Ace: 'A',
};

const suitDisplayMap: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

function convertCard(card: { rank: string; suit: string }) {
  if (!card) return { rank: '?', suit: '?' };
  return {
    rank: rankDisplayMap[card.rank] ?? card.rank,
    suit: suitDisplayMap[card.suit] ?? card.suit,
  };
}

// ── Raw wire payload ──
interface RawWsMessage {
  type: string;
  room_id?: string;
  user_id?: string;
  seat_index?: number;
  table_id?: string;
  players?: {
    seat: number;
    user_id: string;
    display_name?: string;
    stack?: number | string;
    chips?: number | string;
    bankroll?: number | string;
    current_bet?: number | string;
    is_all_in?: boolean;
    is_folded?: boolean;
    is_leaving?: boolean;
    is_active?: boolean;
    avatar_url?: string;
    position_badge?: string;
    last_action?: string | { text: string; amount?: number | null } | null;
    stats?: import('@stackbluff/shared/stores/gameStore').PlayerStats | null;
    // ShowdownReveal fields
    hole_cards?: { rank: string; suit: string }[];
    handling_description?: string;
    hand_description?: string;
    is_winner?: boolean;
    win_amount?: number;
    winning_cards?: { rank: string; suit: string }[];
  }[];
  community_cards?: { rank: string; suit: string }[];
  pot?: number;
  side_pots?: { amount: number; eligible_players: string[] }[];
  street?: string;
  current_hand_in_progress?: boolean;
  current_turn_user_id?: string | null;
  current_turn_expires_at?: number | null;
  current_turn_timeout_ms?: number | null;
  player_id?: string;
  expires_at?: number;
  timeout_ms?: number;
  to_call?: number;
  min_raise?: number;
  can_check?: boolean;
  action?: string;
  amount?: number;
  new_stack?: number;
  new_pot?: number;
  winners?: (
    | string
    | { user_id?: string; display_name?: string; amount?: number; hand_rank?: string }
  )[];
  hole_cards?: { rank: string; suit: string }[];
  winning_cards?: { rank: string; suit: string }[];
  display_name?: string;
  hand_description?: string;
  is_winner?: boolean;
  win_amount?: number;
  analytics?: unknown;
  payload?: {
    type?: string;
    hole_cards?: { rank: string; suit: string }[];
    analytics?: unknown;
    [key: string]: unknown;
  };
  // Tournament fields
  tournament_id?: string;
  status?: string;
  registered_count?: number;
  max_players?: number;
  prize_pool?: number;
  blind_level?: string | number;
  players_remaining?: number | null;
  tables?: unknown;
  next_blind_at?: number | null;
  current_players?: number;
  level?: unknown;
  blinds?: unknown;
  player_name?: string;
  position?: number;
  new_room_id?: string;
  new_seat?: number;
  results?: unknown;
  [key: string]: unknown;
}

// ── Parse backend messages ──
const parseMessage = (data: RawWsMessage) => {
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
      const players = data.players;
      const seats = players.map((p) => ({
        seat: p.seat,
        user_id: p.user_id,
        display_name: p.display_name || 'Player',
        // Merge: type safety + fallback chain
        stack: typeof p.stack === 'number' ? p.stack : Number(p.chips ?? p.bankroll ?? 0) || 0,
        current_bet: typeof p.current_bet === 'number' ? p.current_bet : Number(p.current_bet) || 0,
        is_all_in: p.is_all_in ?? false,
        is_folded: p.is_folded ?? false,
        is_leaving: p.is_leaving || false,
        is_active: p.is_active ?? (!p.is_folded && !p.is_all_in), // FIX: Improved is_active logic
        avatar_url: p.avatar_url || undefined,
        position_badge: p.position_badge || undefined,
        action:
          typeof p.last_action === 'string' ? p.last_action : (p.last_action?.text ?? undefined),
        stats: p.stats || null, // FIX: Use null instead of undefined for React stability
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
        new_stack: typeof data.new_stack === 'number' ? data.new_stack : undefined, // FIX: Prevent stack overwrite
        new_pot: data.new_pot,
      };
    }
    case 'KickVoteStarted':
      window.dispatchEvent(new CustomEvent('kickVoteStarted', { detail: data }));
      return null;
    case 'KickVoteUpdate':
      window.dispatchEvent(new CustomEvent('kickVoteUpdate', { detail: data }));
      return null;
    case 'PlayerRemoved':
      window.dispatchEvent(new CustomEvent('playerRemoved', { detail: data }));
      return null;

    case 'ShowdownReveal': {
      const showdownPlayers = data.players || [];
      const players = showdownPlayers.map((p) => ({
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
      const handWinners = data.winners || [];
      const winners = handWinners.map((w) => {
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
        const analyticsData = data.payload.analytics as
          | {
              win_prob?: number;
              pot_odds?: number;
              best_hand?: string;
              strength?: number;
            }
          | undefined;
        return {
          type: 'Analytics',
          room_id: data.room_id,
          analytics: {
            winProb: analyticsData?.win_prob ?? 0,
            potOdds: analyticsData?.pot_odds ?? 0,
            bestHand: analyticsData?.best_hand ?? '',
            strength: analyticsData?.strength ?? 0,
          },
        };
      }
      return null;
    }

    // ─── Tournament events ──────────────────────────────────────
    case 'TournamentState': {
      const tournamentId = data.tournament_id;
      if (!tournamentId) return null;
      useTournamentStore.getState().setTournamentState(tournamentId, {
        status: data.status ?? '',
        registered_count: data.registered_count ?? 0,
        max_players: data.max_players ?? 0,
        prize_pool: data.prize_pool ?? 0,
        blind_level: data.blind_level as number | undefined,
        players_remaining: data.players_remaining ?? undefined,
        tables: data.tables as Record<string, number> | undefined,
        next_blind_at: data.next_blind_at ?? undefined,
      });
      if (data.players_remaining != null && data.players_remaining <= 9) {
        window.dispatchEvent(
          new CustomEvent('tournament:finalTable', {
            detail: { tournamentId },
          }),
        );
      }
      return null;
    }

    case 'TournamentRegistered': {
      const tournamentId = data.tournament_id;
      if (!tournamentId) return null;
      const userId = data.user_id;
      if (userId) {
        useTournamentStore.getState().setTournament(tournamentId, {
          registered: data.current_players,
        });
        useTournamentStore.getState().setRegistered(tournamentId, userId, true);
      }
      return null;
    }

    case 'TournamentStarting': {
      const tournamentId = data.tournament_id;
      if (!tournamentId) return null;
      window.dispatchEvent(
        new CustomEvent('tournament:starting', {
          detail: { tournamentId, startsInSeconds: data.starts_in_seconds },
        }),
      );
      return null;
    }

    case 'TournamentBlindLevel': {
      const tournamentId = data.tournament_id;
      if (!tournamentId) return null;
      useTournamentStore.getState().setTournamentState(tournamentId, {
        blind_level: data.level as never,
      });
      window.dispatchEvent(
        new CustomEvent('tournament:blindLevel', {
          detail: { tournamentId, level: data.level, blinds: data.blinds },
        }),
      );
      return null;
    }

    case 'TournamentElimination': {
      const tournamentId = data.tournament_id;
      if (!tournamentId) return null;
      window.dispatchEvent(
        new CustomEvent('tournament:elimination', {
          detail: {
            tournamentId,
            playerName: data.player_name,
            position: data.position,
          },
        }),
      );
      return null;
    }

    case 'TournamentTableChanged': {
      const tournamentId = data.tournament_id;
      if (!tournamentId) return null;
      useTournamentStore.getState().setTournamentState(tournamentId, {
        my_table_id: data.new_room_id ?? undefined,
      });
      window.dispatchEvent(
        new CustomEvent('tournament:tableChanged', {
          detail: {
            tournamentId,
            newRoomId: data.new_room_id,
            newSeat: data.new_seat,
          },
        }),
      );
      return null;
    }

    case 'TournamentResult': {
      const tournamentId = data.tournament_id;
      if (!tournamentId) return null;
      useTournamentStore.getState().setResults(tournamentId, data.results as never);
      window.dispatchEvent(
        new CustomEvent('tournament:result', {
          detail: { tournamentId, results: data.results },
        }),
      );
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

  const [connectionStatus, setConnectionStatus] = useState<
    'connected' | 'reconnecting' | 'disconnected'
  >('disconnected');
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [notSeated, setNotSeated] = useState(false);

  const myUserIdRef = useRef<string | null>(null);
  const buyInRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    )
      return;

    myUserIdRef.current = null;
    setNotSeated(false);

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const baseWs = import.meta.env.VITE_WS_URL || `${proto}://${window.location.host}`;
    const token = getToken();
    const url = token
      ? `${baseWs}/ws/game?token=${encodeURIComponent(token)}`
      : `${baseWs}/ws/game`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
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
        wsRef.current?.send(
          JSON.stringify({ type: 'join_table', table_id: tableId, buy_in: buyInRef.current }),
        );
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

        if (data.type === 'user.updated') {
          const parsed = UserUpdatedPayloadSchema.safeParse(data);
          if (!parsed.success) {
            console.warn('[WS] Ignored malformed user.updated message:', parsed.error.format());
          } else {
            const msg = parsed.data;
            const payload = msg.payload ?? msg.data ?? {};
            if (typeof payload.balance === 'number') {
              useAuthStore.getState().setBalance(payload.balance);
            }
            if (payload.season_pass_expires_at !== undefined) {
              useEntitlementsStore
                .getState()
                .setSeasonPassExpiresAt(payload.season_pass_expires_at);
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

        if (data.type === 'Error') {
          if (data.message.includes('Not seated')) {
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
              sidePots: [],
              street: '',
              currentTurnUserId: null,
              currentTurnExpiresAt: null,
              currentTurnTimeoutMs: null,
              heroSeat: null,
              heroHoleCards: null,
              actionRequired: null,
              analytics: null,
              showdownReveal: null,
              lastAction: null,
              winners: null,
              handInProgress: false,
            };
            return { rooms };
          });
        }

        switch (message.type) {
          case 'Connected': {
            buyInRef.current = null;
            if (myUserIdRef.current === null && message.user_id) {
              myUserIdRef.current = message.user_id;
              setMyUserId(message.user_id);
            }
            if (roomId && message.seat_index !== undefined) {
              store.ensureRoom(roomId);
              store.setHeroSeat(roomId, message.seat_index);
              store.setActiveRoom(roomId);
            }
            break;
          }
          case 'RoomAssigned': {
            useGameStore.setState((s) => {
              const roomIdMsg = message.room_id;
              const tableIdMsg = message.table_id;
              if (!roomIdMsg) return {};
              const existing = s.rooms[roomIdMsg];
              const tableId = tableIdMsg ?? null;
              if (!existing) return {};
              const mergedRooms: Record<string, GameRoomState> = {
                ...s.rooms,
                [roomIdMsg]: { ...existing, tableId },
              };
              return { rooms: mergedRooms };
            });
            if (message.room_id) store.setActiveRoom(message.room_id);
            break;
          }
          case 'YourHoleCards': {
            if (roomId && message.holeCards) {
              store.setHeroHoleCards(roomId, message.holeCards);
            }
            break;
          }
          case 'TableState': {
            if (roomId) {
              store.setRoomState(roomId, message as TableState);
              if (useGameStore.getState().activeRoomId !== roomId) {
                store.setActiveRoom(roomId);
              }
              const state = message as TableState;
              if (
                !state.current_hand_in_progress ||
                state.current_turn_user_id !== myUserIdRef.current
              ) {
                store.clearActionRequired(roomId);
              }
            }
            break;
          }
          case 'ActionRequired': {
            if (roomId) {
              if (
                myUserIdRef.current &&
                message.player_id &&
                message.player_id === myUserIdRef.current
              ) {
                store.setActionRequired(roomId, message as ActionRequired);
              } else {
                store.clearActionRequired(roomId);
              }
            }
            break;
          }
          case 'ActionBroadcast': {
            if (roomId && message.player_id) {
              store.applyActionBroadcast(roomId, {
                player_id: message.player_id,
                action: message.action ?? '',
                amount: message.amount ?? null,
                new_stack: message.new_stack ?? 0,
                new_pot: message.new_pot ?? 0,
              });
            }
            break;
          }
          case 'ShowdownReveal': {
            if (roomId && message.players) {
              store.setAnalytics(roomId, null);
              store.setShowdownReveal(roomId, {
                players: message.players,
                community_cards: message.community_cards ?? [],
                pot: message.pot ?? 0,
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
            if (roomId && message.winners) {
              store.setHandResult(roomId, {
                winners: message.winners.map(
                  (
                    w,
                  ): {
                    user_id: string;
                    display_name: string;
                    amount: number;
                    hand_rank: string;
                  } => {
                    if (typeof w === 'string') {
                      return { user_id: '', display_name: w, amount: 0, hand_rank: '' };
                    }
                    return {
                      user_id: w.user_id ?? '',
                      display_name: w.display_name ?? 'Player',
                      amount: w.amount ?? 0,
                      hand_rank: w.hand_rank ?? '',
                    };
                  },
                ),
                pot: message.pot ?? 0,
              });
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
      const delay = Math.min(3000 * 1.5 ** reconnectAttempts.current, 30000);
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

  const sendJoin = useCallback(
    (amount: number) => {
      buyInRef.current = amount;
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: 'join_table', table_id: tableId, buy_in: amount }),
        );
        buyInRef.current = null;
      } else {
        if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) connect();
      }
    },
    [tableId, connect],
  );

  const sendRebuy = useCallback((roomId: string, amount: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'rebuy', room_id: roomId, amount }));
    }
  }, []);

  const sendAction = useCallback((roomId: string, action: string, amount?: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const actionMap: Record<string, string> = {
        fold: 'fold',
        check: 'check',
        call: 'call',
        raise: 'raise',
        'all-in': 'allin',
        bet: 'bet',
      };
      const mapped = actionMap[action] || action;
      wsRef.current.send(
        JSON.stringify({ type: 'player_action', room_id: roomId, action: mapped, amount }),
      );
    }
  }, []);

  const sendLeave = useCallback((roomId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'leave_table', room_id: roomId }));
      const nextRoom = Object.keys(useGameStore.getState().rooms).find((id) => id !== roomId);
      useGameStore.getState().setActiveRoom(nextRoom || null);
      useGameStore.getState().removeRoom(roomId);
    }
  }, []);

  const sendWsMessage = useCallback((type: string, payload: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...payload }));
    }
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tournamentId = urlParams.get('tournamentId');
    if (tournamentId && wsRef.current?.readyState === WebSocket.OPEN) {
      sendWsMessage('register_tournament', { tournament_id: tournamentId });
      return () => {
        sendWsMessage('unregister_tournament', { tournament_id: tournamentId });
      };
    }
  }, [sendWsMessage]);

  return {
    sendLeave,
    sendJoin,
    sendAction,
    sendRebuy,
    sendWsMessage,
    connectionStatus,
    myUserId,
    notSeated,
  };
}
