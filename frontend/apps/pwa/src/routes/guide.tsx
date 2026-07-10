import { createFileRoute } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  BookOpen,
  Crown,
  ChevronRight,
  Check,
  Sparkles,
  Target,
  Users,
  Gem,
  ListChecks,
  Brain,
} from 'lucide-react';

export const Route = createFileRoute('/guide')({
  component: GuidePage,
});

// Hand ranks ordered from highest to lowest
const HAND_RANKS = [
  { name: 'Royal Flush', description: 'Ace, King, Queen, Jack, 10, all same suit' },
  { name: 'Straight Flush', description: 'Five consecutive cards, all same suit' },
  { name: 'Four of a Kind', description: 'Four cards of the same rank' },
  { name: 'Full House', description: 'Three of a kind + a pair' },
  { name: 'Flush', description: 'Five cards, all same suit' },
  { name: 'Straight', description: 'Five consecutive cards' },
  { name: 'Three of a Kind', description: 'Three cards of the same rank' },
  { name: 'Two Pair', description: 'Two different pairs' },
  { name: 'One Pair', description: 'Two cards of the same rank' },
  { name: 'High Card', description: 'Highest card wins when no other hand is made' },
];

// Texas Hold'em position guide
const POSITIONS = [
  { name: 'UTG', label: 'Under the Gun', desc: 'First to act preflop, tightest range', color: 'text-red-400', bg: 'bg-red-500/10' },
  { name: 'HJ', label: 'Hijack', desc: 'Middle position, can open wider', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  { name: 'CO', label: 'Cutoff', desc: 'Just before button, steal blinds', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  { name: 'BTN', label: 'Button', desc: 'Best position, play the widest range', color: 'text-tertiary', bg: 'bg-tertiary/10' },
  { name: 'SB', label: 'Small Blind', desc: 'Bad position, defend carefully', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { name: 'BB', label: 'Big Blind', desc: 'Bad position, but get a discount', color: 'text-purple-400', bg: 'bg-purple-500/10' },
];

// Common poker terms
const TERMS = [
  { term: 'C‑bet', definition: 'Continuation bet – betting on the flop after raising preflop' },
  { term: '3‑bet', definition: 'A re‑raise preflop' },
  { term: 'Bluff', definition: 'Betting with a weak hand to force folds' },
  { term: 'Value Bet', definition: 'Betting with a strong hand to get called' },
  { term: 'Pot Odds', definition: 'Ratio of pot to call; used to decide if a call is profitable' },
  { term: 'Equity', definition: 'Your share of the pot based on your chance to win' },
  { term: 'Fold Equity', definition: 'Chance that your opponent folds to your bet' },
  { term: 'ICM', definition: 'Independent Chip Model – used in tournaments' },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  },
};

function GuidePage() {
  return (
    <div className="relative max-w-5xl mx-auto p-4 md:p-8 space-y-8">
      {/* Background Ambient Effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-data-mono uppercase tracking-widest text-blue-400">
            Learn & Master
          </span>
        </div>
        <h1 className="font-display-lg text-3xl md:text-4xl text-on-surface flex items-center gap-3">
          Poker Guide
        </h1>
        <p className="text-on-surface-variant text-sm mt-1 max-w-md">
          Master the rules, positions, and strategies to dominate the table.
        </p>
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue="hand-ranks" className="space-y-6">
        <TabsList className="flex w-full gap-1 bg-white/5 border border-white/10 rounded-2xl p-1.5 backdrop-blur-xl h-auto flex-wrap">
          <TabsTrigger
            value="hand-ranks"
            className="flex-1 flex items-center gap-2 py-2.5 rounded-xl text-sm font-medium data-[state=active]:bg-white/10 data-[state=active]:text-on-surface transition-all"
          >
            <Target className="w-4 h-4" /> Hand Ranks
          </TabsTrigger>
          <TabsTrigger
            value="positions"
            className="flex-1 flex items-center gap-2 py-2.5 rounded-xl text-sm font-medium data-[state=active]:bg-white/10 data-[state=active]:text-on-surface transition-all"
          >
            <Users className="w-4 h-4" /> Positions
          </TabsTrigger>
          <TabsTrigger
            value="terms"
            className="flex-1 flex items-center gap-2 py-2.5 rounded-xl text-sm font-medium data-[state=active]:bg-white/10 data-[state=active]:text-on-surface transition-all"
          >
            <ListChecks className="w-4 h-4" /> Key Terms
          </TabsTrigger>
          <TabsTrigger
            value="strategy"
            className="flex-1 flex items-center gap-2 py-2.5 rounded-xl text-sm font-medium data-[state=active]:bg-white/10 data-[state=active]:text-on-surface transition-all"
          >
            <Brain className="w-4 h-4" /> Strategy
          </TabsTrigger>
        </TabsList>

        {/* ── Hand Ranks ── */}
        <TabsContent value="hand-ranks">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {HAND_RANKS.map((hand, idx) => {
              const isTop = idx < 3;
              return (
                <motion.div key={idx} variants={itemVariants}>
                  <Card
                    className={cn(
                      "p-5 border backdrop-blur-xl rounded-2xl transition-all duration-300 hover:bg-white/[0.07] group relative overflow-hidden",
                      isTop
                        ? "bg-gradient-to-br from-yellow-500/10 to-orange-500/5 border-yellow-500/20"
                        : "bg-white/5 border-white/10"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center font-data-mono text-lg font-bold border transition-colors",
                        isTop
                          ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
                          : "bg-white/5 border-white/10 text-on-surface-variant"
                      )}>
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-headline-md text-base text-on-surface">{hand.name}</h3>
                        <p className="text-xs text-on-surface-variant mt-0.5">{hand.description}</p>
                      </div>
                      {isTop && (
                        <Badge variant="outline" className="border-yellow-500/30 text-yellow-400 bg-yellow-500/10 font-mono">
                          <Crown className="w-3 h-3 mr-1" /> Top
                        </Badge>
                      )}
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </TabsContent>

        {/* ── Positions ── */}
        <TabsContent value="positions">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {POSITIONS.map((pos) => (
              <motion.div key={pos.name} variants={itemVariants}>
                <Card className="p-5 bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl h-full hover:bg-white/[0.07] transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center font-data-mono font-bold border",
                      pos.bg, pos.color, "border-white/10"
                    )}>
                      {pos.name}
                    </div>
                    <div>
                      <h3 className="font-headline-md text-base text-on-surface">{pos.label}</h3>
                    </div>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-2">{pos.desc}</p>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </TabsContent>

        {/* ── Terms ── */}
        <TabsContent value="terms">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-3"
          >
            {TERMS.map((item, idx) => (
              <motion.div key={idx} variants={itemVariants}>
                <Card className="p-4 bg-white/5 border-white/10 backdrop-blur-xl rounded-xl flex items-center gap-4 hover:bg-white/[0.07] transition-colors">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 flex-shrink-0">
                    <ChevronRight className="w-4 h-4 text-tertiary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-headline-md text-sm text-tertiary font-medium mb-0.5">{item.term}</h3>
                    <p className="text-xs text-on-surface-variant">{item.definition}</p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </TabsContent>

        {/* ── Strategy ── */}
        <TabsContent value="strategy">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            <motion.div variants={itemVariants}>
              <Card className="p-6 bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                    <Target className="w-5 h-5 text-blue-400" />
                  </div>
                  <h3 className="font-headline-md text-base text-on-surface">Preflop Basics</h3>
                </div>
                <div className="space-y-3">
                  {[
                    "Play tight in early positions, wider in late positions",
                    "Raise or fold – avoid limping (just calling)",
                    "3‑bet with strong hands, 4‑bet with premiums",
                    "Suited connectors and high cards play well in position"
                  ].map((tip, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-tertiary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-tertiary" />
                      </div>
                      <span className="text-sm text-on-surface-variant">{tip}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="p-6 bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                    <Gem className="w-5 h-5 text-purple-400" />
                  </div>
                  <h3 className="font-headline-md text-base text-on-surface">Postflop Fundamentals</h3>
                </div>
                <div className="space-y-3">
                  {[
                    "C‑bet frequently when you were the aggressor",
                    "Consider your opponent's range, not just your hand",
                    "Bet for value with strong hands, bluff with weak ones",
                    "Use pot odds to decide if calling is profitable"
                  ].map((tip, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-tertiary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-tertiary" />
                      </div>
                      <span className="text-sm text-on-surface-variant">{tip}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants} className="md:col-span-2">
              <Card className="p-6 bg-gradient-to-br from-yellow-500/5 to-orange-500/5 border-yellow-500/10 backdrop-blur-xl rounded-2xl h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
                    <Crown className="w-5 h-5 text-yellow-400" />
                  </div>
                  <h3 className="font-headline-md text-base text-on-surface">Tournament Strategy</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    "Preserve your stack – avoid marginal all-ins early",
                    "Apply pressure on the bubble",
                    "Understand ICM – chip values change as payouts approach",
                    "Adjust to increasing blinds and antes"
                  ].map((tip, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-yellow-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-yellow-400" />
                      </div>
                      <span className="text-sm text-on-surface-variant">{tip}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
