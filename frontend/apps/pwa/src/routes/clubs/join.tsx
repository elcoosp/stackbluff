import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiClient } from '@stackbluff/shared/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Users, Crown, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';

interface ClubPreview {
  id: string;
  name: string;
  logo_url?: string | null;
  members_count: number;
  is_owner: boolean;
  is_member: boolean;
  telegram_chat_id?: string | null;
}

type SearchParams = {
  invite?: string;
};

export const Route = createFileRoute('/clubs/join')({
  component: JoinClubPage,
  validateSearch: (search: Record<string, string>): SearchParams => ({
    invite: search.invite || '',
  }),
});

function JoinClubPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { invite } = useSearch({ from: '/clubs/join' });
  const user = useAuthStore((s) => s.user);
  const [joined, setJoined] = useState(false);

  // Fetch club details by invite code
  const { data: club, isLoading, error } = useQuery<ClubPreview>({
    queryKey: ['club-invite', invite],
    queryFn: () => apiClient<ClubPreview>(`/clubs/invite/${invite}`),
    enabled: !!invite,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const joinMutation = useMutation({
    mutationFn: () => apiClient<{ success: boolean }>('/clubs/join', {
      method: 'POST',
      body: JSON.stringify({ invite_code: invite }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      setJoined(true);
      toast.success('Successfully joined the club!');
      // Navigate to club page after a delay
      if (club) {
        setTimeout(() => {
          navigate({ to: '/clubs/$clubId', params: { clubId: club.id } });
        }, 1500);
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to join club');
    },
  });

  const handleJoin = () => {
    if (!invite) {
      toast.error('No invite code provided');
      return;
    }
    joinMutation.mutate();
  };

  if (!invite) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <Card className="max-w-md w-full p-6 text-center">
          <h2 className="text-xl font-semibold text-on-surface mb-2">No Invite Code</h2>
          <p className="text-on-surface-variant text-sm">This page requires an invite code.</p>
          <Button onClick={() => navigate({ to: '/clubs' })} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Clubs
          </Button>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <Loader2 className="w-10 h-10 text-tertiary animate-spin" />
        <p className="text-on-surface-variant mt-4">Loading club details...</p>
      </div>
    );
  }

  if (error || !club) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <Card className="max-w-md w-full p-6 text-center">
          <h2 className="text-xl font-semibold text-red-400 mb-2">Invalid Invite</h2>
          <p className="text-on-surface-variant text-sm">
            This invite link is invalid or has expired.
          </p>
          <Button onClick={() => navigate({ to: '/clubs' })} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Clubs
          </Button>
        </Card>
      </div>
    );
  }

  if (joined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <Card className="max-w-md w-full p-6 text-center">
          <div className="text-tertiary text-5xl mb-4">🎉</div>
          <h2 className="text-xl font-semibold text-on-surface mb-2">You're a Member!</h2>
          <p className="text-on-surface-variant text-sm">
            You have successfully joined <strong>{club.name}</strong>.
          </p>
          <p className="text-on-surface-variant/60 text-xs mt-2">Redirecting to club page...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
      <Card className="max-w-md w-full p-6">
        <div className="flex items-center gap-4 mb-4">
          {club.logo_url ? (
            <img
              src={club.logo_url}
              alt={club.name}
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-2xl">
              {club.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-xl font-semibold text-on-surface">{club.name}</h2>
            <p className="text-sm text-on-surface-variant flex items-center gap-1">
              <Users className="w-4 h-4" />
              {club.members_count} members
            </p>
            {club.is_owner && (
              <p className="text-xs text-yellow-400 flex items-center gap-1">
                <Crown className="w-3 h-3" />
                You are the owner
              </p>
            )}
          </div>
        </div>

        <p className="text-on-surface-variant text-sm mb-4">
          You've been invited to join this club. Click the button below to become a member.
        </p>

        {club.is_member ? (
          <Button
            className="w-full bg-tertiary text-on-tertiary hover:bg-tertiary-fixed"
            onClick={() => navigate({ to: '/clubs/$clubId', params: { clubId: club.id } })}
          >
            View Club
          </Button>
        ) : (
          <Button
            onClick={handleJoin}
            disabled={joinMutation.isPending}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium"
          >
            {joinMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Joining...
              </>
            ) : (
              'Join Club'
            )}
          </Button>
        )}

        <Button
          variant="outline"
          className="w-full mt-2 border-white/10 text-on-surface-variant hover:bg-white/5"
          onClick={() => navigate({ to: '/clubs' })}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Clubs
        </Button>
      </Card>
    </div>
  );
}
