import { Trans } from '@lingui/react/macro';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowRight, BookOpen, Swords, Trophy, Wallet } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/')({
  component: IndexPage,
});

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.2,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const features = [
  {
    icon: Swords,
    titleKey: 'Play',
    body: 'Join a cash table and test your skills against other players.',
    cta: 'JOIN TABLE',
    to: '/lobby',
    primary: true,
  },
  {
    icon: Trophy,
    titleKey: 'Compete',
    body: "Climb the season ranks. Leaderboard positions update in real-time.",
    cta: 'VIEW RANKS',
    to: '/leaderboard',
  },
  {
    icon: Wallet,
    titleKey: 'Ascend',
    body: 'Buy chips, season passes, and club upgrades.',
    cta: 'BROWSE SHOP',
    to: '/shop',
  },
  {
    icon: BookOpen,
    titleKey: 'Learn',
    body: 'New to poker? Start with the fundamentals.',
    cta: 'READ GUIDE',
    to: '/guide',
  },
];

function IndexPage() {
  return (
    <div className="min-h-full w-full flex flex-col items-center justify-start pt-14 md:pt-20 pb-16 px-4 relative overflow-hidden">
      {/* Ambient felt lighting */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-15%] left-[-10%] w-[55%] h-[55%] bg-tertiary/[0.07] rounded-full blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-12%] w-[55%] h-[55%] bg-secondary/[0.04] rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative max-w-5xl w-full"
      >
        {/* ── Hero ─────────────────────────────────────────────── */}
        <div className="text-center mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-sm mb-6 data-strip text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
            <span className="w-1.5 h-1.5 rounded-full bg-tertiary status-led" />
            <Trans>High Stakes Poker</Trans>
          </div>

          <h1 className="font-display-lg text-5xl md:text-7xl text-on-surface uppercase tracking-tighter leading-none">
            Stackbluff<span className="text-tertiary">.</span>
          </h1>
          <p className="font-data-mono text-xs md:text-sm text-on-surface-variant mt-5 max-w-md mx-auto leading-relaxed">
            <Trans>
              Precision poker for the sophisticated player. Real stakes, live tables, and a
              tactical edge that reads the table before you do.
            </Trans>
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/lobby">
              <Button className="group bg-gradient-to-b from-tertiary to-tertiary-container text-on-tertiary font-data-mono text-sm px-8 py-6 rounded-xl shadow-[0_1px_0_rgba(255,255,255,0.15)_inset,0_12px_32px_rgba(16,185,129,0.3)] hover:shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_16px_40px_rgba(16,185,129,0.4)] transition-all duration-300">
                <Swords className="w-5 h-5 mr-2" />
                <Trans>Play Now</Trans>
                <ArrowRight className="w-4 h-4 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link to="/shop">
              <Button
                variant="outline"
                className="border-white/15 text-on-surface hover:border-tertiary/50 hover:text-tertiary font-data-mono text-sm px-8 py-6 rounded-xl"
              >
                <Wallet className="w-5 h-5 mr-2" />
                <Trans>Buy Chips</Trans>
              </Button>
            </Link>
          </div>
        </div>

        {/* ── Feature panels ───────────────────────────────────── */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {features.map((feature) => {
            const Icon = feature.icon;
            const isPrimary = feature.primary;
            return (
              <motion.div key={feature.titleKey} variants={cardVariants}>
                <Link
                  to={feature.to}
                  className={`group raised-panel relative h-full flex flex-col rounded-2xl p-5 transition-all duration-300 hover:border-tertiary/30 ${
                    isPrimary ? '' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-colors ${
                        isPrimary
                          ? 'bg-tertiary/15 border-tertiary/30 text-tertiary'
                          : 'bg-white/[0.04] border-white/10 text-on-surface-variant group-hover:text-tertiary group-hover:border-tertiary/25'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="font-display-lg text-base text-on-surface tracking-tight">
                      <Trans>{feature.titleKey}</Trans>
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed mb-5 flex-1">
                    <Trans>{feature.body}</Trans>
                  </p>
                  <span className="inline-flex items-center gap-1.5 data-strip text-[10px] uppercase tracking-[0.18em] text-tertiary/80 group-hover:text-tertiary transition-colors">
                    <Trans>{feature.cta}</Trans>
                    <ArrowRight className="w-3 h-3 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </motion.div>
    </div>
  );
}