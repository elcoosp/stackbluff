import { Card, CardContent } from '@/components/ui/card';
export const AnalyticsPanel = ({ isDesktop, winProb, potOdds, bestHand, strength }: any) => (
  isDesktop ? (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 w-56 space-y-3">
      <Card><CardContent><div>Win %<div className="text-accent text-xl">{winProb}%</div></div></CardContent></Card>
      <Card><CardContent><div>Pot Odds<div>{potOdds}:1</div></div></CardContent></Card>
      <Card><CardContent><div>Best Hand<div>{bestHand}</div></div></CardContent></Card>
    </div>
  ) : (
    <div className="fixed bottom-24 left-0 right-0 flex justify-center gap-4 bg-black/60 backdrop-blur-sm p-2 rounded-t-xl">
      <div className="text-center"><div className="text-xs">Win%</div><div className="text-accent">{winProb}%</div></div>
      <div className="text-center"><div className="text-xs">Odds</div><div>{potOdds}:1</div></div>
      <div className="text-center"><div className="text-xs">Best</div><div className="text-xs">{bestHand}</div></div>
    </div>
  )
);
