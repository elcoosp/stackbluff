import { Link, useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '../stores/authStore';
import { removeToken } from '../auth/token';
import { LiquidMetalButton } from '../ui/LiquidMetalButton';
import { useState, useRef, useEffect } from 'react';
import { LogOut, Settings, Coins, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function Header() {
  const navigate = useNavigate();
  const { user, balance, logout, isLoading } = useAuthStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    removeToken();
    logout();
    navigate({ to: '/login' });
  };

  // Click outside handler
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

  // Toggle function with event handling
  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent parent handlers
    setDropdownOpen((prev) => !prev);
  };

  const containerVariants = {
    initial: { opacity: 0, y: -10 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.15, ease: 'easeIn' } },
  };

  const dropdownVariants = {
    initial: { opacity: 0, y: -10, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.15, ease: 'easeOut' } },
    exit: { opacity: 0, y: -10, scale: 0.95, transition: { duration: 0.1, ease: 'easeIn' } },
  };

  return (
    <nav className="fixed top-0 w-full z-[100] flex justify-between items-center px-4 md:px-8 h-16 border-b border-white/10 bg-black/80 backdrop-blur-md">
      <Link to="/" className="font-display-lg text-2xl tracking-tighter uppercase" style={{ color: '#e2e2e2' }}>
        STACKBLUFF
      </Link>

      <div className="flex items-center gap-4 h-full">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial="initial"
              animate="animate"
              exit="exit"
              variants={containerVariants}
              className="w-24 h-8"
            />
          ) : user ? (
            <motion.div
              key="logged-in"
              initial="initial"
              animate="animate"
              exit="exit"
              variants={containerVariants}
              className="flex items-center gap-4 h-full"
            >
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full glass-hub border border-tertiary/30">
                <Coins className="w-4 h-4 text-tertiary" />
                <span className="font-data-mono text-sm text-tertiary font-bold">
                  ${balance?.toLocaleString() ?? '0'}
                </span>
              </div>

              <div className="relative h-full flex items-center" ref={dropdownRef}>
                <button
                  type="button" // prevents form submission
                  onClick={toggleDropdown}
                  className="flex items-center gap-2 px-2 py-1 rounded-full glass-hub border border-white/10 hover:border-tertiary/50 transition-all cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface font-bold">
                    {getInitials(user.username)}
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-on-surface-variant transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                <AnimatePresence>
                  {dropdownOpen && (
                    <motion.div
                      key="dropdown"
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      variants={dropdownVariants}
                      className="absolute right-0 top-full mt-2 w-48 bg-surface-container border border-outline-variant rounded-lg shadow-xl py-2 z-50 backdrop-blur-md origin-top-right"
                      onClick={(e) => e.stopPropagation()} // prevent closing when clicking inside
                    >
                      <div className="px-4 py-2 border-b border-outline-variant mb-1">
                        <p className="font-data-mono text-sm text-on-surface">{user.username}</p>
                        <p className="font-label-caps text-[10px] text-on-surface-variant">{user.email}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setDropdownOpen(false);
                          navigate({ to: '/lobby' });
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-on-surface hover:bg-surface-container-high transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                        <span className="font-label-caps text-xs">Settings</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleLogout();
                          setDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-on-surface hover:bg-surface-container-high transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span className="font-label-caps text-xs">Logout</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="logged-out"
              initial="initial"
              animate="animate"
              exit="exit"
              variants={containerVariants}
              className="flex items-center gap-4"
            >
              <Link to="/login" className="text-sm font-label-caps text-on-surface-variant hover:text-on-surface transition tracking-wider">
                SIGN IN
              </Link>
              <Link to="/register">
                <LiquidMetalButton variant="silver" className="!py-2 !px-5 !text-xs">
                  CREATE ACCOUNT
                </LiquidMetalButton>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
