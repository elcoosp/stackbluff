import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { apiClient } from '@stackbluff/shared/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Trophy,
  Users,
  Coins,
  Calendar,
  Share2,
  Eye,
  Sparkles,
  Play,
  Clock,
  Award,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';

import { ErrorState } from '@/components/ui/ErrorState';

export const Route = createFileRoute('/replays')({
  component: ReplaysPage,
});

interface ReplayCard {
  id: string;
  hand_description: string;
  winner_name: string;
  winner_id: string;
  pot: number;
  played_at: string;
  table_id: string;
  community_cards?: string[];
  winner_cards?: string[];
  share_url: string;
}

function ReplaysPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  // Fetch replay cards
  const { data: replays, isLoading, error, refetch } = useQuery<ReplayCard[]>({
    queryKey: ['replays'],
    queryFn: () => apiClient<ReplayCard[]>('/replays'),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <Card className="max-w-md w-full p-6 text-center">
          <h2 className="text-xl font-semibold text-on-surface mb-2">Sign In Required</h2>
          <p className="text-on-surface-variant text-sm">Please sign in to view your replay cards.</p>
          <Link to="/login" className="mt-4 inline-block">
            <Button>Sign In</Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <ReplaysSkeleton />;
  }

  if (error || !replays) {
    return <ErrorState onRetry={() => refetch()} message="Failed to load replay cards." />;
  }

  if (replays.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <h1 className="font-display-lg text-2xl text-on-surface flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-tertiary" />
            Replay Cards
          </h1>
        </div>
        <Card className="p-12 text-center">
          <Share2 className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-4" />
          <p className="text-on-surface-variant">No replay cards yet.</p>
          <p className="text-on-surface-variant/60 text-sm mt-2">Significant hands you win will appear here.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display-lg text-3xl text-on-surface flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-tertiary" />
            Replay Cards
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">
            Significant hands you've won. Share them with friends!
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {replays.map((replay) => (
          <ReplayCard key={replay.id} replay={replay} />
        ))}
      </div>
    </div>
  );
}

function ReplayCard({ replay }: { replay: ReplayCard }) {
  const navigate = useNavigate();

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Check out my poker hand!',
        text: `I won a ${replay.hand_description} pot of $${replay.pot}! 🃏`,
        url: replay.share_url,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(replay.share_url).then(() => {
        toast.success('Link copied to clipboard!');
      }).catch(() => {
        toast.error('Failed to copy link');
      });
    }
  };

  return (
    <Card className="p-4 bg-white/5 border-white/10 hover:border-tertiary/30 transition-colors">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-on-surface flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              {replay.hand_description}
            </h3>
            <p className="text-sm text-on-surface-variant mt-1">
              Won by {replay.winner_name}
            </p>
          </div>
          <Badge variant="outline" className="border-tertiary/30 text-tertiary text-xs">
            ${replay.pot}
          </Badge>
        </div>

        <div className="flex items-center gap-4 text-xs text-on-surface-variant">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(replay.played_at).toLocaleDateString()}
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            Table {replay.table_id.slice(0, 6)}
          </span>
        </div>

        {/* Community cards preview */}
        {replay.community_cards && replay.community_cards.length > 0 && (
          <div className="flex gap-1 mt-1">
            {replay.community_cards.map((card, idx) => (
              <span key={idx} className="px-2 py-0.5 bg-white/5 rounded text-xs font-mono">
                {card}
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2 mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: '/table/$tableId', params: { tableId: replay.table_id }, search: { handId: replay.id } })}
            className="flex-1 border-white/10 text-on-surface-variant hover:text-on-surface"
          >
            <Eye className="w-4 h-4 mr-1" />
            View Hand
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="border-white/10 text-on-surface-variant hover:text-on-surface"
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ReplaysSkeleton() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 animate-pulse">
      <div>
        <Skeleton className="h-8 w-48 bg-white/5" />
        <Skeleton className="h-4 w-64 bg-white/5 mt-1" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-40 bg-white/5 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
