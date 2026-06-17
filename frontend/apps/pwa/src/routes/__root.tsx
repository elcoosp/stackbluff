import { createRootRoute, Link, Outlet, useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { useUserStore } from '@stackbluff/shared';
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Settings, LogOut, Coins } from 'lucide-react';

export const Route = createRootRoute({
  component: RootLayout,
});

function AvatarDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!user) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-tertiary/20 border border-tertiary/30 flex items-center justify-center">
          <span className="text-xs font-bold text-tertiary">
            {(user.username || 'U').slice(0, 2).toUpperCase()}
          </span>
        </div>
        <ChevronDown className={`w-3 h-3 text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      t{open && (
        <div
          className="absolute right-0 top-full mt-2 w-56 rounded-xl overflow-hidden z-[100]"
          style={{
            background: 'rgba(10, 10, 10, 0.95)',
            backdropFilter: 'blur(32px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderTopColor: 'rgba(255,255,255,0.18)',
            boxShadow: '0 12px 48px rgba(0,0,0,0.9)',
          }}
        >
          <div className="p-3 border-b border-white/5">
            <div className="text-sm font-medium text-on-surface">{user.username}</div>
            <div className="text-xs text-on-surface-variant mt-0.5">{user.email || ''}</div>
          </div>
          <div className="p-1">
            <button
              onClick={() => { setOpen(false); navigate({ to: '/lobby' }); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-on-surface-variant hover:bg-white/5 hover:text-on-surface transition-colors"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
            <button
              onClick={() => { setOpen(false); logout(); navigate({ to: '/login' }); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-400/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RootLayout() {
  const { user, balance } = useAuthStore();
  const { loading } = useUserStore();

  return (
    <div className="h-full flex flex-col">
      <header className="shrink-0 h-14 flex items-center px-4 border-b border-white/10 bg-black/40 backdrop-blur-md z-50">
        <nav className="flex items-center gap-6 w-full">
          <Link to="/" className="font-display-lg text-lg tracking-tighter text-on-surface uppercase">
            StackBluff
          </Link>

          <Link to="/lobby" className="text-sm text-on-surface-variant hover:text-on-surface transition-colors">
            Lobby
          </Link>
          <Link to="/leaderboard" className="text-sm text-on-surface-variant hover:text-on-surface transition-colors">
            Leaderboard
          </Link>

          <div className="flex-1" />

          {user && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-tertiary/10 border border-tertiary/20">
              <Coins className="w-3.5 h-3.5 text-tertiary" />
              <span className="text-xs font-mono font-bold text-tertiary tabular-nums">
                {(balance ?? 0).toLocaleString()}
              </span>
            </div>
          )}

          {loading ? (
            <div className="w-20 h-8 rounded-lg bg-white/5 animate-pulse" />
          ) : user ? (
            <AvatarDropdown />
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="text-sm text-on-surface-variant hover:text-on-surface transition-colors px-3 py-1.5">
                Login
              </Link>
              <Link to="/register" className="text-sm font-bold text-black bg-tertiary hover:bg-tertiary/80 px-4 py-1.5 rounded-lg transition-colors">
                Register
              </Link>
            </div>
          )}
        </nav>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
