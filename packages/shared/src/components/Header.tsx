import { Link, useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '../stores/authStore';
import { removeToken } from '../auth/token';
import { LiquidMetalButton } from '../ui/LiquidMetalButton';

export function Header() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    removeToken();
    logout();
    navigate({ to: '/login' });
  };

  return (
    <nav className="fixed top-0 w-full z-[100] flex justify-between items-center px-4 md:px-8 h-16 border-b border-white/10 border-t-white/15 bg-black/80 backdrop-blur-md">
      <Link to="/" className="font-display-lg text-2xl tracking-tighter text-white uppercase">
        STACKBLUFF
      </Link>
      <div className="flex items-center gap-4">
        {user ? (
          <>
            <span className="text-sm text-tertiary font-data-mono">{user.username}</span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-label-caps text-on-surface-variant border border-outline-variant/50 border-t-white/10 rounded hover:text-on-surface hover:border-white/30 transition"
            >
              LOGOUT
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="text-sm font-label-caps text-on-surface-variant hover:text-tertiary transition tracking-wider">
              SIGN IN
            </Link>
            <Link to="/register">
              <LiquidMetalButton variant="emerald" className="!py-2 !px-5 !text-xs">
                CREATE ACCOUNT
              </LiquidMetalButton>
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
