import { useState } from 'react';
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
  Wallet, // Added Wallet icon
} from 'lucide-react';

export const Route = createFileRoute('/lobby')({
  component: LobbyPage,
});

const tables = [
  { id: 1, name: 'The Obsidian Room', game: 'NO LIMIT HOLD\'EM', stakes: '$50 / $100', players: 6, maxPlayers: 9, isLive: true },
  { id: 2, name: 'Titanium Lounge', game: 'POT LIMIT OMAHA', stakes: '$25 / $50', players: 8, maxPlayers: 9, isLive: false },
  { id: 3, name: 'Machined Limits', game: 'NO LIMIT HOLD\'EM', stakes: '$100 / $200', players: 2, maxPlayers: 9, isLive: false },
];

const rowVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, ease: [0.22, 1, 0.36, 1] },
  }),
};

const parseStakes = (stakes: string) => {
  const match = stakes.match(/\$(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
};

function LobbyPage() {
  const [sortConfig, setSortConfig] = useState<{ key: 'none' | 'stakes' | 'players'; direction: 'asc' | 'desc' }>({ key: 'none', direction: 'asc' });

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
    const valA = sortConfig.key === 'stakes' ? parseStakes(a.stakes) : a.players;
    const valB = sortConfig.key === 'stakes' ? parseStakes(b.stakes) : b.players;
    return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
  });

  const renderSortIcon = (key: 'stakes' | 'players') => {
    if (sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 opacity-50" />;
    return sortConfig.direction === 'asc' ? <span className="text-tertiary">↑</span> : <span className="text-tertiary">↓</span>;
  };

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
          <Button className="w-full mb-4 py-3 rounded-lg liquid-metal font-label-caps text-label-caps active:scale-95 transition-transform uppercase">
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
          {/* Header & Hero */}
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

          {/* Table List */}
          <div className="space-y-3 gap-4">
            {/* Desktop Header */}
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
                key={table.id}
                className="flex flex-col lg:grid lg:grid-cols-12 items-start lg:items-center px-4 lg:px-8 py-4 lg:py-5 bg-surface-container-lowest/80 backdrop-blur-xl border border-white/10 rounded-xl razor-highlight group hover:border-tertiary/40 transition-all duration-200 gap-3 lg:gap-0"
                custom={i}
                variants={rowVariants}
                initial="hidden"
                animate="visible"
              >
                <div className="w-full lg:col-span-4 flex items-start lg:items-center gap-3 lg:gap-4">
                  <div className={`mt-1.5 lg:mt-0 w-1.5 h-1.5 rounded-full shrink-0 ${table.isLive ? 'bg-tertiary status-led animate-pulse' : 'bg-outline-variant'}`} />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-headline-md text-base text-on-surface truncate">{table.name}</h4>
                    <p className="text-[10px] text-outline font-label-caps mt-0.5">{table.game}</p>

                    <div className="flex items-center gap-3 mt-2.5 lg:hidden">
                      <span className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-md px-2 py-0.5 text-[10px] font-data-mono text-tertiary tracking-wide">
                        {table.stakes}
                      </span>
                      <span className="text-[10px] text-on-surface-variant font-data-mono">
                        {table.players}/{table.maxPlayers} seated
                      </span>
                    </div>
                  </div>
                </div>

                <div className="hidden lg:block lg:col-span-2 text-center font-data-mono text-on-surface">{table.stakes}</div>

                <div className="hidden lg:flex lg:col-span-2 text-center flex-col items-center">
                  <div className="flex gap-1">
                    {Array.from({ length: table.maxPlayers }).map((_, idx) => (
                      <span key={idx} className={`w-1.5 h-1.5 rounded-full transition-colors ${idx < table.players ? 'bg-tertiary/70' : 'bg-outline-variant/30'}`} />
                    ))}
                  </div>
                  <span className="text-[10px] text-outline mt-1 font-data-mono">{table.players}/{table.maxPlayers}</span>
                </div>

                <div className="w-full lg:col-span-4 flex lg:justify-end gap-2 mt-1 lg:mt-0">
                  <Button variant="outline" className="flex-1 lg:flex-initial px-3 lg:px-4 py-2 border-white/10 font-label-caps text-[10px] text-on-surface-variant hover:border-tertiary/50 hover:text-tertiary uppercase tracking-wider rounded-lg">
                    Observe
                  </Button>
                  <Button className="flex-1 lg:flex-initial px-3 lg:px-4 py-2 bg-tertiary text-on-tertiary font-label-caps text-[10px] hover:bg-tertiary-fixed uppercase tracking-wider shadow-lg shadow-emerald-500/10 rounded-lg">
                    <Wallet className="w-3.5 h-3.5 mr-1.5" /> Buy In
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Featured Section */}
          <div className="mt-8 md:mt-16 grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-gutter">
            <div className="lg:col-span-2 relative h-64 rounded-2xl overflow-hidden razor-highlight border border-outline-variant group">
              <img
                className="absolute inset-0 w-full h-full object-cover grayscale opacity-40 group-hover:opacity-60 transition-opacity"
                src="/grand-masters-invitational.png"
                alt="Grand Masters Invitational Poker Room"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
              <div className="absolute bottom-0 p-6 md:p-8">
                <span className="font-label-caps text-[10px] text-tertiary bg-tertiary/10 px-2 py-1 rounded mb-4 inline-block">LIVE EVENT</span>
                <h2 className="font-display-lg text-xl md:text-display-lg-mobile text-on-surface mb-2">Grand Masters Invitational</h2>
                <p className="text-on-surface-variant max-w-sm text-sm md:text-base">Final table streaming live with real-time data analytics. Watch the legends compete.</p>
              </div>
            </div>

            <div className="bg-surface-container p-6 md:p-8 rounded-2xl border border-outline-variant razor-highlight flex flex-col">
              <BarChart3 className="text-tertiary w-10 h-10 mb-4" strokeWidth={1.5} />
              <h3 className="font-headline-md text-headline-md text-on-surface mb-2">Strategy Lab</h3>
              <p className="text-on-surface-variant mb-6 flex-1 text-sm md:text-base">Analyze your last 500 hands with our proprietary GTO engine. Refine your edges.</p>
              <Button variant="outline" className="w-full py-3 border-outline-variant rounded-lg font-label-caps text-label-caps hover:bg-surface-container-highest transition-colors">
                Launch Lab
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Floating Action Button */}
      <button className="fixed bottom-24 right-6 md:bottom-8 md:right-8 z-50 w-14 h-14 md:w-auto md:px-8 md:h-14 bg-tertiary text-on-tertiary flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-transform hover:shadow-emerald-500/20 group rounded-full md:rounded-lg">
        <Zap className="w-5 h-5" />
        <span className="hidden md:inline font-label-caps text-label-caps">Quick Join</span>
      </button>

      {/* BottomNavBar (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-4 h-20 bg-surface-container-lowest/80 backdrop-blur-xl border-t border-white/10 shadow-lg rounded-t-xl">
        <button className="flex flex-col items-center justify-center bg-tertiary-container text-on-tertiary-container rounded-xl p-2 transition-transform duration-150 active:scale-90">
          <Diamond className="w-5 h-5" />
          <span className="font-label-caps text-[10px]">Play</span>
        </button>
        <button className="flex flex-col items-center justify-center text-outline p-2 hover:text-on-surface transition-transform duration-150 active:scale-90">
          <BarChart2 className="w-5 h-5" />
          <span className="font-label-caps text-[10px]">Stats</span>
        </button>
        <button className="flex flex-col items-center justify-center text-outline p-2 hover:text-on-surface transition-transform duration-150 active:scale-90">
          <MessageSquare className="w-5 h-5" />
          <span className="font-label-caps text-[10px]">Messages</span>
        </button>
        <button className="flex flex-col items-center justify-center text-outline p-2 hover:text-on-surface transition-transform duration-150 active:scale-90">
          <User className="w-5 h-5" />
          <span className="font-label-caps text-[10px]">Profile</span>
        </button>
      </nav>
    </div>
  );
}
