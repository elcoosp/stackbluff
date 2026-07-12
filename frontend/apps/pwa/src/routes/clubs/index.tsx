import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { apiClient } from '@stackbluff/shared/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, Crown, ChevronRight, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { CreateClubModal } from '@/components/club/CreateClubModal';
import { ErrorState } from '@/components/ui/ErrorState';
import { requireAuth } from '@/lib/authGuard';

interface Club {
  id: string;
  name: string;
  logo_url?: string | null;
  members_count: number;
  is_owner: boolean;
}

export const Route = createFileRoute('/clubs/')({
  component: ClubsListPage,
  beforeLoad: requireAuth
});

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

function ClubsListPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: clubs, isLoading, error, refetch } = useQuery<Club[]>({
    queryKey: ['clubs'],
    queryFn: () => apiClient<Club[]>('/clubs'),
    staleTime: 60 * 1000,
  });

  const handleCreateClub = () => {
    setIsCreateOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-on-surface-variant animate-pulse">
        Loading clubs...
      </div>
    );
  }

  if (error) {
    return <ErrorState onRetry={() => refetch()} message="Failed to load clubs" />;
  }

  return (
    <div className="relative max-w-5xl mx-auto p-4 md:p-8 space-y-8">
      {/* Background Ambient Effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-data-mono uppercase tracking-widest text-purple-400">
              Community & Play
            </span>
          </div>
          <h1 className="font-display-lg text-3xl md:text-4xl text-on-surface flex items-center gap-3">
            Poker Clubs
          </h1>
          <p className="text-on-surface-variant text-sm mt-1 max-w-md">
            Create your private club or join an exclusive community.
          </p>
        </div>
        <Button
          onClick={handleCreateClub}
          className="flex items-center gap-2 px-4 py-2 bg-tertiary text-on-tertiary font-label-caps text-xs hover:bg-tertiary-fixed uppercase tracking-wider shadow-lg shadow-emerald-500/10 rounded-lg"
        >
          <Plus className="w-4 h-4" />
          Create Club
        </Button>
      </motion.div>

      {/* Invite join form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="p-4 bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl flex flex-col sm:flex-row items-center gap-3">
          <input
            type="text"
            placeholder="Enter invite code"
            id="invite-code-input"
            className="flex-1 w-full bg-surface-container-high border border-white/10 rounded-lg px-4 py-2 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-tertiary/50 transition-all"
          />
          <Button
            variant="outline"
            onClick={() => {
              const input = document.getElementById('invite-code-input') as HTMLInputElement;
              const code = input?.value.trim();
              if (code) {
                navigate({ to: '/clubs/join', search: { invite: code } });
              } else {
                toast.error('Please enter an invite code');
              }
            }}
            className="flex items-center gap-2 px-4 py-2 border-outline-variant text-on-surface hover:border-tertiary hover:text-tertiary hover:bg-tertiary/10 font-label-caps text-xs uppercase tracking-wider rounded-lg w-full sm:w-auto justify-center"
          >
            <Users className="w-4 h-4" />
            Join Club
          </Button>
        </Card>
      </motion.div>

      {/* Clubs List / Empty State */}
      {clubs && clubs.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="p-12 bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl text-center flex flex-col items-center">
            <Users className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-4" />
            <p className="text-on-surface-variant">You haven't joined any clubs yet.</p>
            <p className="text-on-surface-variant/60 text-sm mt-2">
              Create a club or join one with an invite.
            </p>
            <Button
              onClick={handleCreateClub}
              className="mt-6 px-4 py-2 bg-tertiary text-on-tertiary font-label-caps text-xs hover:bg-tertiary-fixed uppercase tracking-wider shadow-lg shadow-emerald-500/10 rounded-lg flex items-center gap-2"
            >
              <Plus className="w-4 h-4 mr-1" />
              Create Your First Club
            </Button>
          </Card>
        </motion.div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          {clubs?.map((club) => (
            <motion.div key={club.id} variants={itemVariants}>
              <Card
                className="p-5 bg-white/5 border-white/10 backdrop-blur-xl rounded-2xl hover:bg-white/[0.07] transition-colors cursor-pointer group"
                onClick={() => navigate({ to: '/clubs/$clubId', params: { clubId: club.id } })}
              >
                <div className="flex items-center gap-4">
                  {club.logo_url ? (
                    <img
                      src={club.logo_url}
                      alt={club.name}
                      className="w-14 h-14 rounded-full object-cover border border-white/10 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500/80 to-pink-500/80 flex items-center justify-center text-white font-bold text-xl border border-white/10 flex-shrink-0">
                      {club.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-headline-md text-base text-on-surface truncate group-hover:text-tertiary transition-colors">
                        {club.name}
                      </h3>
                      {club.is_owner && (
                        <Badge variant="outline" className="border-yellow-500/30 text-yellow-400 bg-yellow-500/10 font-mono flex-shrink-0">
                          <Crown className="w-3 h-3 mr-1" /> Owner
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1 flex items-center gap-1.5">
                      <Users className="w-3 h-3" /> {club.members_count} members
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-outline-variant opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all flex-shrink-0" />
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Modals */}
      <CreateClubModal open={isCreateOpen} onClose={() => { setIsCreateOpen(false); refetch(); }} />
    </div>
  );
}
