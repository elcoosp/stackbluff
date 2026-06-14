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
    <nav className="fixed top-0 w-full z-[100] flex justify-between items-center px-4 md:px-8 h-16 border-b border-white/10 bg-black/80 backdrop-blur-md">
      <Link to="/" className="font-display-lg text-2xl tracking-tighter text-white uppercase">
        STACKBLUFF
      </Link>
      <div className="flex items-center gap-4">
        {user ? (
          <>
            <span className="text-sm text-emerald-400">{user.username}</span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-mono text-white border border-white/20 rounded hover:bg-white/10 transition"
            >
              LOGOUT
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="text-sm font-mono text-gray-300 hover:text-white transition">
              LOGIN
            </Link>
            <Link to="/register" className="text-sm font-mono text-emerald-400 hover:text-emerald-300 transition">
              REGISTER
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
