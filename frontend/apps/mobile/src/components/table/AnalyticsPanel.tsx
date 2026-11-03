/**
 * AnalyticsPanel — native port of PWA `components/game/AnalyticsPanel.tsx`:
 * TacticalOracle (desktop bottom-left), HandStrength (desktop bottom-right)
 * and MobileAnalyticsStrip (slides down from the header). Glass panels with
 * the exact rgba(10,10,10,0.75) material, expand/collapse toggles and
 * Reanimated-driven counters (PWA rAF replaced by AnimatedNumber).
 */
import { memo, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useEntitlementsStore } from '../../lib/entitlements';
import { AnimatedNumber } from './AnimatedNumber';
import { MaximizeIcon, MinimizeIcon } from './icons';

const glassPanel = {
  backgroundColor: 'rgba(10, 10, 10, 0.75)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.12)',
  borderTopColor: 'rgba(255,255,255,0.18)',
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.8,
  shadowRadius: 32,
  elevation: 14,
} as const;

function strengthColors(displayStrength: number) {
  return displayStrength >= 70
    ? { text: '#4edea3', bar: '#4edea3' }
    : displayStrength >= 40
      ? { text: '#fbbf24', bar: '#fbbf24' }
      : { text: '#f87171', bar: '#f87171' };
}

