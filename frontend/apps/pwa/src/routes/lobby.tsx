import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import {
  LayoutGrid,
  Trophy,
  History,
  BarChart3,
  HelpCircle,
  LogOut,
  Plus,
  ArrowUpDown,
  Wallet,
} from 'lucide-react';
import { CreateTableModal } from '../components/CreateTableModal';
import { BuyInDialog } from '../components/game/BuyInDialog';
import { apiClient } from '@stackbluff/shared';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';

const STAKE_CONFIG = {
  Micro: { text: "$0.02/$0.05", bb: 5 },
  Low: { text: "$0.10/$0.25", bb: 25 },
  Medium: { text: "$0.50/$1.00", bb: 100 },
  High: { text: "$2/$4", bb: 400 },
  VeryHigh: { text: "$5/$10", bb: 1000 },
};

const getStakeBB = (stakeLevel: keyof typeof STAKE_CONFIG) => STAKE_CONFIG[stakeLevel]?.bb ?? 0;

interface Table {
  table_id: string;
  name: string;
  stake_level: keyof typeof STAKE_CONFIG;
  current_players: number;
  max_players: number;
  status: string;
}

export const Route = createFileRoute('/lobby')({
  component: LobbyPage,
});

function LobbyPage() {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: 'none' | 'stakes' | 'players'; direction: 'asc' | 'desc' }>({
    key: 'none',
    direction: 'asc',
  });
  const [buyInModal, setBuyInModal] = useState<{ open: boolean; table: Table | null }>({
    open: false,
    table: null,
  });
  const balance = useAuthStore((s) => s.balance);

  const { data: tables = [], isLoading, error, refetch } = useQuery<Table[]>({
    queryKey: ['tables'],
    queryFn: () => apiClient<Table[]>('/lobby'),
  });

  const toggleSort = (key: 'stakes' | 'players') => {
    setSortConfig((current) => {
      if (current.key === key) {
        if (current.direction === 'asc') return { key, direction: 'desc' };
        if (current.direction === 'desc') return { key: 'none', direction: 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const sortedTables = [...tables].sort((a, b) => {
    if (sortConfig.key === 'none') return 0;
    const valA = sortConfig.key === 'stakes' ? getStakeBB(a.stake_level) : a.current_players;
    const valB = sortConfig.key === 'stakes' ? getStakeBB(b.stake_level) : b.current_players;
    return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
  });

  const renderSortIcon = (key: 'stakes' | 'players') => {
    if (sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 opacity-50" />;
    return sortConfig.direction === 'asc' ? <span className="text-tertiary">↑</span> : <span className="text-tertiary">↓</span>;
  };

  if (isLoading) {
    return <div className="flex justify-center p-8 text-on-surface">Loading tables...</div>;
  }

  if (error) {
    return <div className="text-error p-8 text-center">Error: {(error as Error).message}</div>;
  }

  return (
    <div className="flex h-full relative">
      {/* Sidebar – sticky to the scroll container (the main) */}
      <aside className="hidden md:flex flex-col w-64 bg-surface-container-low border-r border-outline-variant py-gutter space-y-4 sticky top-0 h-full">
        <div className="px-6 pt-6 mb-8">
          <div className="p-4 rounded-lg bg-surface-container-highest razor-highlight border border-outline-variant">
            <h3 className="font-headline-md text-headline-md text-on-surface mb-1">StackBluff Elite</h3>
            <p className="font-label-caps text-[10px] text-tertiary">Tier: Obsidian</p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto min-h-0">
          <Link to="/lobby" className="flex items-center gap-3 px-4 py-3 rounded-lg text-tertiary font-bold font-label-caps text-label-caps">
            <LayoutGrid className="w-5 h-5" />
            <span className="font-label-caps text-label-caps">Lobby</span>
          </Link>
          <button className="flex items-center gap-3 px-4 py-3 rounded-lg text-outline hover:text-on-surface font-label-caps text-label-caps transition-colors w-full text-left">
            <Trophy className="w-5 h-5" />
            <span className="font-label-caps text-label-caps">Tournaments</span>
          </button>
          <button className="flex items-center gap-3 px-4 py-3 rounded-lg text-outline hover:text-on-surface font-label-caps text-label-caps transition-colors w-full text-left">
            <History className="w-5 h-5" />
            <span className="font-label-caps text-label-caps">History</span>
          </button>
          <button className="flex items-center gap-3 px-4 py-3 rounded-lg text-outline hover:text-on-surface font-label-caps text-label-caps transition-colors w-full text-left">
            <BarChart3 className="w-5 h-5" />
            <span className="font-label-caps text-label-caps">Strategy</span>
          </button>
        </nav>

        <div className="px-4 pt-6 border-t border-outline-variant">
          <Button onClick={() => setModalOpen(true)} className="w-full mb-4 py-3 rounded-lg liquid-metal font-label-caps text-label-caps active:scale-95 transition-transform uppercase">
            <Plus className="w-4 h-4 mr-2" /> New Table
          </Button>
          <button className="flex items-center gap-3 px-4 py-3 rounded-lg text-outline hover:text-on-surface w-full transition-colors font-label-caps text-label-caps">
            <HelpCircle className="w-5 h-5" />
            <span className="font-label-caps text-label-caps">Support</span>
          </button>
          <button className="flex items-center gap-3 px-4 py-3 rounded-lg text-outline hover:text-on-surface w-full transition-colors font-label-caps text-label-caps">
            <LogOut className="w-5 h-5" />
            <span className="font-label-caps text-label-caps">Exit</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <section className="flex-1 relative">
        <div className="absolute inset-0 carbon-bg pointer-events-none" />

        <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8 pb-28 md:pb-8 relative z-10">
          {/* Header and filters */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6 mb-8 md:mb-12">
            <div>
              <h1 className="font-display-lg text-3xl md:text-display-lg text-on-surface mb-2">Game Lobby</h1>
              <p className="text-on-surface-variant max-w-md text-sm md:text-base">Join high-stakes rooms or competitive tournaments. Precision poker for the sophisticated player.</p>
            </div>
            <div className="flex gap-1 md:gap-2 bg-surface-container p-1 rounded-xl border border-outline-variant self-start md:self-auto">
              <button className="px-3 md:px-6 py-1.5 md:py-2 rounded-lg bg-surface-container-highest text-tertiary font-label-caps text-xs md:text-sm transition-all">Cash Games</button>
              <button className="px-3 md:px-6 py-1.5 md:py-2 rounded-lg text-on-surface-variant hover:text-on-surface font-label-caps text-xs md:text-sm transition-all">Tournaments</button>
              <button className="px-3 md:px-6 py-1.5 md:py-2 rounded-lg text-on-surface-variant hover:text-on-surface font-label-caps text-xs md:text-sm transition-all">Clubs</button>
            </div>
          </div>

          {/* Sorting buttons (mobile) */}
          <div className="flex lg:hidden justify-end mb-2 gap-2">
            <button
              className={`flex items-center gap-1.5 text-[10px] ${sortConfig.key === 'stakes' ? 'text-tertiary border-tertiary/50' : 'text-outline'} font-label-caps uppercase border border-outline-variant px-3 py-1.5 rounded-lg hover:text-on-surface transition-colors`}
              onClick={() => toggleSort('stakes')}
            >
              Stakes {renderSortIcon('stakes')}
            </button>
            <button
              className={`flex items-center gap-1.5 text-[10px] ${sortConfig.key === 'players' ? 'text-tertiary border-tertiary/50' : 'text-outline'} font-label-caps uppercase border border-outline-variant px-3 py-1.5 rounded-lg hover:text-on-surface transition-colors`}
              onClick={() => toggleSort('players')}
            >
              Players {renderSortIcon('players')}
            </button>
          </div>

          {/* Table list */}
          <div className="space-y-3 gap-4">
            <div className="hidden lg:grid grid-cols-12 px-6 py-2 text-outline font-label-caps text-[10px] uppercase">
              <div className="col-span-4">Room Name</div>
              <div
                className="col-span-2 text-center flex items-center justify-center gap-1 cursor-pointer hover:text-on-surface transition-colors"
                onClick={() => toggleSort('stakes')}
              >
                Stakes {renderSortIcon('stakes')}
              </div>
              <div
                className="col-span-2 text-center flex items-center justify-center gap-1 cursor-pointer hover:text-on-surface transition-colors"
                onClick={() => toggleSort('players')}
              >
                Players {renderSortIcon('players')}
              </div>
              <div className="col-span-4 text-right">Action</div>
            </div>

            {sortedTables.map((table, i) => (
              <motion.div
                layout
                key={table.table_id}
                className="flex flex-col lg:grid lg:grid-cols-12 items-start lg:items-center px-4 lg:px-8 py-4 lg:py-5 bg-surface-container-lowest/80 backdrop-blur-xl border border-white/10 rounded-xl razor-highlight group hover:border-tertiary/40 transition-all duration-200 gap-3 lg:gap-0"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="w-full lg:col-span-4 flex items-start lg:items-center gap-3 lg:gap-4">
                  <div
                    className={`mt-1.5 lg:mt-0 w-1.5 h-1.5 rounded-full shrink-0 ${table.status === 'active'
                        ? 'bg-tertiary status-led animate-pulse'
                        : 'bg-outline-variant'
                      }`}
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-headline-md text-base text-on-surface truncate">{table.name}</h4>
                    <p className="text-[10px] text-outline font-label-caps mt-0.5">NO LIMIT HOLD'EM</p>
                    <div className="flex items-center gap-3 mt-2.5 lg:hidden">
                      <span className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-md px-2 py-0.5 text-[10px] font-data-mono text-tertiary tracking-wide">
                        {STAKE_CONFIG[table.stake_level]?.text || table.stake_level}
                      </span>
                      <span className="text-[10px] text-on-surface-variant font-data-mono">
                        {table.current_players}/{table.max_players} seated
                      </span>
                    </div>
                  </div>
                </div>

                <div className="hidden lg:block lg:col-span-2 text-center font-data-mono text-on-surface">
                  {STAKE_CONFIG[table.stake_level]?.text || table.stake_level}
                </div>

                <div className="hidden lg:flex lg:col-span-2 text-center flex-col items-center">
                  <div className="flex gap-1">
                    {Array.from({ length: table.max_players }).map((_, idx) => (
                      <span
                        key={idx}
                        className={`w-1.5 h-1.5 rounded-full transition-colors ${idx < table.current_players ? 'bg-tertiary/70' : 'bg-outline-variant/30'
                          }`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-outline mt-1 font-data-mono">
                    {table.current_players}/{table.max_players}
                  </span>
                </div>

                <div className="w-full lg:col-span-4 flex lg:justify-end gap-2 mt-1 lg:mt-0">
                  {/* 🔽 Fixed Observe button */}
                  <Button
                    variant="outline"
                    className="flex-1 lg:flex-initial px-3 lg:px-4 py-2 border-outline-variant text-on-surface hover:border-tertiary hover:text-tertiary hover:bg-tertiary/10 font-label-caps text-[10px] uppercase tracking-wider rounded-lg"
                  >
                    Observe
                  </Button>
                  <Button
                    onClick={() => setBuyInModal({ open: true, table })}
                    className="flex-1 lg:flex-initial px-3 lg:px-4 py-2 bg-tertiary text-on-tertiary font-label-caps text-[10px] hover:bg-tertiary-fixed uppercase tracking-wider shadow-lg shadow-emerald-500/10 rounded-lg"
                  >
                    <Wallet className="w-3.5 h-3.5 mr-1.5" /> Buy In
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Modals */}
      <CreateTableModal open={modalOpen} onClose={() => setModalOpen(false)} onTableCreated={() => refetch()} />

      {buyInModal.table && (
        <BuyInDialog
          open={buyInModal.open}
          onClose={() => setBuyInModal({ open: false, table: null })}
          onConfirm={(amount) => {
            navigate({
              to: '/table/$tableId',
              params: { tableId: buyInModal.table!.table_id },
              search: { buyIn: amount },
            });
            setBuyInModal({ open: false, table: null });
          }}
          minBuyIn={getStakeBB(buyInModal.table.stake_level) * 20}
          maxBuyIn={getStakeBB(buyInModal.table.stake_level) * 200}
          defaultBuyIn={getStakeBB(buyInModal.table.stake_level) * 100}
          tableName={buyInModal.table.name}
          stakeLevel={buyInModal.table.stake_level}
          currentBalance={balance}
        />
      )}
    </div>
  );
}
