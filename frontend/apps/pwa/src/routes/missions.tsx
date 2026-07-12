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
import { requireAuth } from '@/lib/authGuard';
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
  Sparkles,
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
  easy: <Target className="w-5 h-5 text-green-400" />,
  medium: <TrendingUp className="w-5 h-5 text-yellow-400" />,
  viral: <Share2 className="w-5 h-5 text-purple-400" />,
  weekly: <Calendar className="w-5 h-5 text-blue-400" />,
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
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  },
};

function MissionsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {} = useAuthStore();

  const { data: missions, isLoading, error, refetch } = useQuery<Mission[]>({
    queryKey: ['missions', 'today'],
    queryFn: () => apiClient<Mission[]>('/missions/today'),
    enabled: true,
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


  if (isLoading) {
    return <MissionsSkeleton />;
  }

  if (error || !missions) {
    return <ErrorState onRetry={() => refetch()} message="Failed to load missions." />;
  }

  const allCompleted = missions.length > 0 && missions.every((m) => m.completed);
  const totalProgress = missions.reduce((acc, m) => acc + m.progress, 0);
  const totalTarget = missions.reduce((acc, m) => acc + m.target, 0);
  const overallProgress = totalTarget > 0 ? (totalProgress / totalTarget) * 100 : 0;
  const completedCount = missions.filter((m) => m.completed).length;

  return (
    <div className="relative max-w-4xl mx-auto p-4 md:p-8 space-y-8">
      {/* Background Ambient Effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-tertiary/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-6"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-tertiary" />
            <span className="text-xs font-data-mono uppercase tracking-widest text-tertiary">
              Daily Objectives
            </span>
          </div>
          <h1 className="font-display-lg text-3xl md:text-4xl text-on-surface flex items-center gap-3">
            Missions
          </h1>
          <p className="text-on-surface-variant text-sm mt-1 max-w-md">
            Complete missions to earn chips and build your streak.
          </p>
        </div>

        <motion.button
          onClick={() => claimMutation.mutate()}
          disabled={!allCompleted || claimMutation.isPending}
          whileHover={{ scale: allCompleted ? 1.02 : 1 }}
          whileTap={{ scale: allCompleted ? 0.98 : 1 }}
          className={cn(
            'relative flex items-center gap-2 px-6 py-3 rounded-xl font-data-mono text-sm uppercase tracking-wider transition-all duration-300 overflow-hidden group',
            allCompleted
              ? 'bg-gradient-to-r from-tertiary to-emerald-400 text-on-tertiary shadow-lg shadow-tertiary/30'
              : 'bg-gray-700 text-gray-300 cursor-not-allowed'
          )}
        >
          {allCompleted && (
            <span className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          )}
          <Gift className="w-5 h-5 relative z-10" />
          <span className="relative z-10">
            {claimMutation.isPending ? 'Claiming...' : 'Claim All'}
          </span>
        </motion.button>
      </motion.div>

      {/* Overall Progress & Streak Grid */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {/* Progress Card */}
        <Card className="md:col-span-2 p-6 bg-white/5 backdrop-blur-xl border-white/10 shadow-xl rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-on-surface-variant flex items-center gap-2">
              <Target className="w-4 h-4" /> Overall Progress
            </span>
            <span className="font-data-mono text-2xl text-on-surface font-bold">
              {Math.round(overallProgress)}%
            </span>
          </div>
          <div className="relative w-full h-3 bg-black/20 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${overallProgress}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-tertiary to-emerald-400 rounded-full shadow-lg"
            />
          </div>
          <div className="flex justify-between text-xs text-on-surface-variant mt-2 font-medium">
            <span>{completedCount} / {missions.length} Completed</span>
            {allCompleted && (
              <span className="text-tertiary flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Ready to claim!
              </span>
            )}
          </div>
        </Card>

        {/* Streak Card */}
        <Card className="p-6 bg-gradient-to-br from-orange-500/10 to-red-500/5 backdrop-blur-xl border-orange-500/20 shadow-xl rounded-2xl">
          <div className="flex flex-col h-full justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-on-surface-variant">Streak</span>
              <Flame className="w-5 h-5 text-orange-400" />
            </div>
            <div className="mt-2">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold font-data-mono text-orange-400">7</span>
                <span className="text-sm text-on-surface-variant">days</span>
              </div>
              <p className="text-[10px] text-on-surface-variant mt-1 opacity-80">
                Keep it up!
              </p>
            </div>
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
        <AnimatePresence mode="popLayout">
          {missions.map((mission) => {
            const isCompleted = mission.completed;
            const progress = mission.target > 0 ? (mission.progress / mission.target) * 100 : 0;
            const categoryIcon = CATEGORY_ICONS[mission.category] || <Target className="w-5 h-5" />;
            const canReroll = !mission.completed && mission.progress === 0;

            return (
              <motion.div key={mission.id} variants={itemVariants} layout>
                <Card
                  className={cn(
                    'p-5 border transition-all duration-300 hover:bg-white/[0.07] backdrop-blur-xl group rounded-2xl relative overflow-hidden',
                    isCompleted
                      ? 'border-tertiary/30 bg-tertiary/[0.05] shadow-lg shadow-tertiary/10'
                      : 'border-white/10 bg-white/5 shadow-xl'
                  )}
                >
                  {/* Hover accent line */}
                  <div className={cn(
                    "absolute left-0 top-0 h-full w-1 transition-colors duration-300",
                    isCompleted ? "bg-tertiary" : "bg-transparent group-hover:bg-white/20"
                  )} />

                  <div className="flex items-center gap-4 pl-2">
                    {/* Icon Circle */}
                    <div className={cn(
                      'flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center border transition-all duration-300',
                      isCompleted
                        ? 'bg-tertiary/10 border-tertiary/30'
                        : 'bg-white/5 border-white/10 group-hover:border-white/20'
                    )}>
                      {isCompleted ? (
                        <CheckCircle className="w-6 h-6 text-tertiary" />
                      ) : (
                        categoryIcon
                      )}
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-headline-md text-base text-on-surface leading-tight">
                          {mission.description}
                        </h3>
                        <Badge
                          variant="outline"
                          className="text-[10px] border-white/10 text-on-surface-variant bg-white/5 capitalize font-mono"
                        >
                          {mission.mission_type.replace(/_/g, ' ')}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 mt-2">
                        {/* Reward */}
                        <div className="flex items-center gap-1.5 text-sm font-data-mono text-yellow-400/90">
                          <Coins className="w-4 h-4" />
                          <span>+{mission.reward_chips.toLocaleString()}</span>
                        </div>

                        {/* Progress Text */}
                        <span className="text-xs font-mono text-on-surface-variant/80">
                          {mission.progress} / {mission.target}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3 relative w-full h-1.5 bg-black/20 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                          className={cn(
                            "absolute top-0 left-0 h-full rounded-full",
                            isCompleted
                              ? 'bg-gradient-to-r from-tertiary to-emerald-400'
                              : 'bg-gradient-to-r from-blue-400 to-purple-400'
                          )}
                        />
                      </div>
                    </div>

                    {/* Action Area */}
                    <div className="flex-shrink-0 flex items-center justify-center min-w-[60px]">
                      {isCompleted ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="flex items-center gap-1 text-xs font-medium text-tertiary"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>Done</span>
                        </motion.div>
                      ) : (
                        canReroll && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => rerollMutation.mutate(mission.id)}
                            disabled={rerollMutation.isPending}
                            className="text-on-surface-variant hover:text-tertiary hover:bg-tertiary/10 rounded-full p-2 h-auto w-auto transition-colors"
                            title="Reroll Mission"
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
        </AnimatePresence>
      </motion.div>

      {/* Footer Info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="text-center pt-4"
      >
        <p className="text-xs text-on-surface-variant/60 font-mono">
          Missions reset in <span className="text-tertiary">14h 32m</span>
        </p>
      </motion.div>
    </div>
  );
}

function MissionsSkeleton() {
  return (
    <div className="relative max-w-4xl mx-auto p-4 md:p-8 space-y-8 animate-pulse">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-tertiary/5 rounded-full blur-[120px] pointer-events-none -z-10" />

      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 bg-white/5" />
          <Skeleton className="h-8 w-48 bg-white/5" />
          <Skeleton className="h-4 w-64 bg-white/5" />
        </div>
        <Skeleton className="h-12 w-32 bg-white/5 rounded-xl" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="md:col-span-2 h-28 bg-white/5 rounded-2xl" />
        <Skeleton className="h-28 bg-white/5 rounded-2xl" />
      </div>

      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 bg-white/5 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
