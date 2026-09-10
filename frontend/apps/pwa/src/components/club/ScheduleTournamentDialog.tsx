import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { apiClient } from '@stackbluff/shared/api/client';
import { Dialog } from '@stackbluff/shared/components/Dialog';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Coins, Loader2, Users, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBlindTemplates } from '@/hooks/useBlindTemplates';
import { cn } from '@/lib/utils';

interface ScheduleTournamentDialogProps {
  clubId: string;
  isOpen: boolean;
  onClose: () => void;
}

const tournamentSchema = z.object({
  name: z.string().min(3, t`Name must be at least 3 characters`).max(100),
  max_players: z.number().int().min(10, t`Minimum 10 players`).max(500, t`Maximum 500 players`),
  buy_in: z.number().int().min(0, t`Buy-in must be 0 or more`),
  scheduled_start: z.string().datetime({ message: t`Invalid date/time` }),
  tournament_type: z.enum(['SitAndGo', 'Mtt']),
  blind_schedule_id: z.string(),
});

export function ScheduleTournamentDialog({
  clubId,
  isOpen,
  onClose,
}: ScheduleTournamentDialogProps) {
  const queryClient = useQueryClient();
  const [_selectedType, setSelectedType] = useState<'SitAndGo' | 'Mtt'>('SitAndGo');

  // Use the hook for blind templates
  const { data: templates, isLoading: templatesLoading } = useBlindTemplates();

  const form = useForm({
    defaultValues: {
      name: '',
      max_players: 50,
      buy_in: 1000,
      scheduled_start: '',
      tournament_type: 'SitAndGo' as 'SitAndGo' | 'Mtt',
      blind_schedule_id: '',
    },
    validators: { onChange: tournamentSchema },
  });

  const mutation = useMutation({
    mutationFn: async (data: {
      name: string;
      max_players: number;
      buy_in: number;
      scheduled_start: string;
      blind_schedule_id?: string;
    }) => {
      return apiClient(`/clubs/${clubId}/tournaments`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-tournaments', clubId] });
      toast.success(t`Tournament scheduled successfully!`);
      onClose();
      form.reset();
    },
    onError: (error: Error) => {
      toast.error(error.message || t`Failed to schedule tournament`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    form.handleSubmit();
  };

  // Set default blind schedule when templates load
  useEffect(() => {
    if (templates && templates.length > 0 && !form.state.values.blind_schedule_id) {
      form.setFieldValue('blind_schedule_id', templates[0].id);
    }
  }, [templates, form.state.values.blind_schedule_id, form.setFieldValue]);

  const minDateTime = new Date(Date.now() + 15 * 60 * 1000).toISOString().slice(0, 16);

  return (
    <Dialog open={isOpen} onClose={onClose} className="max-w-lg">
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-on-surface">
              <Trans>Schedule Tournament</Trans>
            </h2>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              <Trans>Create a new tournament for your club</Trans>
            </p>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1 dialog-scroll">
          {/* Tournament Name */}
          <form.Field name="name">
            {(field) => (
              <div className="space-y-2">
                <Label
                  htmlFor="tournament-name"
                  className="font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase"
                >
                  <Trans>Tournament Name *</Trans>
                </Label>
                <Input
                  id="tournament-name"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={t`e.g., Sunday Special`}
                  className="bg-surface-container-high border-outline-variant/50 text-on-surface"
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-xs text-red-400">{field.state.meta.errors[0]?.message}</p>
                )}
              </div>
            )}
          </form.Field>

          {/* Tournament Type */}
          <form.Field name="tournament_type">
            {(field) => (
              <div className="space-y-2">
                <Label className="font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase">
                  <Trans>Tournament Type</Trans>
                </Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      field.handleChange('SitAndGo');
                      setSelectedType('SitAndGo');
                    }}
                    className={cn(
                      'flex-1 py-2 rounded-lg border-2 transition-all flex items-center justify-center gap-2',
                      field.state.value === 'SitAndGo'
                        ? 'border-tertiary bg-tertiary/10 text-tertiary'
                        : 'border-white/10 text-on-surface-variant hover:border-white/30',
                    )}
                  >
                    <Zap className="w-4 h-4" />
                    <Trans>Sit & Go</Trans>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      field.handleChange('Mtt');
                      setSelectedType('Mtt');
                    }}
                    className={cn(
                      'flex-1 py-2 rounded-lg border-2 transition-all flex items-center justify-center gap-2',
                      field.state.value === 'Mtt'
                        ? 'border-tertiary bg-tertiary/10 text-tertiary'
                        : 'border-white/10 text-on-surface-variant hover:border-white/30',
                    )}
                  >
                    <Users className="w-4 h-4" />
                    <Trans>MTT</Trans>
                  </button>
                </div>
              </div>
            )}
          </form.Field>

          {/* Max Players */}
          <form.Field name="max_players">
            {(field) => (
              <div className="space-y-2">
                <Label className="font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase">
                  <Trans>Max Players: {field.state.value}</Trans>
                </Label>
                <input
                  type="range"
                  min={10}
                  max={500}
                  step={10}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(Number(e.target.value))}
                  className="w-full h-2 bg-outline-variant/30 rounded-lg appearance-none cursor-pointer accent-tertiary"
                />
                <div className="flex justify-between text-[10px] text-on-surface-variant">
                  <span>10</span>
                  <span>50</span>
                  <span>100</span>
                  <span>250</span>
                  <span>500</span>
                </div>
              </div>
            )}
          </form.Field>

          {/* Buy-in */}
          <form.Field name="buy_in">
            {(field) => (
              <div className="space-y-2">
                <Label
                  htmlFor="buy-in"
                  className="font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase"
                >
                  <Trans>Buy-in (chips)</Trans>
                </Label>
                <div className="relative">
                  <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
                  <Input
                    id="buy-in"
                    type="number"
                    min={0}
                    step={100}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(Number(e.target.value))}
                    className="pl-9 bg-surface-container-high border-outline-variant/50 text-on-surface"
                  />
                </div>
              </div>
            )}
          </form.Field>

          {/* Scheduled Start */}
          <form.Field name="scheduled_start">
            {(field) => (
              <div className="space-y-2">
                <Label
                  htmlFor="start-time"
                  className="font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase"
                >
                  <Trans>Start Date & Time *</Trans>
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
                  <Input
                    id="start-time"
                    type="datetime-local"
                    min={minDateTime}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="pl-9 bg-surface-container-high border-outline-variant/50 text-on-surface"
                  />
                </div>
                {field.state.meta.errors.length > 0 && (
                  <p className="text-xs text-red-400">{field.state.meta.errors[0]?.message}</p>
                )}
              </div>
            )}
          </form.Field>

          {/* Blind Schedule Template */}
          <form.Field name="blind_schedule_id">
            {(field) => (
              <div className="space-y-2">
                <Label className="font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase">
                  <Trans>Blind Schedule</Trans>
                </Label>
                <Select
                  value={field.state.value}
                  onValueChange={(value) => field.handleChange(value)}
                >
                  <SelectTrigger className="bg-surface-container-high border-outline-variant/50 text-on-surface">
                    <SelectValue
                      placeholder={templatesLoading ? t`Loading...` : t`Select a template`}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {templates?.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                    {!templates ||
                      (templates.length === 0 && (
                        <SelectItem value="default" disabled>
                          <Trans>No templates available</Trans>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {field.state.meta.errors.length > 0 && (
                  <p className="text-xs text-red-400">{field.state.meta.errors[0]?.message}</p>
                )}
              </div>
            )}
          </form.Field>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/5 flex gap-3 justify-end shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={mutation.isPending}
            className="border-white/10 text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
          >
            <Trans>Cancel</Trans>
          </Button>
          <Button
            type="submit"
            disabled={mutation.isPending}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                <Trans>Scheduling...</Trans>
              </>
            ) : (
              <Trans>Schedule Tournament</Trans>
            )}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
