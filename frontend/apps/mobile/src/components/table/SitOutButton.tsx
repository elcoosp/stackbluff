/**
 * SitOutButton — native port of PWA `components/game/SitOutButton.tsx`.
 *
 * Round toggle (Sun ↔ Moon) for sitting out / back in. Reads the hero's
 * sitting_out flag from the active room (PWA parity) and sends the
 * `sit_out` message optimistically.
 *
 * DEVIATION (documented): the PWA spins up a second WebSocket by calling
 * `useGameWebSocket(roomId)` inside the button just to reach
 * `sendWsMessage`. On native every hook call opens a real socket, so the
 * sender is injected via the `sendWsMessage` prop (the TableScene already
 * owns the room's socket).
 */

import { useActiveRoom } from '@stackbluff/shared/src/stores/gameStore';
import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { MoonIcon, SunIcon } from './icons';

export interface SitOutButtonProps {
  roomId: string;
  /** WS sender from the owning table socket (sends `{type:'sit_out', ...}`). */
  sendWsMessage: (type: string, payload: Record<string, unknown>) => void;
}

export function SitOutButton({ roomId, sendWsMessage }: SitOutButtonProps) {
  const room = useActiveRoom();
  const [isSittingOut, setIsSittingOut] = useState(false);

  // Determine if the hero is sitting out from the room state
  useEffect(() => {
    if (!room) return;
    const heroSeat = room.heroSeat;
    if (heroSeat === null || heroSeat === undefined) return;
    const seat = room.seats[heroSeat];
    if (seat) {
      setIsSittingOut(seat.sitting_out || false);
    }
  }, [room]);

  const scale = useSharedValue(1);
  const pressIn = () => {
    scale.value = withSpring(0.95, { damping: 20, stiffness: 300 });
  };
  const pressOut = () => {
    scale.value = withSpring(1.05, { damping: 20, stiffness: 300 });
  };
  const settle = () => {
    scale.value = withSpring(1, { damping: 20, stiffness: 300 });
  };
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const toggleSitOut = () => {
    const newState = !isSittingOut;
    sendWsMessage('sit_out', { room_id: roomId, sitting_out: newState });
    // Optimistic update
    setIsSittingOut(newState);
    settle();
  };

  if (!room) return null;

  return (
    <Animated.View style={style}>
      <Pressable
        onPress={toggleSitOut}
        onPressIn={pressIn}
        onPressOut={pressOut}
        accessibilityLabel={isSittingOut ? 'Sit In' : 'Sit Out'}
        style={{
          padding: 8,
          borderRadius: 999,
          backgroundColor: isSittingOut ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)',
        }}
      >
        {isSittingOut ? (
          <MoonIcon size={16} color="#facc15" />
        ) : (
          <SunIcon size={16} color="#a1a1aa" />
        )}
      </Pressable>
    </Animated.View>
  );
}
