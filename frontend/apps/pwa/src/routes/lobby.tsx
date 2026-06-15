import { useState, useEffect } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { motion } from 'motion/react';
import {
  LayoutGrid,
  Trophy,
  History,
  BarChart3,
  HelpCircle,
  LogOut,
  Plus,
  Zap,
  Diamond,
  BarChart2,
  MessageSquare,
  User,
  ArrowUpDown,
  Wallet,
} from 'lucide-react';
import { CreateTableModal } from '../components/CreateTableModal';

export const Route = createFileRoute('/lobby')({
  component: LobbyPage,
});

const parseStakes = (stakes: string) => {
  const match = stakes.match(/\$(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
};

function LobbyPage() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'none', direction: 'asc' });

  useEffect(() => {
    fetch('/api/lobby', { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load tables');
        return res.json();
      })
      .then(data => {
        setTables(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const toggleSort = (key) => {
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
    const valA = sortConfig.key === 'stakes' ? parseStakes(a.stake_level) : a.current_players;
    const valB = sortConfig.key === 'stakes' ? parseStakes(b.stake_level) : b.current_players;
    return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
  });

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 opacity-50" />;
    return sortConfig.direction === 'asc' ? <span className="text-tertiary">↑</span> : <span className="text-tertiary">↓</span>;
  };

  if (loading) {
    return <div className="flex justify-center p-8 text-on-surface">Loading tables...</div>;
  }

  if (error) {
    return <div className="text-error p-8 text-center">Error: {error}</div>;
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] relative">
      {/* SideNavBar (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-surface-container-low border-r border-outline-variant py-gutter space-y-4 sticky top-16 h-[calc(100vh-64px)]">
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
          <Link to="/tournaments" className="flex items-center gap-3 px-4 py-3 rounded-lg text-outline hover:text-on-surface font-label-caps text-label-caps transition-colors">
            <Trophy className="w-5 h-5" />
            <span className="font-label-caps text-label-caps">Tournaments</span>
          </Link>
          <Link to="/history" className="flex items-center gap-3 px-4 py-3 rounded-lg text-outline hover:text-on-surface font-label-caps text-label-caps transition-colors">
            <History className="w-5 h-5" />
            <span className="font-label-caps text-label-caps">History</span>
          </Link>
          <Link to="/strategy" className="flex items-center gap-3 px-4 py-3 rounded-lg text-outline hover:text-on-surface font-label-caps text-label-caps transition-colors">
            <BarChart3 className="w-5 h-5" />
            <span className="font-label-caps text-label-caps">Strategy</span>
          </Link>
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

      {/* Content Area */}
      <section className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 carbon-bg pointer-events-none" />

        <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8 pb-28 md:pb-8 relative z-10">
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

          {/* Mobile Sort Controls */}
          <div className="flex lg:hidden justify-end mb-2 gap-2">
            <button className={`flex items-center gap-1.5 text-[10px] ${sortConfig.key === 'stakes' ? 'text-tertiary border-tertiary/50' : 'text-outline'} font-label-caps uppercase border border-outline-variant px-3 py-1.5 rounded-lg hover:text-on-surface transition-colors`}
              onClick={() => toggleSort('stakes')}>
              Stakes {renderSortIcon('stakes')}
            </button>
            <button className={`flex items-center gap-1.5 text-[10px] ${sortConfig.key === 'players' ? 'text-tertiary border-tertiary/50' : 'text-outline'} font-label-caps uppercase border border-outline-variant px-3 py-1.5 rounded-lg hover:text-on-surface transition-colors`}
              onClick={() => toggleSort('players')}>
              Players {renderSortIcon('players')}
            </button>
          </div>

          {/* Table List */}
          <div className="space-y-3 gap-4">
            {/* Desktop Header */}
            <div className="hidden lg:grid grid-cols-12 px-6 py-2 text-outline font-label-caps text-[10px] uppercase">
              <div className="col-span-4">Room Name</div>
              <div className="col-span-2 text-center flex items-center justify-center gap-1 cursor-pointer hover:text-on-surface transition-colors"
                onClick={() => toggleSort('stakes')}>
                Stakes {renderSortIcon('stakes')}
              </div>
              <div className="col-span-2 text-center flex items-center justify-center gap-1 cursor-pointer hover:text-on-surface transition-colors"
                onClick={() => toggleSort('players')}>
                Players {renderSortIcon('players')}
              </div>
              <div className="col-span-4 text-right">Action</div>
            </div>

            {sortedTables.map((table, i) => (
              <motion.div
                layout
                key={table.table_id}
                className="flex flex-col lg:grid lg:grid-cols-12 items-start lg:items-center px-4 lg:px-8 py-4 lg:py-5 bg-surface-container-lowest/80 backdrop-blur-xl border border-white/10 rounded-xl razor-highlight group hover:border-tertiary/40 transition-all duration-200 gap-3 lg:gap-0"
                custom={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="w-full lg:col-span-4 flex items-start lg:items-center gap-3 lg:gap-4">
                  <div className={`mt-1.5 lg:mt-0 w-1.5 h-1.5 rounded-full shrink-0 ${table.status === 'active' ? 'bg-tertiary status-led animate-pulse' : 'bg-outline-variant'}`} />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-headline-md text-base text-on-surface truncate">Table {table.table_id.slice(0,8)}</h4>
                    <p className="text-[10px] text-outline font-label-caps mt-0.5">NO LIMIT HOLD'EM</p>

                    <div className="flex items-center gap-3 mt-2.5 lg:hidden">
                      <span className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-md px-2 py-0.5 text-[10px] font-data-mono text-tertiary tracking-wide">
                        ${table.stake_level}
                      </span>
                      <span className="text-[10px] text-on-surface-variant font-data-mono">
                        {table.current_players}/{table.max_players} seated
                      </span>
                    </div>
                  </div>
                </div>

                <div className="hidden lg:block lg:col-span-2 text-center font-data-mono text-on-surface">${table.stake_level}</div>

                <div className="hidden lg:flex lg:col-span-2 text-center flex-col items-center">
                  <div className="flex gap-1">
                    {Array.from({ length: table.max_players }).map((_, idx) => (
                      <span key={idx} className={`w-1.5 h-1.5 rounded-full transition-colors ${idx < table.current_players ? 'bg-tertiary/70' : 'bg-outline-variant/30'}`} />
                    ))}
                  </div>
                  <span className="text-[10px] text-outline mt-1 font-data-mono">{table.current_players}/{table.max_players}</span>
                </div>

                <div className="w-full lg:col-span-4 flex lg:justify-end gap-2 mt-1 lg:mt-0">
                  <Button variant="outline" className="flex-1 lg:flex-initial px-3 lg:px-4 py-2 border-white/10 font-label-caps text-[10px] text-on-surface-variant hover:border-tertiary/50 hover:text-tertiary uppercase tracking-wider rounded-lg">
                    Observe
                  </Button>
                  <Link to="/table/$tableId" params={{ tableId: table.table_id }} className="flex-1 lg:flex-initial">
                    <Button className="w-full px-3 lg:px-4 py-2 bg-tertiary text-on-tertiary font-label-caps text-[10px] hover:bg-tertiary-fixed uppercase tracking-wider shadow-lg shadow-emerald-500/10 rounded-lg">
                      <Wallet className="w-3.5 h-3.5 mr-1.5" /> Buy In
                    </Button>
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <CreateTableModal open={modalOpen} onClose={() => setModalOpen(false)} onTableCreated={() => window.location.reload()} />
    </div>
  );
}
