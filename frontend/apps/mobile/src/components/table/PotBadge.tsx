/**
 * PotBadge — native port of PWA `components/game/PotBadge.tsx`.
 *
 * Pot pill with animated counter (Reanimated, see AnimatedNumber), gradient
 * shimmer text (animated opacity stand-in for the PWA background-shimmer),
 * bet/raise border-blip ripple, animated to-call section, showdown trophy
 * + winner listing, and a side-pot chip row (TableState.side_pots).
 */

import type { ShowdownRevealData } from '@stackbluff/shared/src/stores/gameStore';
import { memo, useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AnimatedNumber } from './AnimatedNumber';
import { formatAmount } from './format';
import { CoinsIcon, TargetIcon, TrophyIcon } from './icons';

export interface LastAction {
  player_id: string;
  action: string;
  amount: number | null;
}

export interface PotBadgeProps {
  amount: number;
  toCall?: number;
  isMobile?: boolean;
  showdownReveal: ShowdownRevealData | null;
  lastAction: LastAction | null;
  sidePots?: { amount: number; eligible_players: string[] }[];
}

/** PWA `shimmer 5s infinite linear` — opacity stand-in (RN can't clip a
 *  background gradient to text without MaskedText; deviation in worklog). */
function ShimmerText({ children, style }: { children: string; style?: object }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.75, { duration: 2500, easing: Easing.linear }),
        withTiming(1, { duration: 2500, easing: Easing.linear }),
      ),
      -1,
    );
  }, [opacity]);
  const anim = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.Text allowFontScaling={false} style={[style, anim]}>
      {children}
    </Animated.Text>
  );
}

/** Border blip ripple on bet/raise/call/all-in last actions. */
function BlipRipple({ effectKey }: { effectKey: number }) {
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);
  useEffect(() => {
    if (effectKey <= 0) return;
    scale.value = 0.8;
    opacity.value = 0.6;
    scale.value = withTiming(2.5, { duration: 1200, easing: Easing.out(Easing.ease) });
    opacity.value = withTiming(0, { duration: 1200, easing: Easing.out(Easing.ease) });
  }, [effectKey, scale, opacity]);
  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));
  if (effectKey <= 0) return null;
  return (
    <Animated.View
      pointerEvents="none"
      key={effectKey}
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: 999,
          borderWidth: 2,
          borderColor: 'rgba(78,222,163,0.6)',
        },
        anim,
      ]}
    />
  );
}

