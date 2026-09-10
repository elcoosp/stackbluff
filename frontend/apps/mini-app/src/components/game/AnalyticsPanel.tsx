import { Card, CardContent } from '@/components/ui/card';

interface AnalyticsPanelProps {
  isDesktop: boolean;
  winProb: number;
  potOdds: number;
  bestHand: string;
}

export const AnalyticsPanel = ({ isDesktop, winProb, potOdds, bestHand }: AnalyticsPanelProps) =>
  isDesktop ? (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 w-64 space-y-4 z-[500]">
      <Card className="bg-black/60 backdrop-blur-xl border-white/10">
        <CardContent className="p-4">
          <div className="text-xs text-primary/60 uppercase">Win Probability</div>
          <div className="text-2xl font-mono text-tertiary">{winProb}%</div>
        </CardContent>
      </Card>
      <Card className="bg-black/60 backdrop-blur-xl border-white/10">
        <CardContent className="p-4">
          <div className="text-xs text-primary/60 uppercase">Pot Odds</div>
          <div className="text-2xl font-mono text-on-surface">{potOdds}:1</div>
        </CardContent>
      </Card>
      <Card className="bg-black/60 backdrop-blur-xl border-white/10">
        <CardContent className="p-4">
          <div className="text-xs text-primary/60 uppercase">Best Hand</div>
          <div className="text-sm font-mono text-on-surface uppercase">{bestHand}</div>
        </CardContent>
      </Card>
    </div>
  ) : (
    <div className="fixed bottom-24 left-0 right-0 flex justify-center gap-6 bg-black/60 backdrop-blur-sm p-3 rounded-t-xl z-[500]">
      <div className="text-center">
        <div className="text-[10px] text-primary/60">Win%</div>
        <div className="text-tertiary">{winProb}%</div>
      </div>
      <div className="text-center">
        <div className="text-[10px] text-primary/60">Odds</div>
        <div>{potOdds}:1</div>
      </div>
      <div className="text-center">
        <div className="text-[10px] text-primary/60">Best</div>
        <div className="text-xs">{bestHand}</div>
      </div>
    </div>
  );
