import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog } from '@stackbluff/shared/components/Dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { apiClient } from '@stackbluff/shared/api/client';

interface CreateClubModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateClubModal({ open, onClose }: CreateClubModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [telegramGroupId, setTelegramGroupId] = useState('');

  const mutation = useMutation({
    mutationFn: async (data: { name: string; telegram_group_id?: string }) => {
      return apiClient<{ club_id: string }>('/clubs', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      toast.success('Club created successfully!');
      onClose();
      navigate({ to: '/clubs/$clubId', params: { clubId: data.club_id } });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to create club');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Club name is required');
      return;
    }
    mutation.mutate({
      name: name.trim(),
      telegram_group_id: telegramGroupId.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-on-surface">Create New Club</h2>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              Start your own community
            </p>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <div className="space-y-2">
            <Label htmlFor="club-name" className="font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase">
              Club Name *
            </Label>
            <Input
              id="club-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Poker Legends"
              className="bg-surface-container-high border-outline-variant/50 text-on-surface"
              autoFocus
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telegram-group" className="font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase">
              Telegram Group ID (optional)
            </Label>
            <Input
              id="telegram-group"
              value={telegramGroupId}
              onChange={(e) => setTelegramGroupId(e.target.value)}
              placeholder="e.g., -1001234567890"
              className="bg-surface-container-high border-outline-variant/50 text-on-surface"
            />
            <p className="text-[10px] text-on-surface-variant/50">
              Link your club to a Telegram group for notifications.
            </p>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-white/5 flex gap-3 justify-end shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={mutation.isPending}
            className="border-white/10 text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={mutation.isPending || !name.trim()}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Club'
            )}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
