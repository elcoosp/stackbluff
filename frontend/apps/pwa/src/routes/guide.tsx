import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  BookOpen,
  Trophy,
  Users,
  Coins,
  Crown,
  Swords,
  ChevronRight,
  Heart,
  Diamond,
  Club,
  Spade,
  Check,
} from 'lucide-react';

export const Route = createFileRoute('/guide')({
  component: GuidePage,
});

// Hand ranks ordered from highest to lowest – no emojis
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
  { name: 'UTG', label: 'Under the Gun', desc: 'First to act preflop, tightest range' },
  { name: 'HJ', label: 'Hijack', desc: 'Middle position, can open wider' },
  { name: 'CO', label: 'Cutoff', desc: 'Just before button, steal blinds' },
  { name: 'BTN', label: 'Button', desc: 'Best position, play the widest range' },
  { name: 'SB', label: 'Small Blind', desc: 'Bad position, defend carefully' },
  { name: 'BB', label: 'Big Blind', desc: 'Bad position, but get a discount' },
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

function GuidePage() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex items-center gap-3">
        <BookOpen className="w-8 h-8 text-tertiary" />
        <h1 className="font-display-lg text-3xl text-on-surface">Poker Guide</h1>
      </div>

      <Tabs defaultValue="hand-ranks" className="space-y-6">
        <TabsList className="bg-white/5 border border-white/10 rounded-lg p-1 overflow-x-auto overflow-y-hidden flex-nowrap">
          <TabsTrigger value="hand-ranks">Hand Ranks</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="terms">Key Terms</TabsTrigger>
          <TabsTrigger value="strategy">Strategy</TabsTrigger>
        </TabsList>

        {/* ── Hand Ranks ── */}
        <TabsContent value="hand-ranks" className="space-y-4">
          <p className="text-on-surface-variant text-sm">
            Poker hands are ranked from highest to lowest. Here's the order you need to know.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {HAND_RANKS.map((hand, idx) => (
              <Card key={idx} className="bg-white/5 border-white/10">
                <CardContent className="p-4 flex items-center gap-3">
                  <div>
                    <h3 className="font-semibold text-on-surface">{hand.name}</h3>
                    <p className="text-xs text-on-surface-variant">{hand.description}</p>
                  </div>
                  {idx < 3 && <Badge className="ml-auto bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Top</Badge>}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Positions ── */}
        <TabsContent value="positions" className="space-y-4">
          <p className="text-on-surface-variant text-sm">
            Your position at the table dramatically affects your strategy. Later position = more information.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {POSITIONS.map((pos) => (
              <Card key={pos.name} className="bg-white/5 border-white/10">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-tertiary">{pos.name}</h3>
                    <span className="text-xs text-on-surface-variant">{pos.label}</span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1">{pos.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Terms ── */}
        <TabsContent value="terms" className="space-y-4">
          <p className="text-on-surface-variant text-sm">
            Learn the language of poker to communicate and think like a pro.
          </p>
          <div className="space-y-2">
            {TERMS.map((item, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-white/5 border border-white/10 rounded-lg">
                <span className="font-semibold text-tertiary text-sm min-w-[80px]">{item.term}</span>
                <span className="text-sm text-on-surface-variant">{item.definition}</span>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── Strategy ── */}
        <TabsContent value="strategy" className="space-y-4">
          <p className="text-on-surface-variant text-sm">
            Basic strategy tips to improve your game.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-on-surface">Preflop Basics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-on-surface-variant">
                <div className="flex items-start gap-2"><Check className="w-4 h-4 text-tertiary mt-0.5 flex-shrink-0" /><span className="text-sm text-on-surface-variant">Play tight in early positions, wider in late positions</span></div>
                <div className="flex items-start gap-2"><Check className="w-4 h-4 text-tertiary mt-0.5 flex-shrink-0" /><span className="text-sm text-on-surface-variant">Raise or fold – avoid limping (just calling)</span></div>
                <div className="flex items-start gap-2"><Check className="w-4 h-4 text-tertiary mt-0.5 flex-shrink-0" /><span className="text-sm text-on-surface-variant">3‑bet with strong hands, 4‑bet with premiums</span></div>
                <div className="flex items-start gap-2"><Check className="w-4 h-4 text-tertiary mt-0.5 flex-shrink-0" /><span className="text-sm text-on-surface-variant">Suited connectors and high cards play well in position</span></div>
              </CardContent>
            </Card>
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-on-surface">Postflop Fundamentals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-on-surface-variant">
                <div className="flex items-start gap-2"><Check className="w-4 h-4 text-tertiary mt-0.5 flex-shrink-0" /><span className="text-sm text-on-surface-variant">C‑bet frequently when you were the aggressor</span></div>
                <div className="flex items-start gap-2"><Check className="w-4 h-4 text-tertiary mt-0.5 flex-shrink-0" /><span className="text-sm text-on-surface-variant">Consider your opponent's range, not just your hand</span></div>
                <div className="flex items-start gap-2"><Check className="w-4 h-4 text-tertiary mt-0.5 flex-shrink-0" /><span className="text-sm text-on-surface-variant">Bet for value with strong hands, bluff with weak ones</span></div>
                <div className="flex items-start gap-2"><Check className="w-4 h-4 text-tertiary mt-0.5 flex-shrink-0" /><span className="text-sm text-on-surface-variant">Use pot odds to decide if calling is profitable</span></div>
              </CardContent>
            </Card>
            <Card className="bg-white/5 border-white/10 md:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-on-surface">Tournament Strategy</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-on-surface-variant">
                <div className="flex items-start gap-2"><Check className="w-4 h-4 text-tertiary mt-0.5 flex-shrink-0" /><span className="text-sm text-on-surface-variant">Preserve your stack – avoid marginal all-ins early</span></div>
                <div className="flex items-start gap-2"><Check className="w-4 h-4 text-tertiary mt-0.5 flex-shrink-0" /><span className="text-sm text-on-surface-variant">Apply pressure on the bubble</span></div>
                <div className="flex items-start gap-2"><Check className="w-4 h-4 text-tertiary mt-0.5 flex-shrink-0" /><span className="text-sm text-on-surface-variant">Understand ICM – chip values change as payouts approach</span></div>
                <div className="flex items-start gap-2"><Check className="w-4 h-4 text-tertiary mt-0.5 flex-shrink-0" /><span className="text-sm text-on-surface-variant">Adjust to increasing blinds and antes</span></div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
