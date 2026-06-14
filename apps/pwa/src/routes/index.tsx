import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: function Lobby() {
    return (
      <div className="min-h-screen bg-background p-8" style={{ background: 'radial-gradient(circle at center, #1a1c1b 0%, #131313 100%)' }}>
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold text-white mb-2">STACKBLUFF</h1>
          <p className="text-gray-400 mb-8">Select a table to join the game</p>
          <div className="grid gap-6">
            <Link to="/table/1" className="block p-4 bg-black/40 rounded-xl border border-white/10 hover:border-emerald-500/30 transition">
              <div className="text-white text-lg font-bold">Vegas Vault</div>
              <div className="text-emerald-400 text-sm">200/400</div>
              <div className="text-gray-400 text-xs mt-2">Players: 6/9 · Open</div>
            </Link>
            <Link to="/table/2" className="block p-4 bg-black/40 rounded-xl border border-white/10 hover:border-emerald-500/30 transition">
              <div className="text-white text-lg font-bold">Obsidian Room</div>
              <div className="text-emerald-400 text-sm">500/1000</div>
              <div className="text-gray-400 text-xs mt-2">Players: 4/6 · Open</div>
            </Link>
            <Link to="/table/3" className="block p-4 bg-black/40 rounded-xl border border-white/10 hover:border-emerald-500/30 transition">
              <div className="text-white text-lg font-bold">Emerald Lounge</div>
              <div className="text-emerald-400 text-sm">100/200</div>
              <div className="text-gray-400 text-xs mt-2">Players: 8/9 · Open</div>
            </Link>
          </div>
        </div>
      </div>
    );
  },
});
