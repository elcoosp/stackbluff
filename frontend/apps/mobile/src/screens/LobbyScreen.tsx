import { AppText, colors, fonts, PressableScale, radii, Surface } from '@stackbluff/ui-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, stakeBB, stakeText, type Table } from '../lib/api';
import { toast } from '../lib/toast';
import { useAuthStore } from '../stores/authStore';
import { IconPlus, IconWallet } from './icons';
import { EmptyState, ErrorState, SkeletonList } from './ui';

/**
 * Lobby screen — port of PWA routes/lobby.tsx (mobile layout).
 * Table list with stake/players sort chips, lightweight preview rows
 * (thumbnail dot + stake pill + seat pips), New Table quick action
 * (CreateTableModal port), observe / buy-in actions.
 */

type SortKey = 'none' | 'stakes' | 'players';

const SEAT_PIP_MAX = 9;

export function LobbyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const balance = useAuthStore((s) => s.balance);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'none',
    direction: 'asc',
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [buyInTable, setBuyInTable] = useState<Table | null>(null);

  const {
    data: tables = [],
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery<Table[]>({
    queryKey: ['tables'],
    queryFn: () => api.tables(),
  });

  const toggleSort = (key: Exclude<SortKey, 'none'>) => {
    setSortConfig((current) => {
      if (current.key === key) {
        if (current.direction === 'asc') return { key, direction: 'desc' };
        return { key: 'none', direction: 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const sortedTables = [...tables].sort((a, b) => {
    if (sortConfig.key === 'none') return 0;
    const valA = sortConfig.key === 'stakes' ? stakeBB(a.stake_level) : a.current_players;
    const valB = sortConfig.key === 'stakes' ? stakeBB(b.stake_level) : b.current_players;
    return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
  });

  const sortIcon = (key: Exclude<SortKey, 'none'>): ReactNode => {
    if (sortConfig.key !== key) return '↕';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  if (isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <AppText variant="display">Game Lobby</AppText>
        <SkeletonList rows={5} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingWrap}>
        <AppText variant="display">Game Lobby</AppText>
        <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <View style={[styles.content, { paddingBottom: 72 + insets.bottom }]}>
        <FlatListTable
          tables={sortedTables}
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          sortConfig={sortConfig}
          onSort={toggleSort}
          sortIcon={sortIcon}
          onObserve={(table) => {
            router.push(`/table/${table.table_id}?observe=true` as never);
          }}
          onBuyIn={setBuyInTable}
          onCreate={() => setCreateOpen(true)}
        />
      </View>

      {/* Quick action — New Table */}
      <PressableScale
        onPress={() => setCreateOpen(true)}
        style={[styles.fab, { bottom: 88 + insets.bottom }]}
      >
        <IconPlus size={18} color={colors.onAccent} />
        <Text style={styles.fabLabel}>New Table</Text>
      </PressableScale>

      <CreateTableModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          void queryClient.invalidateQueries({ queryKey: ['tables'] });
        }}
      />

      <BuyInModal
        table={buyInTable}
        balance={balance}
        onClose={() => setBuyInTable(null)}
        onConfirm={(amount) => {
          const target = buyInTable;
          setBuyInTable(null);
          if (target) {
            router.push(`/table/${target.table_id}?buyIn=${amount}` as never);
          }
        }}
      />
    </View>
  );
}

/* ── Table list (FlatList) ──────────────────────────────────────────────── */

function FlatListTable({
  tables,
  refreshing,
  onRefresh,
  sortConfig,
  onSort,
  sortIcon,
  onObserve,
  onBuyIn,
  onCreate,
}: {
  tables: Table[];
  refreshing: boolean;
  onRefresh: () => void;
  sortConfig: { key: SortKey; direction: 'asc' | 'desc' };
  onSort: (key: 'stakes' | 'players') => void;
  sortIcon: (key: 'stakes' | 'players') => ReactNode;
  onObserve: (table: Table) => void;
  onBuyIn: (table: Table) => void;
  onCreate: () => void;
}) {
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.headerBlock}>
        <AppText variant="display">Game Lobby</AppText>
        <AppText variant="body" style={styles.subtitle}>
          Join high-stakes rooms or competitive tournaments. Precision poker for the sophisticated
          player.
        </AppText>
      </View>

      {/* Sort chips */}
      <View style={styles.sortRow}>
        <SortChip
          label={`Stakes ${sortIcon('stakes')}`}
          active={sortConfig.key === 'stakes'}
          onPress={() => onSort('stakes')}
        />
        <SortChip
          label={`Players ${sortIcon('players')}`}
          active={sortConfig.key === 'players'}
          onPress={() => onSort('players')}
        />
      </View>

      <FlatList
        data={tables}
        keyExtractor={(item) => item.table_id}
        renderItem={({ item }) => <TableRow table={item} onObserve={onObserve} onBuyIn={onBuyIn} />}
        ListEmptyComponent={
          <EmptyState
            title="No tables right now"
            message="Create a table to get the action started."
            action={
              <PressableScale onPress={onCreate} style={styles.emptyCta}>
                <Text style={styles.emptyCtaLabel}>Create a table</Text>
              </PressableScale>
            }
          />
        }
        refreshControl={<FlatListRefresh refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ gap: 12, paddingBottom: 8 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function FlatListRefresh({
  refreshing,
  onRefresh,
}: {
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={colors.accent}
      colors={[colors.accent]}
    />
  );
}

function SortChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress}>
      <View style={[styles.sortChip, active ? styles.sortChipActive : null]}>
        <Text style={[styles.sortChipLabel, active ? { color: colors.onBackground } : null]}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

/** Lightweight table preview row (ui-native only — no A3 table imports). */
function TableRow({
  table,
  onObserve,
  onBuyIn,
}: {
  table: Table;
  onObserve: (table: Table) => void;
  onBuyIn: (table: Table) => void;
}) {
  const active = table.status === 'active';
  const pips = Math.min(table.max_players, SEAT_PIP_MAX);
  return (
    <Surface variant="card" radius={radii.base}>
      <View style={styles.row}>
        <View style={styles.rowHead}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: active ? colors.accent : colors.outlineVariant },
            ]}
          />
          <View style={styles.rowTitles}>
            <AppText variant="body" style={styles.tableName} numberOfLines={1}>
              {table.name}
            </AppText>
            <AppText variant="label" style={styles.gameType}>
              NO LIMIT HOLD'EM
            </AppText>
          </View>
        </View>

        <View style={styles.rowMeta}>
          <View style={styles.stakePill}>
            <Text style={styles.stakeText}>{stakeText(table.stake_level)}</Text>
          </View>
          <View style={styles.pips}>
            {Array.from({ length: pips }, (_, i) => (
              <View
                // biome-ignore lint/suspicious/noArrayIndexKey: seat pips are positional
                key={i}
                style={[
                  styles.pip,
                  {
                    backgroundColor:
                      i < table.current_players
                        ? `${colors.accent}b3`
                        : `${colors.outlineVariant}55`,
                  },
                ]}
              />
            ))}
          </View>
          <Text style={styles.seatText}>
            {table.current_players}/{table.max_players} seated
          </Text>
        </View>

        <View style={styles.rowActions}>
          <PressableScale onPress={() => onObserve(table)} style={styles.observeBtn}>
            <Text style={styles.observeLabel}>OBSERVE</Text>
          </PressableScale>
          <PressableScale onPress={() => onBuyIn(table)} style={styles.buyInBtn}>
            <IconWallet size={12} color={colors.onAccent} />
            <Text style={styles.buyInLabel}>BUY IN</Text>
          </PressableScale>
        </View>
      </View>
    </Surface>
  );
}

