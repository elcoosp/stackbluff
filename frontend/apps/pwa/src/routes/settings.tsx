import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import {
  Bell,
  ChevronRight,
  CreditCard,
  type LucideIcon,
  Palette,
  Send,
  Shield,
  User,
  Volume2,
} from 'lucide-react';
import { requireAuth } from '@/lib/authGuard';
import { cn } from '@/lib/utils';

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
      type: 'spring' as const,
      stiffness: 260,
      damping: 18,
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
      title: t`Account`,
      description: t`Profile, password, and email`,
      icon: User,
      to: '/settings/account',
      color: 'text-on-surface-variant',
      bg: 'bg-tertiary/10',
      gradient: 'from-tertiary/10 to-transparent',
    },
    {
      title: t`Notifications`,
      description: t`Push alerts and preferences`,
      icon: Bell,
      to: '/settings/notifications',
      color: 'text-on-surface-variant',
      bg: 'bg-tertiary/10',
      gradient: 'from-tertiary/10 to-transparent',
    },
    {
      title: t`Appearance`,
      description: t`Theme and visual preferences`,
      icon: Palette,
      to: '/settings/appearance',
      color: 'text-on-surface-variant',
      bg: 'bg-tertiary/10',
      gradient: 'from-tertiary/10 to-transparent',
    },
    {
      title: t`Audio`,
      description: t`Sound effects and haptics`,
      icon: Volume2,
      to: '/settings/audio',
      color: 'text-on-surface-variant',
      bg: 'bg-tertiary/10',
      gradient: 'from-tertiary/10 to-transparent',
    },
    {
      title: t`Privacy & Data`,
      description: t`GDPR and account deletion`,
      icon: Shield,
      to: '/settings/privacy',
      color: 'text-on-surface-variant',
      bg: 'bg-tertiary/10',
      gradient: 'from-tertiary/10 to-transparent',
    },
    {
      title: t`Payments`,
      description: t`Purchase history and invoices`,
      icon: CreditCard,
      to: '/settings/payments',
      color: 'text-on-surface-variant',
      bg: 'bg-tertiary/10',
      gradient: 'from-tertiary/10 to-transparent',
    },
    {
      title: t`Telegram`,
      description: t`Link account for notifications`,
      icon: Send,
      to: '/settings/telegram',
      color: 'text-on-surface-variant',
      bg: 'bg-tertiary/10',
      gradient: 'from-tertiary/10 to-transparent',
    },
  ];

  return (
    <div className="relative max-w-5xl mx-auto p-4 md:p-8 space-y-8">
      {/* Ambient Background Lighting */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-tertiary/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-tertiary/[0.06] rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="font-display-lg text-3xl md:text-4xl text-on-surface flex items-center gap-3">
            <Trans>Settings</Trans>
          </h1>
          <p className="text-on-surface-variant text-sm mt-1 max-w-md">
            <Trans>Manage your account, preferences, and platform integrations.</Trans>
          </p>
        </div>
        <Link
          to="/profile"
          className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-on-surface-variant hover:text-on-surface transition-colors w-fit"
        >
          <User className="w-4 h-4" />
          <Trans>Back to Profile</Trans>
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
                  className="block relative overflow-hidden h-full p-6 raised-panel rounded-2xl transition-colors duration-300 hover:border-tertiary/25 group"
                >
                  {/* Hover Gradient Background */}
                  <div
                    className={cn(
                      'absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none',
                      section.gradient,
                    )}
                  />

                  <div className="relative z-10 flex flex-col h-full">
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className={cn(
                          'p-3 rounded-xl border border-tertiary/15 transition-transform duration-300 group-hover:scale-110',
                          section.bg,
                          section.color,
                        )}
                      >
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-tertiary/10 border border-tertiary/15 group-hover:bg-tertiary/20 transition-colors">
                        <ChevronRight className="w-4 h-4 text-on-surface-variant group-hover:text-tertiary transition-colors duration-300" />
                      </div>
                    </div>

                    <div className="mt-auto">
                      <h3 className="font-headline-md text-lg text-on-surface leading-tight">
                        {section.title}
                      </h3>
                      <p className="text-sm text-on-surface-variant mt-1">{section.description}</p>
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
  beforeLoad: () => {
    requireAuth();
  },
  component: SettingsPage,
});
