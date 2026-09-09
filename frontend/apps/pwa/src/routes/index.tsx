import { Trans } from '@lingui/react/macro';
import { createFileRoute, Link } from '@tanstack/react-router';
import { BookOpen, ShoppingBag, Swords, Trophy } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const Route = createFileRoute('/')({
  component: IndexPage,
});

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.3,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.6, ease: 'easeOut' as const },
  },
};

function IndexPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#0a0a0a] flex flex-col items-center justify-start pt-16 pb-12 px-4 relative overflow-hidden">
      {/* Decorative glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-tertiary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-tertiary/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="max-w-5xl w-full relative z-10">
        {/* Hero section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="text-center mb-16"
        >
          <h1 className="font-display-lg text-6xl md:text-7xl text-on-surface uppercase tracking-tighter drop-shadow-2xl">
            <Trans>STACKBLUFF</Trans>
          </h1>
          <p className="font-data-mono text-sm md:text-base text-on-surface-variant mt-4 tracking-widest uppercase drop-shadow">
            <Trans>High Stakes Poker</Trans>
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link to="/lobby">
              <Button className="bg-tertiary text-on-tertiary hover:bg-tertiary-fixed font-data-mono text-sm px-8 py-6 rounded-xl shadow-lg shadow-tertiary/30 hover:shadow-tertiary/50 transition-all duration-300">
                <Swords className="w-5 h-5 mr-2" />
                <Trans>Play Now</Trans>
              </Button>
            </Link>
            <Link to="/shop">
              <Button
                variant="outline"
                className="border-tertiary/40 text-on-surface hover:bg-tertiary hover:text-on-tertiary font-data-mono text-sm px-8 py-6 rounded-xl shadow-lg hover:shadow-tertiary/30 transition-all duration-300"
              >
                <ShoppingBag className="w-5 h-5 mr-2" />
                <Trans>Shop</Trans>
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Feature Cards */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={cardVariants}>
            <Card className="backdrop-blur-xl bg-white/5 border-white/10 shadow-xl hover:bg-white/10 transition-all duration-300 h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-on-surface">
                  <Swords className="w-5 h-5 text-tertiary" />
                  <Trans>Play Now</Trans>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <p className="text-on-surface-variant text-sm mb-4">
                  <Trans>Join a table and test your skills against other players.</Trans>
                </p>
                <Link to="/lobby" className="mt-auto">
                  <Button className="w-full bg-tertiary/20 text-tertiary hover:bg-tertiary/30 font-data-mono tracking-wider uppercase text-xs border border-tertiary/20">
                    <Trans>JOIN TABLE</Trans>
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={cardVariants}>
            <Card className="backdrop-blur-xl bg-white/5 border-white/10 shadow-xl hover:bg-white/10 transition-all duration-300 h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-on-surface">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  <Trans>Leaderboard</Trans>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <p className="text-on-surface-variant text-sm mb-4">
                  <Trans>See who's on top. Rankings update in real-time.</Trans>
                </p>
                <Link to="/leaderboard" className="mt-auto">
                  <Button
                    variant="outline"
                    className="w-full border-white/20 text-on-surface hover:border-tertiary hover:text-tertiary hover:bg-tertiary/10 font-data-mono tracking-wider uppercase text-xs"
                  >
                    <Trans>VIEW RANKS</Trans>
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={cardVariants}>
            <Card className="backdrop-blur-xl bg-white/5 border-white/10 shadow-xl hover:bg-white/10 transition-all duration-300 h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-on-surface">
                  <ShoppingBag className="w-5 h-5 text-tertiary" />
                  <Trans>Shop</Trans>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <p className="text-on-surface-variant text-sm mb-4">
                  <Trans>Buy chips, season passes, and club upgrades.</Trans>
                </p>
                <Link to="/shop" className="mt-auto">
                  <Button
                    variant="outline"
                    className="w-full border-white/20 text-on-surface hover:border-tertiary hover:text-tertiary hover:bg-tertiary/10 font-data-mono tracking-wider uppercase text-xs"
                  >
                    <Trans>BROWSE</Trans>
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={cardVariants}>
            <Card className="backdrop-blur-xl bg-white/5 border-white/10 shadow-xl hover:bg-white/10 transition-all duration-300 h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-on-surface">
                  <BookOpen className="w-5 h-5 text-blue-400" />
                  <Trans>Learn</Trans>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <p className="text-on-surface-variant text-sm mb-4">
                  <Trans>New to poker? Start with the basics.</Trans>
                </p>
                <Link to="/guide" className="mt-auto">
                  <Button
                    variant="outline"
                    className="w-full border-white/20 text-on-surface hover:border-tertiary hover:text-tertiary hover:bg-tertiary/10 font-data-mono tracking-wider uppercase text-xs"
                  >
                    <Trans>GUIDE</Trans>
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