/* ── Create table modal (CreateTableModal port) ─────────────────────────── */

const STAKE_OPTIONS = ['Micro', 'Low', 'Medium', 'High', 'VeryHigh'] as const;

function CreateTableModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const router = useRouter();
  const [tableName, setTableName] = useState('');
  const [stakeLevel, setStakeLevel] = useState<string>('Micro');
  const [maxPlayers, setMaxPlayers] = useState(6);

  const createMutation = useMutation({
    mutationFn: () => api.createTable(tableName.trim(), stakeLevel, maxPlayers),
    onSuccess: (data) => {
      onCreated();
      onClose();
      setTableName('');
      router.push(`/table/${data.table_id}` as never);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create table');
    },
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalCard}>
          <Surface variant="elevated" radius={radii.lg} style={styles.modalInner}>
            <AppText variant="headline">Create New Table</AppText>
            <AppText variant="label" style={styles.modalSubtitle}>
              Enter a name and choose the stakes.
            </AppText>

            <View style={styles.modalGap}>
              <Text style={styles.fieldLabel}>TABLE NAME</Text>
              <View style={styles.inputWrap}>
                <TextInputPlain
                  value={tableName}
                  onChangeText={setTableName}
                  placeholder="e.g., My Private Table"
                />
              </View>
            </View>

            <View style={styles.modalGap}>
              <Text style={styles.fieldLabel}>STAKE LEVEL</Text>
              <View style={styles.stakeOptions}>
                {STAKE_OPTIONS.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => setStakeLevel(option)}
                    style={[
                      styles.stakeOption,
                      stakeLevel === option ? styles.stakeOptionOn : null,
                    ]}
                  >
                    <Text style={styles.stakeOptionLabel}>{stakeText(option)}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.modalGap}>
              <Text style={styles.fieldLabel}>MAX PLAYERS: {maxPlayers}</Text>
              <View style={styles.stepperRow}>
                {[2, 4, 6, 8, 9].map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => setMaxPlayers(n)}
                    style={[styles.stepperChip, maxPlayers === n ? styles.stepperChipOn : null]}
                  >
                    <Text style={styles.stepperLabel}>{n}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.modalFooter}>
              <Pressable onPress={onClose} style={styles.cancelBtn}>
                <Text style={styles.cancelLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={createMutation.isPending || !tableName.trim()}
                onPress={() => createMutation.mutate()}
                style={[
                  styles.createBtn,
                  (createMutation.isPending || !tableName.trim()) && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.createLabel}>
                  {createMutation.isPending ? 'Creating…' : 'Create Table'}
                </Text>
              </Pressable>
            </View>
          </Surface>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TextInputPlain({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={`${colors.mutedForeground}80`}
      autoCorrect={false}
      style={styles.input}
    />
  );
}

/* ── Buy-in modal (BuyInDialog port, bb-ladder presets) ─────────────────── */

function BuyInModal({
  table,
  balance,
  onClose,
  onConfirm,
}: {
  table: Table | null;
  balance: number;
  onClose: () => void;
  onConfirm: (amount: number) => void;
}) {
  const [amount, setAmount] = useState<number | null>(null);

  if (!table) return null;
  const bb = stakeBB(table.stake_level);
  const min = bb * 20;
  const max = bb * 200;
  const presets = [bb * 40, bb * 100, bb * 200];
  const selected = amount ?? bb * 100;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalCard}>
          <Surface variant="elevated" radius={radii.lg} style={styles.modalInner}>
            <AppText variant="headline">Buy In — {table.name}</AppText>
            <AppText variant="label" style={styles.modalSubtitle}>
              {stakeText(table.stake_level)} · Balance {balance.toLocaleString()} chips
            </AppText>

            <View style={styles.presetsRow}>
              {presets.map((preset) => (
                <Pressable
                  key={preset}
                  onPress={() => setAmount(preset)}
                  style={[styles.stepperChip, selected === preset ? styles.stepperChipOn : null]}
                >
                  <Text style={styles.stepperLabel}>{preset.toLocaleString()}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.buyInRange}>
              Min {min.toLocaleString()} · Max {max.toLocaleString()} (in BB)
            </Text>

            <View style={styles.modalFooter}>
              <Pressable onPress={onClose} style={styles.cancelBtn}>
                <Text style={styles.cancelLabel}>Cancel</Text>
              </Pressable>
              <Pressable onPress={() => onConfirm(selected)} style={styles.createBtn}>
                <Text style={styles.createLabel}>Sit Down</Text>
              </Pressable>
            </View>
          </Surface>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 16 },
  loadingWrap: { flex: 1, gap: 16, padding: 16, backgroundColor: colors.background },
  headerBlock: { gap: 4 },
  subtitle: { color: colors.mutedForeground },
  sortRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 6 },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.base,
    backgroundColor: colors.surfaceContainerLow,
    borderColor: colors.border,
    borderWidth: 1,
  },
  sortChipActive: { backgroundColor: colors.surfaceContainerHigh },
  sortChipLabel: {
    fontFamily: fonts.data,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
  },
  row: { padding: 14, gap: 12 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  rowTitles: { flex: 1, minWidth: 0 },
  tableName: { fontSize: 15, fontWeight: '700' },
  gameType: { marginTop: 2, fontSize: 9 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  stakePill: {
    backgroundColor: colors.surfaceContainerHigh,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.base - 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  stakeText: { fontFamily: fonts.data, fontSize: 10, color: colors.accent },
  pips: { flexDirection: 'row', gap: 3 },
  pip: { width: 6, height: 6, borderRadius: 3 },
  seatText: { fontFamily: fonts.data, fontSize: 10, color: colors.mutedForeground },
  rowActions: { flexDirection: 'row', gap: 8 },
  observeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radii.base,
    borderWidth: 1,
    borderColor: colors.border,
  },
  observeLabel: {
    fontFamily: fonts.data,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.onBackground,
  },
  buyInBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.base,
    backgroundColor: colors.accent,
  },
  buyInLabel: {
    fontFamily: fonts.data,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.onAccent,
  },
  emptyCta: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.base,
    backgroundColor: colors.accent,
  },
  emptyCtaLabel: {
    fontFamily: fonts.data,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.onAccent,
    textTransform: 'uppercase',
  },
  fab: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  fabLabel: {
    fontFamily: fonts.data,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.onAccent,
    textTransform: 'uppercase',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: { width: '100%', maxWidth: 420 },
  modalInner: { padding: 20, gap: 14 },
  modalSubtitle: { textTransform: 'none', letterSpacing: 0 },
  modalGap: { gap: 6 },
  fieldLabel: {
    fontFamily: fonts.labelCaps,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.mutedForeground,
  },
  inputWrap: {
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.base,
  },
  input: {
    color: colors.onBackground,
    fontFamily: fonts.body,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  stakeOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stakeOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.base - 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceContainer,
  },
  stakeOptionOn: { borderColor: colors.accent, backgroundColor: `${colors.accent}18` },
  stakeOptionLabel: { fontFamily: fonts.data, fontSize: 11, color: colors.onBackground },
  stepperRow: { flexDirection: 'row', gap: 6 },
  stepperChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radii.base - 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceContainer,
  },
  stepperChipOn: { borderColor: colors.accent, backgroundColor: `${colors.accent}18` },
  stepperLabel: { fontFamily: fonts.data, fontSize: 12, color: colors.onBackground },
  presetsRow: { flexDirection: 'row', gap: 6 },
  buyInRange: {
    fontFamily: fonts.data,
    fontSize: 10,
    color: colors.mutedForeground,
  },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radii.base },
  cancelLabel: { fontFamily: fonts.data, fontSize: 11, color: colors.mutedForeground },
  createBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radii.base,
    backgroundColor: colors.accent,
  },
  createLabel: {
    fontFamily: fonts.data,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.onAccent,
    textTransform: 'uppercase',
  },
  buttonDisabled: { opacity: 0.5 },
});
