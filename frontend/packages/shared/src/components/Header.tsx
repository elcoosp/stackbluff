import { Link, useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '../stores/authStore';
import { removeToken } from '../auth/token';
import { LiquidMetalButton } from '../ui/LiquidMetalButton';
import { useState, useRef, useEffect } from 'react';
import { User, LogOut, Settings, Coins, ChevronDown } from 'lucide-react';

export function Header() {
  const navigate = useNavigate();
  const { user, balance, logout, setAuth } = useAuthStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    removeToken();
    logout();
    navigate({ to: '/login' });
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name: string) => {
    return name?.charAt(0).toUpperCase() || 'U';
  };

  return (
    <nav className="fixed top-0 w-full z-[100] flex justify-between items-center px-4 md:px-8 h-16 border-b border-white/10 bg-black/80 backdrop-blur-md">
      <Link to="/" className="font-display-lg text-2xl tracking-tighter uppercase" style={{ color: '#e2e2e2' }}>
        STACKBLUFF
      </Link>
      <div className="flex items-center gap-4">
        {user ? (
          <>
            {/* Bankroll Glass Badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full glass-hub border border-tertiary/30">
              <Coins className="w-4 h-4 text-tertiary" />
              <span className="font-data-mono text-sm text-tertiary font-bold">
                ${balance?.toLocaleString() ?? '0'}
              </span>
            </div>

            {/* Avatar with Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-2 py-1 rounded-full glass-hub border border-white/10 hover:border-tertiary/50 transition-all"
              >
                <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface font-bold">
                  {getInitials(user.username)}
                </div>
                <ChevronDown className={`w-4 h-4 text-on-surface-variant transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 glass-hub rounded-lg shadow-xl border border-white/10 py-2 z-50">
                  <div className="px-4 py-2 border-b border-white/10 mb-1">
                    <p className="font-data-mono text-sm text-on-surface">{user.username}</p>
                    <p className="font-label-caps text-[10px] text-on-surface-variant">{user.email}</p>
                  </div>
                  <Link
                    to="/settings"
                    className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:bg-white/5 transition-colors"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <Settings className="w-4 h-4" />
                    <span className="font-label-caps text-xs">Settings</span>
                  </Link>
                  <button
                    onClick={() => { handleLogout(); setDropdownOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:bg-white/5 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="font-label-caps text-xs">Logout</span>
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <Link to="/login" className="text-sm font-label-caps text-on-surface-variant hover:text-on-surface transition tracking-wider">
              SIGN IN
            </Link>
            <Link to="/register">
              <LiquidMetalButton variant="silver" className="!py-2 !px-5 !text-xs">
                CREATE ACCOUNT
              </LiquidMetalButton>
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
