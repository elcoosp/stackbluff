import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { apiClient } from '@stackbluff/shared/api/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { ErrorState } from '@/components/ui/ErrorState';
import {
  Trophy,
  Target,
  CheckCircle,
  RotateCcw,
  Gift,
  Flame,
  Zap,
  Award,
  Users,
  Share2,
  TrendingUp,
  Calendar
} from 'lucide-react';

export const Route = createFileRoute('/missions')({
  component: MissionsPage,
});

interface Mission {
  id: number;
  mission_type: string;
  description: string;
  reward_chips: number;
  completed: boolean;
  progress: number;
  target: number;
  category: string;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  easy: <Target className="w-4 h-4 text-green-400" />,
  medium: <TrendingUp className="w-4 h-4 text-yellow-400" />,
  viral: <Share2 className="w-4 h-4 text-purple-400" />,
  weekly: <Calendar className="w-4 h-4 text-blue-400" />,
};

function MissionsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();

  // Fetch today's missions
  const { data: missions, isLoading, error, refetch } = useQuery<Mission[]>({
    queryKey: ['missions', 'today'],
    queryFn: () => apiClient<Mission[]>('/missions/today'),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  // Claim daily reward
  const claimMutation = useMutation({
    mutationFn: () => apiClient<{ chips_awarded: number; streak_count: number; weekly_bonus_awarded: boolean }>('/missions/claim', {
      method: 'POST',
    }),
    onSuccess: (data) => {
      toast.success(`Claimed ${data.chips_awarded} chips!`);
      if (data.weekly_bonus_awarded) {
        toast.success('Weekly bonus unlocked! +10,000 chips');
      }
      queryClient.invalidateQueries({ queryKey: ['missions'] });
      queryClient.invalidateQueries({ queryKey: ['user-me'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to claim reward');
    },
  });

  // Reroll mission
  const rerollMutation = useMutation({
    mutationFn: (missionId: number) => apiClient<Mission>('/missions/reroll', {
      method: 'POST',
      body: JSON.stringify({ mission_id: missionId }),
    }),
    onSuccess: (newMission) => {
      toast.success('Mission rerolled!');
      queryClient.invalidateQueries({ queryKey: ['missions'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to reroll mission');
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <Card className="max-w-md w-full p-6 text-center">
          <h2 className="text-xl font-semibold text-on-surface mb-2">Sign In Required</h2>
          <p className="text-on-surface-variant text-sm">Please sign in to view your missions.</p>
          <Link to="/login" className="mt-4 inline-block">
            <Button>Sign In</Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <MissionsSkeleton />;
  }

  if (error || !missions) {
    return <ErrorState onRetry={() => refetch()} message="Failed to load missions." />;
  }

  const allCompleted = missions.every((m) => m.completed);
  const totalProgress = missions.reduce((acc, m) => acc + m.progress, 0);
  const totalTarget = missions.reduce((acc, m) => acc + m.target, 0);
  const overallProgress = totalTarget > 0 ? (totalProgress / totalTarget) * 100 : 0;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display-lg text-3xl text-on-surface flex items-center gap-2">
            <Trophy className="w-8 h-8 text-yellow-400" />
            Daily Missions
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">
            Complete missions to earn chips and rewards.
          </p>
        </div>
        <Button
          onClick={() => claimMutation.mutate()}
          disabled={!allCompleted || claimMutation.isPending}
          className={cn(
            'flex items-center gap-2',
            allCompleted ? 'bg-tertiary text-on-tertiary' : 'bg-white/10 text-on-surface-variant cursor-not-allowed'
          )}
        >
          <Gift className="w-4 h-4" />
          {claimMutation.isPending ? 'Claiming...' : 'Claim Reward'}
        </Button>
      </div>

      {/* Overall progress */}
      <Card className="p-4 bg-white/5 border-white/10">
        <div className="flex items-center justify-between">
          <span className="text-sm text-on-surface-variant">Overall Progress</span>
          <span className="text-sm font-mono text-tertiary">{Math.round(overallProgress)}%</span>
        </div>
        <Progress value={overallProgress} className="h-2 mt-2" indicatorClassName="bg-tertiary" />
        <div className="flex justify-between text-xs text-on-surface-variant mt-1">
          <span>{missions.filter(m => m.completed).length} / {missions.length} completed</span>
          {allCompleted && <span className="text-tertiary">🎉 All done!</span>}
        </div>
      </Card>

      {/* Mission list */}
      <div className="space-y-4">
        {missions.map((mission) => {
          const isCompleted = mission.completed;
          const progress = mission.target > 0 ? (mission.progress / mission.target) * 100 : 0;
          const categoryIcon = CATEGORY_ICONS[mission.category] || <Target className="w-4 h-4" />;
          const canReroll = !mission.completed && mission.progress === 0;

          return (
            <Card key={mission.id} className={cn(
              'p-4 border transition-colors',
              isCompleted ? 'border-tertiary/30 bg-tertiary/5' : 'border-white/10'
            )}>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                  {isCompleted ? <CheckCircle className="w-5 h-5 text-tertiary" /> : categoryIcon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-on-surface">{mission.description}</h3>
                    <Badge variant="outline" className="text-[10px] border-white/20 text-on-surface-variant">
                      {mission.mission_type.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-sm text-tertiary font-mono flex items-center gap-1">
                      <Gift className="w-3 h-3" />
                      +{mission.reward_chips} chips
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      {mission.progress} / {mission.target}
                    </span>
                  </div>
                  <div className="mt-2">
                    <Progress value={progress} className="h-1.5" indicatorClassName={isCompleted ? 'bg-tertiary' : 'bg-white/30'} />
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {isCompleted ? (
                    <span className="text-xs text-tertiary font-medium">✓ Completed</span>
                  ) : (
                    canReroll && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => rerollMutation.mutate(mission.id)}
                        disabled={rerollMutation.isPending}
                        className="text-on-surface-variant hover:text-on-surface"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    )
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Streak info */}
      <Card className="p-4 bg-white/5 border-white/10">
        <div className="flex items-center gap-3">
          <Flame className="w-6 h-6 text-orange-400" />
          <div>
            <p className="text-sm text-on-surface">Streak</p>
            <p className="text-xs text-on-surface-variant">Complete all missions daily to build your streak!</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function MissionsSkeleton() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48 bg-white/5" />
          <Skeleton className="h-4 w-64 bg-white/5 mt-1" />
        </div>
        <Skeleton className="h-10 w-32 bg-white/5 rounded-lg" />
      </div>
      <Skeleton className="h-20 bg-white/5 rounded-xl" />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 bg-white/5 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-16 bg-white/5 rounded-xl" />
    </div>
  );
}
