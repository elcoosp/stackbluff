import { PushNotificationToggle } from '../components/PushNotificationToggle';
import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { requireAuth } from '@/lib/authGuard';
import {
  User,
  Bell,
  Palette,
  Volume2,
  Shield,
  CreditCard,
  Settings,
  Send,
  ChevronRight,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 60, scale: 0.8 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 260,
      damping: 18
    },
  },
};

interface SettingsSection {
  title: string;
  description: string;
  icon: LucideIcon;
  to: string;
  color: string;
  bg: string;
  gradient: string;
}

function SettingsPage() {
  const matchRoute = useMatchRoute();
  const isIndex = matchRoute({ to: '/settings' });

  const settingsSections: SettingsSection[] = [
    {
      title: 'Account',
      description: 'Profile, password, and email',
      icon: User,
      to: '/settings/account',
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      gradient: 'from-blue-500/10 to-transparent',
    },
    {
      title: 'Notifications',
      description: 'Push alerts and preferences',
      icon: Bell,
      to: '/settings/notifications',
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      gradient: 'from-yellow-500/10 to-transparent',
    },
    {
      title: 'Appearance',
      description: 'Theme and visual preferences',
      icon: Palette,
      to: '/settings/appearance',
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      gradient: 'from-purple-500/10 to-transparent',
    },
    {
      title: 'Audio',
      description: 'Sound effects and haptics',
      icon: Volume2,
      to: '/settings/audio',
      color: 'text-pink-400',
      bg: 'bg-pink-500/10',
      gradient: 'from-pink-500/10 to-transparent',
    },
    {
      title: 'Privacy & Data',
      description: 'GDPR and account deletion',
      icon: Shield,
      to: '/settings/privacy',
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      gradient: 'from-red-500/10 to-transparent',
    },
    {
      title: 'Payments',
      description: 'Purchase history and invoices',
      icon: CreditCard,
      to: '/settings/payments',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      gradient: 'from-emerald-500/10 to-transparent',
    },
    {
      title: 'Telegram',
      description: 'Link account for notifications',
      icon: Send,
      to: '/settings/telegram',
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      gradient: 'from-cyan-500/10 to-transparent',
    },
  ];

  return (
    <div className="relative max-w-5xl mx-auto p-4 md:p-8 space-y-8">
      {/* Ambient Background Lighting */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-data-mono uppercase tracking-widest text-blue-400">
              Configuration
            </span>
          </div>
          <h1 className="font-display-lg text-3xl md:text-4xl text-on-surface flex items-center gap-3">
            Settings
          </h1>
          <p className="text-on-surface-variant text-sm mt-1 max-w-md">
            Manage your account, preferences, and platform integrations.
          </p>
        </div>
        <Link
          to="/profile"
          className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-on-surface-variant hover:text-on-surface transition-colors w-fit"
        >
          <User className="w-4 h-4" />
          Back to Profile
        </Link>
      </motion.div>

      {/* Render Grid only on index, otherwise render Outlet for child routes */}
      {isIndex ? (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {settingsSections.map((section) => {
            const Icon = section.icon;
            return (
              <motion.div key={section.to} variants={itemVariants}>
                <Link
                  to={section.to as never}
                  className="block relative overflow-hidden h-full p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl transition-colors duration-300 hover:border-white/20 group"
                >
                  {/* Hover Gradient Background */}
                  <div className={cn(
                    "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none",
                    section.gradient
                  )} />

                  <div className="relative z-10 flex flex-col h-full">
                    <div className="flex items-start justify-between mb-4">
                      <div className={cn(
                        "p-3 rounded-xl border border-white/10 transition-transform duration-300 group-hover:scale-110",
                        section.bg, section.color
                      )}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 border border-white/5 group-hover:bg-white/10 transition-colors">
                        {/* Removed the translate-x movement */}
                        <ChevronRight className="w-4 h-4 text-on-surface-variant group-hover:text-on-surface transition-colors duration-300" />
                      </div>
                    </div>

                    <div className="mt-auto">
                      <h3 className="font-headline-md text-lg text-on-surface leading-tight">
                        {section.title}
                      </h3>
                      <p className="text-sm text-on-surface-variant mt-1">
                        {section.description}
                      </p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      ) : (
        <Outlet />
      )}
    </div>
  );
}

export const Route = createFileRoute('/settings')({
  beforeLoad: () => { requireAuth(); },
  component: SettingsPage,
});
