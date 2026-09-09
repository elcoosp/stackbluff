import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { apiClient } from '@stackbluff/shared/api/client';
import { Dialog } from '@stackbluff/shared/components/Dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { Loader2, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
      toast.success(t`Club created successfully!`);
      onClose();
      navigate({ to: '/clubs/$clubId', params: { clubId: data.club_id } });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t`Failed to create club`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(t`Club name is required`);
      return;
    }
    mutation.mutate({
      name: name.trim(),
      telegram_group_id: telegramGroupId.trim() || undefined,
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      className="max-w-lg p-6 md:p-8 bg-surface-container border border-white/10 backdrop-blur-2xl rounded-3xl"
    >
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-6"
      >
        {/* Header */}
        <div>
          <h2 className="font-display-lg text-2xl md:text-3xl text-on-surface">
            <Trans>Create New Club</Trans>
          </h2>
          <p className="text-on-surface-variant text-sm mt-1">
            <Trans>Start your own community and invite players.</Trans>
          </p>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label
              htmlFor="club-name"
              className="text-xs font-data-mono uppercase tracking-widest text-on-surface-variant"
            >
              <Trans>Club Name *</Trans>
            </Label>
            <Input
              id="club-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t`e.g., Poker Legends`}
              className="h-12 bg-white/5 border-white/10 rounded-xl px-4 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-tertiary/50 transition-all"
              autoFocus
              required
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="telegram-group"
              className="text-xs font-data-mono uppercase tracking-widest text-on-surface-variant"
            >
              <Trans>Telegram Group ID (optional)</Trans>
            </Label>
            <Input
              id="telegram-group"
              value={telegramGroupId}
              onChange={(e) => setTelegramGroupId(e.target.value)}
              placeholder={t`e.g., -1001234567890`}
              className="h-12 bg-white/5 border-white/10 rounded-xl px-4 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-tertiary/50 transition-all"
            />
            <p className="text-xs text-on-surface-variant/60">
              <Trans>Link your club to a Telegram group for notifications.</Trans>
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={mutation.isPending}
            className="flex items-center gap-2 px-4 py-3 border-outline-variant text-on-surface hover:border-tertiary hover:text-tertiary hover:bg-tertiary/10 font-label-caps text-xs uppercase tracking-wider rounded-xl w-full sm:w-auto justify-center"
          >
            <Trans>Cancel</Trans>
          </Button>
          <Button
            type="submit"
            disabled={mutation.isPending || !name.trim()}
            className="flex items-center gap-2 px-4 py-3 bg-tertiary text-on-tertiary font-label-caps text-xs hover:bg-tertiary-fixed uppercase tracking-wider shadow-lg shadow-emerald-500/10 rounded-xl w-full sm:flex-1 justify-center disabled:opacity-40"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <Trans>Creating...</Trans>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <Trans>Create Club</Trans>
              </>
            )}
          </Button>
        </div>
      </motion.form>
    </Dialog>
  );
}
