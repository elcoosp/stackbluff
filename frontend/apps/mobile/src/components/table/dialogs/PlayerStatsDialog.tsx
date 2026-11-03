/**
 * PlayerStatsDialog — native port of PWA `components/game/PlayerStatsDialog.tsx`.
 *
 * Volume / Preflop / Showdown / Money stat sections with accent progress
 * bars, loading skeleton, error and "no hands" states. Stats fetch mirrors
 * the PWA `usePlayerStats` (`GET /players/{id}/stats`, staleTime 30s,
 * retry 1) through @tanstack/react-query + the shared apiClient.
 */
import { apiClient } from '@stackbluff/shared/src/api/client';
import { fonts as FONTS } from '@stackbluff/ui-native';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { formatMoney, formatPercent } from '../format';
import { AwardIcon, BarChartIcon, CoinsIcon, TargetIcon, TrendingUpIcon } from '../icons';
import { DialogButton, DialogShell } from './DialogShell';

/** PWA `types/player-stats.ts` — the REST stats payload (superset of the
 * gameStore's in-seat `PlayerStats`). */
interface RestPlayerStats {
  user_id: string;
  display_name?: string;
  hands_played: number;
  hands_won: number;
  win_rate: number;
  vpip: number;
  pfr: number;
  aggression_factor: number;
  showdowns: number;
  showdown_wins: number;
  wtsd: number;
  total_wagered: number;
  total_won: number;
  net_profit: number;
  biggest_pot_won: number;
  all_in_count: number;
  last_hand_played_at?: string;
}

export interface PlayerStatsDialogProps {
  userId: string | null;
  onOpenChange: (open: boolean) => void;
}

function StatRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ color: '#c7c6cb', fontSize: 14, fontFamily: FONTS.data }}>{label}</Text>
      <Text style={{ color: valueColor ?? '#e2e2e2', fontSize: 14, fontFamily: FONTS.data }}>
        {value}
      </Text>
    </View>
  );
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {icon}
      <Text
        style={{
          fontSize: 10,
          color: '#4edea3',
          letterSpacing: 4,
          textTransform: 'uppercase',
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function ProgressBar({ value }: { value: number }) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withDelay(
      150,
      withTiming(Math.max(0, Math.min(100, value)), {
        duration: 400,
        easing: Easing.out(Easing.ease),
      }),
    );
  }, [value, w]);
  const style = useAnimatedStyle(() => ({
    width: `${w.value}%` as `${number}%`,
  }));
  return (
    <View
      style={{
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[{ height: '100%', borderRadius: 3, backgroundColor: '#4edea3' }, style]}
      />
    </View>
  );
}

export function PlayerStatsDialog({ userId, onOpenChange }: PlayerStatsDialogProps) {
  const open = !!userId;
  const {
    data: stats,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['player-stats', userId],
    queryFn: () => apiClient<RestPlayerStats>(`/players/${userId}/stats`),
    enabled: !!userId,
    staleTime: 30_000,
    retry: 1,
  });

  return (
    <DialogShell open={open} onClose={() => onOpenChange(false)}>
      {/* Header – no X button; only title and optional player name (footer closes) */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.05)',
        }}
      >
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <BarChartIcon size={16} color="#4edea3" />
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#e2e2e2' }}>
              Player Statistics
            </Text>
          </View>
          {stats?.display_name && (
            <Text style={{ fontSize: 11, color: '#c7c6cb', marginTop: 2 }}>
              {stats.display_name}
            </Text>
          )}
        </View>
      </View>

      {/* Content — max-h-60vh scroll */}
      <ScrollView
        style={{ maxHeight: 380 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16, gap: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={{ gap: 16 }}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={`skeleton-row-${i}`}
                style={{ height: 24, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.05)' }}
              />
            ))}
          </View>
        ) : isError || !stats ? (
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: 'rgba(239,68,68,0.1)',
              borderWidth: 1,
              borderColor: 'rgba(239,68,68,0.2)',
            }}
          >
            <Text style={{ color: '#f87171', fontSize: 11 }}>
              Failed to load stats. Please try again later.
            </Text>
          </View>
        ) : stats.hands_played === 0 ? (
          <Text
            style={{ textAlign: 'center', paddingVertical: 32, color: '#c7c6cb', fontSize: 14 }}
          >
            Player hasn't completed any hands yet.
          </Text>
        ) : (
          <>
            {/* Volume */}
            <View style={{ gap: 12 }}>
              <SectionHeader icon={<TargetIcon size={14} color="#4edea3" />} label="Volume" />
              <StatRow label="Hands Played" value={stats.hands_played.toLocaleString()} />
              <StatRow
                label="Hands Won"
                value={`${stats.hands_won.toLocaleString()} (${formatPercent(stats.win_rate)})`}
              />
              <StatRow label="All-in Count" value={String(stats.all_in_count)} />
            </View>

            {/* Preflop */}
            <View style={{ gap: 12 }}>
              <SectionHeader icon={<TrendingUpIcon size={14} color="#4edea3" />} label="Preflop" />
              <View style={{ gap: 4 }}>
                <View
                  style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}
                >
                  <Text style={{ color: '#c7c6cb', fontSize: 12, fontFamily: FONTS.data }}>
                    VPIP
                  </Text>
                  <Text style={{ color: '#4edea3', fontSize: 12, fontFamily: FONTS.data }}>
                    {formatPercent(stats.vpip)}
                  </Text>
                </View>
                <ProgressBar value={stats.vpip * 100} />
              </View>
              <View style={{ gap: 4 }}>
                <View
                  style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}
                >
                  <Text style={{ color: '#c7c6cb', fontSize: 12, fontFamily: FONTS.data }}>
                    PFR
                  </Text>
                  <Text style={{ color: '#4edea3', fontSize: 12, fontFamily: FONTS.data }}>
                    {formatPercent(stats.pfr)}
                  </Text>
                </View>
                <ProgressBar value={stats.pfr * 100} />
              </View>
              <StatRow label="Aggression Factor" value={stats.aggression_factor.toFixed(2)} />
            </View>

            {/* Showdown */}
            <View style={{ gap: 12 }}>
              <SectionHeader icon={<AwardIcon size={14} color="#4edea3" />} label="Showdown" />
              <StatRow label="Went to Showdown" value={formatPercent(stats.wtsd)} />
              <StatRow
                label="Won at Showdown"
                value={
                  stats.showdowns > 0 ? formatPercent(stats.showdown_wins / stats.showdowns) : '0%'
                }
              />
              <StatRow label="Total Showdowns" value={String(stats.showdowns)} />
            </View>

            {/* Money */}
            <View style={{ gap: 12 }}>
              <SectionHeader icon={<CoinsIcon size={14} color="#4edea3" />} label="Money" />
              <StatRow
                label="Net Profit"
                value={`${stats.net_profit >= 0 ? '+' : ''}${formatMoney(stats.net_profit)}`}
                valueColor={stats.net_profit >= 0 ? '#4edea3' : '#f87171'}
              />
              <StatRow label="Biggest Pot Won" value={formatMoney(stats.biggest_pot_won)} />
              <StatRow label="Total Wagered" value={formatMoney(stats.total_wagered)} />
              <StatRow label="Total Won" value={formatMoney(stats.total_won)} />
            </View>
          </>
        )}
      </ScrollView>

      {/* Footer – single close button */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.05)',
          flexDirection: 'row',
          gap: 12,
        }}
      >
        <DialogButton label="Close" onPress={() => onOpenChange(false)} variant="ghost" />
      </View>
    </DialogShell>
  );
}