/* ── Tactical Oracle — desktop bottom-left ───────────────────────────────── */
export const TacticalOracle = memo(function TacticalOracle({
  winProb,
  potOdds,
}: {
  winProb: number;
  potOdds: number;
}) {
  const [expanded, setExpanded] = useExpanded(true);
  const hasSeasonPass = useEntitlementsStore((s) => s.isSeasonPass);
  const panelX = useSharedValue(-60);

  useEffect(() => {
    panelX.value = withTiming(0, { duration: 500, easing: Easing.bezier(0.22, 1, 0.36, 1) });
  }, [panelX]);
  const panelStyle = useAnimatedTranslate(panelX);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[{ position: 'absolute', bottom: 20, left: 20 }, panelStyle]}
    >
      <View
        style={[
          glassPanel,
          { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, minWidth: 180 },
        ]}
      >
        {hasSeasonPass && (
          <View
            style={{
              position: 'absolute',
              top: -8,
              right: 8,
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 999,
              backgroundColor: 'rgba(245,158,11,0.2)',
            }}
          >
            <Text
              allowFontScaling={false}
              style={{ color: '#fbbf24', fontSize: 10, fontWeight: '500' }}
            >
              Unlimited
            </Text>
          </View>
        )}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            width: '100%',
          }}
        >
          {!expanded ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text
                allowFontScaling={false}
                style={{ color: '#4edea3', fontSize: 10, fontWeight: '700' }}
              >
                {Math.round(winProb)}%
              </Text>
              <Text allowFontScaling={false} style={{ color: 'rgba(255,255,255,0.2)' }}>
                |
              </Text>
              <Text
                allowFontScaling={false}
                style={{ color: '#e2e2e2', fontSize: 10, fontWeight: '700' }}
              >
                {potOdds.toFixed(1)}:1
              </Text>
            </View>
          ) : (
            <Text
              allowFontScaling={false}
              style={{
                color: '#c7c6cb',
                fontSize: 9,
                letterSpacing: 3,
                textTransform: 'uppercase',
              }}
            >
              Tactical Oracle
            </Text>
          )}
          <Pressable onPress={() => setExpanded(!expanded)} hitSlop={6}>
            {expanded ? (
              <MinimizeIcon size={12} color="#c7c6cb" />
            ) : (
              <MaximizeIcon size={12} color="#c7c6cb" />
            )}
          </Pressable>
        </View>

        {expanded && (
          <View style={{ marginTop: 8, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <AnimatedNumber
                value={winProb}
                duration={800}
                style={{
                  color: '#4edea3',
                  fontSize: 24,
                  fontWeight: '700',
                  fontVariant: ['tabular-nums'],
                }}
              />
              <Text
                allowFontScaling={false}
                style={{ color: 'rgba(78,222,163,0.6)', fontSize: 12 }}
              >
                win%
              </Text>
            </View>
            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <AnimatedNumber
                value={potOdds}
                duration={800}
                format={(n) => n.toFixed(1)}
                style={{
                  color: '#e2e2e2',
                  fontSize: 18,
                  fontWeight: '700',
                  fontVariant: ['tabular-nums'],
                }}
              />
              <Text allowFontScaling={false} style={{ color: '#c7c6cb', fontSize: 12 }}>
                :1 odds
              </Text>
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  );
});

/* ── Hand Strength — desktop bottom-right ────────────────────────────────── */
export const HandStrength = memo(function HandStrength({
  bestHand,
  strength,
}: {
  bestHand: string;
  strength: number;
}) {
  const [expanded, setExpanded] = useExpanded(true);
  const panelX = useSharedValue(60);
  useEffect(() => {
    panelX.value = withTiming(0, { duration: 500, easing: Easing.bezier(0.22, 1, 0.36, 1) });
  }, [panelX]);
  const panelStyle = useAnimatedTranslate(panelX);
  const colors = strengthColors(Math.round(strength));
  const barW = useSharedValue(0);
  useEffect(() => {
    barW.value = withTiming(strength, { duration: 500, easing: Easing.bezier(0.22, 1, 0.36, 1) });
  }, [strength, barW]);
  const barStyle = useAnimatedBar(barW);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[{ position: 'absolute', bottom: 20, right: 20 }, panelStyle]}
    >
      <View
        style={[
          glassPanel,
          { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, minWidth: 180 },
        ]}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            width: '100%',
          }}
        >
          {!expanded ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text
                allowFontScaling={false}
                style={{
                  color: '#e2e2e2',
                  fontSize: 10,
                  fontWeight: '700',
                  textTransform: 'uppercase',
                }}
              >
                {bestHand}
              </Text>
              <Text allowFontScaling={false} style={{ color: 'rgba(255,255,255,0.2)' }}>
                |
              </Text>
              <Text
                allowFontScaling={false}
                style={{ color: colors.text, fontSize: 10, fontWeight: '700' }}
              >
                {Math.round(strength)}
              </Text>
            </View>
          ) : (
            <Text
              allowFontScaling={false}
              style={{
                color: '#c7c6cb',
                fontSize: 9,
                letterSpacing: 3,
                textTransform: 'uppercase',
              }}
            >
              Hand Strength
            </Text>
          )}
          <Pressable onPress={() => setExpanded(!expanded)} hitSlop={6}>
            {expanded ? (
              <MinimizeIcon size={12} color="#c7c6cb" />
            ) : (
              <MaximizeIcon size={12} color="#c7c6cb" />
            )}
          </Pressable>
        </View>

        {expanded && (
          <View style={{ marginTop: 8, gap: 8 }}>
            <Text
              allowFontScaling={false}
              style={{
                color: '#e2e2e2',
                fontSize: 14,
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              {bestHand}
            </Text>
            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
            <View style={{ gap: 4 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                }}
              >
                <AnimatedNumber
                  value={strength}
                  duration={800}
                  style={{
                    color: colors.text,
                    fontSize: 24,
                    fontWeight: '700',
                    fontVariant: ['tabular-nums'],
                  }}
                />
                <Text allowFontScaling={false} style={{ color: '#c7c6cb', fontSize: 12 }}>
                  / 100
                </Text>
              </View>
              <View
                style={{
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  overflow: 'hidden',
                }}
              >
                <Animated.View
                  style={[{ height: 4, borderRadius: 2, backgroundColor: colors.bar }, barStyle]}
                />
              </View>
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  );
});

/* ── Mobile strip — slides down from the header ──────────────────────────── */
export const MobileAnalyticsStrip = memo(function MobileAnalyticsStrip({
  winProb,
  potOdds,
  bestHand,
  strength,
}: {
  winProb: number;
  potOdds: number;
  bestHand: string;
  strength: number;
}) {
  const panelY = useSharedValue(-20);
  const opacity = useSharedValue(0);
  useEffect(() => {
    panelY.value = withTiming(0, { duration: 350, easing: Easing.bezier(0.22, 1, 0.36, 1) });
    opacity.value = withTiming(1, { duration: 250 });
  }, [panelY, opacity]);
  const panelStyle = useAnimatedTranslate(panelY);
  const fadeStyle = useAnimatedOpacity(opacity);
  const colors = strengthColors(Math.round(strength));

  const cells: { label: string; value: string; color: string }[] = [
    { label: 'Win%', value: `${Math.round(winProb)}%`, color: '#4edea3' },
    { label: 'Odds', value: `${potOdds.toFixed(1)}:1`, color: '#e2e2e2' },
    { label: 'Hand', value: bestHand, color: '#e2e2e2' },
    { label: 'Str', value: `${Math.round(strength)}`, color: colors.text },
  ];

  return (
    <Animated.View pointerEvents="none" style={[panelStyle, fadeStyle]}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 12,
          paddingVertical: 8,
          marginHorizontal: 8,
          marginTop: 4,
          borderBottomLeftRadius: 12,
          borderBottomRightRadius: 12,
          backgroundColor: 'rgba(8, 8, 8, 0.65)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.06)',
          borderBottomColor: 'rgba(255,255,255,0.1)',
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.5,
          shadowRadius: 16,
          elevation: 10,
        }}
      >
        {cells.map((cell, idx) => (
          <View key={cell.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {idx > 0 && (
              <View style={{ height: 20, width: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
            )}
            <View style={{ alignItems: 'center' }}>
              <Text
                allowFontScaling={false}
                style={{
                  color: '#c7c6cb',
                  fontSize: 9,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                }}
              >
                {cell.label}
              </Text>
              <Text
                allowFontScaling={false}
                style={{
                  color: cell.color,
                  fontSize: 14,
                  fontWeight: '700',
                  fontVariant: ['tabular-nums'],
                }}
                numberOfLines={1}
              >
                {cell.value}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Animated.View>
  );
});

/* ── Small local hooks to keep the file tidy ─────────────────────────────── */
function useExpanded(initial: boolean): [boolean, (v: boolean) => void] {
  return useState(initial);
}

function useAnimatedTranslate(sv: SharedValue<number>) {
  return useAnimatedStyle(() => ({ transform: [{ translateX: sv.value }] }));
}

function useAnimatedBar(sv: SharedValue<number>) {
  return useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(100, sv.value))}%` as `${number}%`,
  }));
}

function useAnimatedOpacity(sv: SharedValue<number>) {
  return useAnimatedStyle(() => ({ opacity: sv.value }));
}
