import { Link } from '@tanstack/react-router';
import { useUserStore } from '@stackbluff/shared';

/**
 * App header with navigation and user menu.
 */
export function Header() {
  const { user } = useUserStore();

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem 2rem',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <Link
        to="/"
        style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: '#fff',
          textDecoration: 'none',
        }}
      >
        🃏 StackBluff
      </Link>

      <nav style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        {user && (
          <>
            <Link
              to="/settings"
              style={{
                padding: '0.5rem 1rem',
                color: '#fff',
                textDecoration: 'none',
                fontSize: '0.875rem',
              }}
            >
              ⚙️ Settings
            </Link>
            <span style={{ color: '#888', fontSize: '0.875rem' }}>
              {user.name}
            </span>
          </>
        )}
      </nav>
    </header>
  );
}