/** PWA animates the to-call width `auto ↔ 0`; RN animates the measured px. */
function ToCallSection({ toCall, isMobile }: { toCall: number; isMobile: boolean }) {
  const show = toCall > 0;
  const [naturalW, setNaturalW] = useState(0);
  const width = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(show ? naturalW : 0, {
      duration: 300,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
    opacity.value = withTiming(show ? 1 : 0, { duration: 200 });
  }, [show, naturalW, width, opacity]);

  const anim = useAnimatedStyle(() => ({
    width: width.value,
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[{ overflow: 'hidden', justifyContent: 'center' }, anim]}>
      <View
        onLayout={(e: LayoutChangeEvent) => {
          const w = e.nativeEvent.layout.width;
          if (Math.abs(naturalW - w) > 0.5) setNaturalW(w);
        }}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        <Text allowFontScaling={false} style={{ color: 'rgba(255,255,255,0.15)' }}>
          |
        </Text>
        <TargetIcon size={10} color="rgba(78,222,163,0.5)" />
        <Text allowFontScaling={false} style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>
          {isMobile ? '' : 'CALL '}
          <Text allowFontScaling={false} style={{ color: '#4edea3' }}>
            ${formatAmount(Math.round(toCall))}
          </Text>
        </Text>
      </View>
    </Animated.View>
  );
}

export const PotBadge = memo(function PotBadge({
  amount,
  toCall,
  isMobile = false,
  showdownReveal,
  lastAction,
  sidePots,
}: PotBadgeProps) {
  const winners = useMemo(
    () => (showdownReveal?.players ?? []).filter((p) => p.is_winner),
    [showdownReveal],
  );
  const isShowdown = !!showdownReveal;

  const [effectKey, setEffectKey] = useState(0);
  useEffect(() => {
    // F-13 port: parseMessage upper-cases actions; match all spellings.
    if (
      lastAction &&
      ['bet', 'raise', 'call', 'all-in', 'allin'].includes(lastAction.action.toLowerCase())
    ) {
      setEffectKey((prev) => prev + 1);
    }
  }, [lastAction]);

  const showdownOpacity = useSharedValue(0);
  const potOpacity = useSharedValue(1);
  useEffect(() => {
    showdownOpacity.value = withTiming(isShowdown ? 1 : 0, { duration: 300 });
    potOpacity.value = withTiming(isShowdown ? 0 : 1, { duration: 300 });
  }, [isShowdown, showdownOpacity, potOpacity]);

  const shadow = useSharedValue(0);
  useEffect(() => {
    shadow.value = withSpring(isShowdown ? 1 : 0, { damping: 20, stiffness: 200 });
  }, [isShowdown, shadow]);
  const shadowStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.5 + 0.2 * shadow.value,
  }));

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 999,
              borderWidth: 1,
              paddingHorizontal: 12,
              paddingVertical: isMobile ? 4 : 6,
              overflow: 'visible',
              backgroundColor: isShowdown ? 'rgba(8,8,8,0.92)' : 'rgba(0,0,0,0.6)',
              borderColor: isShowdown ? 'rgba(78,222,163,0.3)' : 'rgba(255,255,255,0.1)',
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 4 },
              shadowRadius: 12,
              elevation: 6,
            },
            shadowStyle,
          ]}
        >
          {/* Showdown content */}
          <Animated.View
            pointerEvents={isShowdown ? 'auto' : 'none'}
            style={{
              position: 'absolute',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingHorizontal: 4,
              opacity: showdownOpacity,
            }}
          >
            <TrophyIcon size={isMobile ? 16 : 20} />
            {winners.map((w, idx) => (
              <View key={w.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {idx > 0 && (
                  <Text allowFontScaling={false} style={{ color: 'rgba(255,255,255,0.15)' }}>
                    +
                  </Text>
                )}
                <View style={{ alignItems: 'flex-start' }}>
                  <Text
                    allowFontScaling={false}
                    style={{
                      color: '#e2e2e2',
                      fontWeight: '700',
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                      fontSize: isMobile ? 11 : 12,
                    }}
                  >
                    {w.display_name}
                  </Text>
                  <Text
                    allowFontScaling={false}
                    style={{
                      color: '#c7c6cb',
                      letterSpacing: 2,
                      textTransform: 'uppercase',
                      fontSize: isMobile ? 9 : 10,
                    }}
                  >
                    {w.hand_description}
                  </Text>
                </View>
              </View>
            ))}
            <Text allowFontScaling={false} style={{ color: 'rgba(255,255,255,0.15)' }}>
              |
            </Text>
            <AnimatedNumber
              value={amount}
              format={(n) => `$${formatAmount(Math.round(n))}`}
              style={{
                color: '#4edea3',
                fontWeight: '700',
                fontSize: isMobile ? 14 : 16,
                fontVariant: ['tabular-nums'],
              }}
            />
          </Animated.View>

          {/* Pot content */}
          <Animated.View
            pointerEvents={isShowdown ? 'none' : 'auto'}
            style={[
              {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingHorizontal: 4,
                opacity: potOpacity,
              },
            ]}
          >
            <BlipRipple effectKey={effectKey} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <CoinsIcon size={12} color="rgba(78,222,163,0.7)" />
              <ShimmerText
                style={{
                  color: '#4edea3',
                  fontSize: 10,
                  fontWeight: '700',
                  fontVariant: ['tabular-nums'],
                }}
              >
                {`${isMobile ? '' : 'POT '}$${formatAmount(Math.round(amount))}`}
              </ShimmerText>
            </View>
            <ToCallSection toCall={toCall ?? 0} isMobile={isMobile} />
          </Animated.View>
        </Animated.View>
      </View>

      {/* Side pots (TableState.side_pots — shown when more than one live pot) */}
      {!isShowdown && (sidePots?.length ?? 0) > 1 && (
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
          {sidePots?.map((sp, i) => (
            <View
              // biome-ignore lint/suspicious/noArrayIndexKey: side pot order is server-defined and stable per street
              key={`sidepot-${i}`}
              style={{
                paddingHorizontal: 6,
                paddingVertical: 1,
                borderRadius: 999,
                backgroundColor: 'rgba(0,0,0,0.55)',
                borderWidth: 1,
                borderColor: 'rgba(78,222,163,0.25)',
              }}
            >
              <Text
                allowFontScaling={false}
                style={{ color: 'rgba(78,222,163,0.8)', fontSize: 8, fontWeight: '700' }}
              >
                {i === 0 ? 'MAIN' : `SIDE ${i}`} ${formatAmount(sp.amount)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
});
