import { Link, useNavigate } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  Brain,
  ChevronDown,
  Coins,
  FileText,
  HelpCircle,
  History,
  LayoutGrid,
  LogOut,
  Settings,
  Share2,
  ShoppingBag,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { removeToken } from '../auth/token';
import { useAuthStore } from '../stores/authStore';
import { LiquidMetalButton } from '../ui/LiquidMetalButton';

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

  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
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
    <nav className="fixed top-0 w-full z-[100] flex justify-between items-center px-2 sm:px-4 md:px-8 h-16 border-b border-white/10 bg-black/80 backdrop-blur-md">
      <Link
        to="/"
        className="font-display-lg text-xl md:text-2xl tracking-tighter uppercase"
        style={{ color: '#e2e2e2' }}
      >
        <span className="md:hidden">SB</span>
        <span className="hidden md:inline">STACKBLUFF</span>
      </Link>

      <div className="flex items-center gap-2 md:gap-4 h-full">
        <div id="header-portal-actions" className="flex items-center gap-1 h-full"></div>

        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial="initial"
              animate="animate"
              exit="exit"
              variants={containerVariants as any}
              className="w-24 h-8"
            />
          ) : user ? (
            <motion.div
              key="logged-in"
              initial="initial"
              animate="animate"
              exit="exit"
              variants={containerVariants as any}
              className="flex items-center gap-2 md:gap-4 h-full"
            >
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full glass-hub border border-tertiary/30">
                <Coins className="w-4 h-4 text-tertiary" />
                <span
                  className="font-data-mono text-sm text-tertiary font-bold"
                  data-testid="user-balance"
                >
                  ${balance?.toLocaleString() ?? '0'}
                </span>
              </div>

              <div className="relative h-full flex items-center" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={toggleDropdown}
                  className="flex items-center gap-2 px-2 py-1 rounded-full glass-hub border border-white/10 hover:border-tertiary/50 transition-all cursor-pointer"
                  data-testid="user-menu"
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
                      variants={dropdownVariants as any}
                      className="absolute right-0 top-full mt-2 w-56 max-w-[calc(100vw-1rem)] bg-surface-container border border-outline-variant rounded-lg shadow-xl py-2 z-[2000] backdrop-blur-md origin-top-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="px-4 py-2 border-b border-outline-variant mb-1">
                        <p className="font-data-mono text-sm text-on-surface truncate">
                          {user.username}
                        </p>
                        <p className="font-label-caps text-[10px] text-on-surface-variant truncate">
                          {user.email}
                        </p>
                      </div>

                      <div className="px-2 py-1">
                        <MenuItem
                          icon={<LayoutGrid className="w-4 h-4" />}
                          label="Lobby"
                          onClick={() => {
                            setDropdownOpen(false);
                            navigate({ to: '/lobby' });
                          }}
                        />
                        <MenuItem
                          icon={<Trophy className="w-4 h-4" />}
                          label="Tournaments"
                          onClick={() => {
                            setDropdownOpen(false);
                            navigate({ to: '/tournaments' });
                          }}
                        />
                        <MenuItem
                          icon={<Users className="w-4 h-4" />}
                          label="Clubs"
                          onClick={() => {
                            setDropdownOpen(false);
                            navigate({ to: '/clubs' });
                          }}
                        />
                        <MenuItem
                          icon={<TrendingUp className="w-4 h-4" />}
                          label="Leaderboard"
                          onClick={() => {
                            setDropdownOpen(false);
                            navigate({ to: '/leaderboard' });
                          }}
                        />
                        <MenuItem
                          icon={<ShoppingBag className="w-4 h-4" />}
                          label="Shop"
                          onClick={() => {
                            setDropdownOpen(false);
                            navigate({ to: '/shop' });
                          }}
                        />
                      </div>

                      <div className="border-t border-outline-variant/50 my-1"></div>

                      <div className="px-2 py-1">
                        <MenuItem
                          icon={<Target className="w-4 h-4" />}
                          label="Missions"
                          onClick={() => {
                            setDropdownOpen(false);
                            navigate({ to: '/missions' });
                          }}
                        />
                        <MenuItem
                          icon={<Share2 className="w-4 h-4" />}
                          label="Referrals"
                          onClick={() => {
                            setDropdownOpen(false);
                            navigate({ to: '/referrals' });
                          }}
                        />
                        <MenuItem
                          icon={<History className="w-4 h-4" />}
                          label="Replays"
                          onClick={() => {
                            setDropdownOpen(false);
                            navigate({ to: '/replays' });
                          }}
                        />
                        <MenuItem
                          icon={<FileText className="w-4 h-4" />}
                          label="Hand History"
                          onClick={() => {
                            setDropdownOpen(false);
                            navigate({ to: '/history' });
                          }}
                        />
                        <MenuItem
                          icon={<BookOpen className="w-4 h-4" />}
                          label="Guide"
                          onClick={() => {
                            setDropdownOpen(false);
                            navigate({ to: '/guide' });
                          }}
                        />
                        {/* Puzzle moved here – alongside Guide and Missions */}
                        <MenuItem
                          icon={<Brain className="w-4 h-4" />}
                          label="Puzzle"
                          onClick={() => {
                            setDropdownOpen(false);
                            navigate({ to: '/puzzle' });
                          }}
                        />
                      </div>

                      <div className="border-t border-outline-variant/50 my-1"></div>

                      <div className="px-2 py-1">
                        <MenuItem
                          icon={<Users className="w-4 h-4" />}
                          label="Profile"
                          onClick={() => {
                            setDropdownOpen(false);
                            navigate({ to: '/profile' });
                          }}
                        />
                        <MenuItem
                          icon={<Settings className="w-4 h-4" />}
                          label="Settings"
                          onClick={() => {
                            setDropdownOpen(false);
                            navigate({ to: '/settings' });
                          }}
                        />
                        <MenuItem
                          icon={<HelpCircle className="w-4 h-4" />}
                          label="Help & Support"
                          onClick={() => {
                            setDropdownOpen(false);
                            navigate({ to: '/help' });
                          }}
                        />
                      </div>

                      <div className="border-t border-outline-variant/50 my-1"></div>

                      <div className="px-2">
                        <button
                          type="button"
                          onClick={() => {
                            handleLogout();
                            setDropdownOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          <span className="font-label-caps text-xs">Logout</span>
                        </button>
                      </div>
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
              variants={containerVariants as any}
              className="flex items-center gap-4"
            >
              <Link
                to="/login"
                className="text-sm font-label-caps text-on-surface-variant hover:text-on-surface transition tracking-wider"
              >
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

function MenuItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2 text-on-surface hover:bg-surface-container-high rounded-lg transition-colors"
    >
      {icon}
      <span className="font-label-caps text-xs">{label}</span>
    </button>
  );
}
