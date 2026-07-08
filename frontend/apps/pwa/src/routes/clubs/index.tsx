import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiClient } from '@stackbluff/shared/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Users, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';

interface Club {
  id: string;
  name: string;
  logo_url?: string | null;
  members_count: number;
  is_owner: boolean;
}

export const Route = createFileRoute('/clubs/')({
  component: ClubsListPage,
});

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
    // Navigate to a create club page or open a modal
    // For now, we'll show a simple prompt
    const name = prompt('Enter club name:');
    if (!name?.trim()) return;
    // We'll implement creation in Phase 3.3
    toast.info('Club creation will be implemented in Phase 3.3');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-on-surface-variant">Loading clubs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-red-400">Failed to load clubs</p>
        <Button onClick={() => refetch()} variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display-lg text-3xl text-on-surface">Clubs</h1>
          <p className="text-on-surface-variant text-sm">Manage your clubs and join new ones</p>
        </div>
        <Button onClick={handleCreateClub} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Create Club
        </Button>
      </div>

      {clubs && clubs.length === 0 ? (
        <div className="text-center py-12 border border-white/10 rounded-xl bg-surface-container/50">
          <Users className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-4" />
          <p className="text-on-surface-variant">You haven't joined any clubs yet.</p>
          <p className="text-on-surface-variant/60 text-sm mt-2">Create a club or join one with an invite.</p>
          <Button onClick={handleCreateClub} className="mt-4">
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Club
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {clubs?.map((club) => (
            <Card
              key={club.id}
              className="p-4 hover:bg-white/5 transition-colors cursor-pointer"
              onClick={() => navigate({ to: '/clubs/$clubId', params: { clubId: club.id } })}
            >
              <div className="flex items-center gap-4">
                {club.logo_url ? (
                  <img
                    src={club.logo_url}
                    alt={club.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
                    {club.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-on-surface truncate">{club.name}</h3>
                    {club.is_owner && (
                      <Crown className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-on-surface-variant">
                    {club.members_count} members
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
