import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
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
  Calendar,
  Coins,
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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
};

function MissionsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();

  const { data: missions, isLoading, error, refetch } = useQuery<Mission[]>({
    queryKey: ['missions', 'today'],
    queryFn: () => apiClient<Mission[]>('/missions/today'),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const claimMutation = useMutation({
    mutationFn: () =>
      apiClient<{ chips_awarded: number; streak_count: number; weekly_bonus_awarded: boolean }>(
        '/missions/claim',
        { method: 'POST' }
      ),
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

  const rerollMutation = useMutation({
    mutationFn: (missionId: number) =>
      apiClient<Mission>('/missions/reroll', {
        method: 'POST',
        body: JSON.stringify({ mission_id: missionId }),
      }),
    onSuccess: () => {
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
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="font-display-lg text-3xl md:text-4xl text-on-surface flex items-center gap-3">
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
            'flex items-center gap-2 px-6 py-3 rounded-xl font-data-mono text-sm uppercase tracking-wider transition-all',
            allCompleted
              ? 'bg-tertiary text-on-tertiary hover:bg-tertiary-fixed shadow-lg shadow-tertiary/30'
              : 'bg-white/5 text-on-surface-variant/40 cursor-not-allowed border border-white/10'
          )}
        >
          <Gift className="w-5 h-5" />
          {claimMutation.isPending ? 'Claiming...' : 'Claim Reward'}
        </Button>
      </motion.div>

      {/* Overall Progress */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="p-5 bg-white/5 backdrop-blur-sm border-white/10 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-on-surface-variant">Overall Progress</span>
            <span className="font-data-mono text-sm text-tertiary font-bold">
              {Math.round(overallProgress)}%
            </span>
          </div>
          <Progress
            value={overallProgress}
            className="h-2 mt-3 bg-white/10"
            indicatorClassName="bg-gradient-to-r from-tertiary to-emerald-400"
          />
          <div className="flex justify-between text-xs text-on-surface-variant mt-2">
            <span>
              {missions.filter((m) => m.completed).length} / {missions.length} completed
            </span>
            {allCompleted && (
              <span className="text-tertiary font-medium flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> All done!
              </span>
            )}
          </div>
        </Card>
      </motion.div>

      {/* Mission List */}
      <motion.div
        className="space-y-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {missions.map((mission) => {
          const isCompleted = mission.completed;
          const progress = mission.target > 0 ? (mission.progress / mission.target) * 100 : 0;
          const categoryIcon = CATEGORY_ICONS[mission.category] || <Target className="w-4 h-4" />;
          const canReroll = !mission.completed && mission.progress === 0;

          return (
            <motion.div key={mission.id} variants={itemVariants}>
              <Card
                className={cn(
                  'p-5 border transition-all duration-300 hover:border-tertiary/40 hover:bg-white/5 backdrop-blur-sm group',
                  isCompleted
                    ? 'border-tertiary/30 bg-tertiary/5'
                    : 'border-white/10 bg-white/5'
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-lg border border-white/10 group-hover:border-tertiary/30 transition-colors">
                    {isCompleted ? (
                      <CheckCircle className="w-6 h-6 text-tertiary" />
                    ) : (
                      categoryIcon
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-headline-md text-base text-on-surface leading-tight">
                        {mission.description}
                      </h3>
                      <Badge
                        variant="outline"
                        className="text-[10px] border-white/20 text-on-surface-variant bg-white/5"
                      >
                        {mission.mission_type.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5">
                      <span className="text-sm text-tertiary font-data-mono flex items-center gap-1">
                        <Coins className="w-4 h-4" />
                        +{mission.reward_chips}
                      </span>
                      <span className="text-xs font-mono text-on-surface-variant">
                        {mission.progress} / {mission.target}
                      </span>
                    </div>
                    <div className="mt-2.5">
                      <Progress
                        value={progress}
                        className="h-1.5 bg-white/10"
                        indicatorClassName={isCompleted ? 'bg-tertiary' : 'bg-white/30'}
                      />
                    </div>
                  </div>
                  <div className="flex-shrink-0 self-center">
                    {isCompleted ? (
                      <span className="text-xs font-medium text-tertiary flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> Done
                      </span>
                    ) : (
                      canReroll && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => rerollMutation.mutate(mission.id)}
                          disabled={rerollMutation.isPending}
                          className="text-on-surface-variant hover:text-tertiary hover:bg-tertiary/10 rounded-full p-2 h-auto w-auto"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      )
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Streak & Bonus Info */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Card className="p-5 bg-white/5 backdrop-blur-sm border-white/10 shadow-xl flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
              <Flame className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-on-surface">Streak</p>
              <p className="text-xs text-on-surface-variant">
                Complete all missions daily to build your streak!
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="border-tertiary/30 text-tertiary">
              🔥 7 days
            </Badge>
          </div>
        </Card>
      </motion.div>
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
        <Skeleton className="h-10 w-32 bg-white/5 rounded-xl" />
      </div>
      <Skeleton className="h-20 bg-white/5 rounded-xl" />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 bg-white/5 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-20 bg-white/5 rounded-xl" />
    </div>
  );
}
