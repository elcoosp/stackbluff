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
    <nav className="fixed top-0 w-full z-[100] flex justify-between items-center px-4 md:px-8 h-16 border-b border-outline-variant bg-surface-container-low/80 backdrop-blur-md">
      <Link to="/" className="font-display-lg text-2xl tracking-tighter text-on-surface uppercase mix-blend-difference">
        STACKBLUFF
      </Link>
      <div className="flex items-center gap-4">
        {user ? (
          <>
            <span className="font-data-mono text-sm text-tertiary">{user.username}</span>
            <LiquidMetalButton onClick={handleLogout} className="px-4 py-2 text-sm">
              LOGOUT
            </LiquidMetalButton>
          </>
        ) : (
          <>
            <Link to="/login" className="font-label-caps text-sm text-on-surface-variant hover:text-primary transition-colors">
              LOGIN
            </Link>
            <Link to="/register" className="font-label-caps text-sm text-primary hover:text-primary/80 transition-colors">
              REGISTER
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
