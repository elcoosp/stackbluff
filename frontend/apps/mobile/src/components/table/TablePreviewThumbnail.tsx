/**
 * TablePreviewThumbnail — native port of PWA
 * `components/game/TablePreviewThumbnail.tsx` (multi-table switcher chip
 * / lobby row preview): 48×48 mini felt tile, 2×2 avatar mini-grid (hero
 * accented, empty seats dotted), player-count badge. Hover tooltip is a
 * touch-irrelevant PWA affordance and is skipped (documented deviation);
 * the press scale keeps the whileHover/whileTap feel (1.05 / 0.95).
 */

import type { GameRoomState } from '@stackbluff/shared/src/stores/gameStore';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

export interface TablePreviewThumbnailProps {
  room: GameRoomState;
  isActive: boolean;
  onClick: () => void;
}

export function TablePreviewThumbnail({ room, isActive, onClick }: TablePreviewThumbnailProps) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 20, stiffness: 300 });
  }, [scale]);

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

  const playerCount = Object.keys(room.seats).length;
  const heroSeat = room.heroSeat;
  const heroUserId = heroSeat !== null ? room.seats[heroSeat]?.user_id : null;

  // Get up to 4 players for preview
  const previewPlayers = Object.values(room.seats).slice(0, 4);
  const emptySlots = 4 - previewPlayers.length;

  return (
    <Animated.View style={style}>
      <Pressable
        onPress={() => {
          onClick();
          settle();
        }}
        onPressIn={pressIn}
        onPressOut={pressOut}
        accessibilityLabel={`Table preview, ${playerCount} players`}
        style={[
          {
            width: 48,
            height: 48,
            borderRadius: 8,
            borderWidth: 2,
            backgroundColor: 'rgba(31,31,31,0.8)',
            alignItems: 'center',
            justifyContent: 'center',
          },
          isActive
            ? {
                borderColor: '#4edea3',
                shadowColor: '#4edea3',
                shadowOpacity: 0.3,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 0 },
                elevation: 4,
              }
            : { borderColor: 'rgba(255,255,255,0.1)' },
        ]}
      >
        {/* Player avatars mini grid */}
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 2,
            width: '100%',
            height: '100%',
            padding: 4,
          }}
        >
          {previewPlayers.map((seat) => {
            const isHero = seat.user_id === heroUserId;
            return (
              <View
                key={seat.user_id}
                style={[
                  {
                    flexGrow: 1,
                    flexBasis: '46%',
                    aspectRatio: 1,
                    borderRadius: 999,
                    borderWidth: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                  isHero
                    ? { borderColor: '#4edea3', backgroundColor: 'rgba(78,222,163,0.2)' }
                    : {
                        borderColor: 'rgba(255,255,255,0.2)',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                      },
                ]}
              >
                <Text
                  allowFontScaling={false}
                  style={{
                    fontSize: 6,
                    fontWeight: '700',
                    color: isHero ? '#4edea3' : 'rgba(255,255,255,0.5)',
                  }}
                >
                  {isHero ? 'You' : seat.display_name?.charAt(0) || 'P'}
                </Text>
              </View>
            );
          })}
          {Array.from({ length: emptySlots }).map((_, idx) => (
            <View
              // biome-ignore lint/suspicious/noArrayIndexKey: empty seat placeholders have no stable identity
              key={`empty-${idx}-${room.pot}`}
              style={{
                flexGrow: 1,
                flexBasis: '46%',
                aspectRatio: 1,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.05)',
                backgroundColor: 'rgba(255,255,255,0.05)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                allowFontScaling={false}
                style={{ fontSize: 6, color: 'rgba(255,255,255,0.2)' }}
              >
                •
              </Text>
            </View>
          ))}
        </View>

        {/* Badge with player count */}
        <View
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            backgroundColor: '#1f1f1f',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
            borderRadius: 999,
            paddingHorizontal: 4,
            minWidth: 16,
            alignItems: 'center',
          }}
        >
          <Text allowFontScaling={false} style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)' }}>
            {playerCount}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}
