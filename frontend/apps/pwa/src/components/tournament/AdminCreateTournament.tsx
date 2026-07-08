import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@stackbluff/shared/stores/authStore';
import { apiClient } from '@stackbluff/shared/api/client';
import { toast } from 'sonner';
import { Dialog } from '@stackbluff/shared/components/Dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trophy, Calendar, Users, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBlindTemplates } from '@/hooks/useBlindTemplates';

interface AdminCreateTournamentProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type TournamentType = 'SitAndGo' | 'Mtt';

interface FormData {
  name: string;
  tournament_type: TournamentType;
  max_players: number;
  buy_in: number;
  scheduled_start: string;
  blind_schedule_id: string;
  start_delay_seconds: number;
  min_players_to_start: number;
}

const DEFAULT_FORM: FormData = {
  name: '',
  tournament_type: 'SitAndGo',
  max_players: 50,
  buy_in: 1000,
  scheduled_start: '',
  blind_schedule_id: '',
  start_delay_seconds: 15,
  min_players_to_start: 3,
};

export function AdminCreateTournament({ open, onClose, onSuccess }: AdminCreateTournamentProps) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  // Admin mode: check env var OR a role from user (if we add is_admin later)
  const isAdmin = import.meta.env.VITE_ADMIN_MODE === 'true' || (user as any)?.is_admin === true;

  const { data: templates, isLoading: templatesLoading } = useBlindTemplates();
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [selectedType, setSelectedType] = useState<TournamentType>('SitAndGo');

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setForm(DEFAULT_FORM);
      // Set default blind schedule if available
      if (templates && templates.length > 0 && !form.blind_schedule_id) {
        setForm((f) => ({ ...f, blind_schedule_id: templates[0].id }));
      }
    }
  }, [open, templates]);

  // Update min_players_to_start when type changes
  useEffect(() => {
    if (selectedType === 'SitAndGo') {
      setForm((f) => ({ ...f, max_players: Math.min(f.max_players, 9) }));
    } else {
      setForm((f) => ({ ...f, max_players: Math.max(f.max_players, 10) }));
    }
  }, [selectedType]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        tournament_type: data.tournament_type,
        max_players: data.max_players,
        buy_in: data.buy_in,
        scheduled_start: data.scheduled_start,
        blind_schedule_id: data.blind_schedule_id || undefined,
        start_delay_seconds: data.start_delay_seconds,
        min_players_to_start: data.min_players_to_start,
      };
      // POST to global tournaments endpoint (admin only)
      return apiClient<{ tournament_id: string }>('/tournaments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast.success('Tournament created successfully!');
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      onSuccess?.();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create tournament');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Tournament name is required');
      return;
    }
    if (!form.scheduled_start) {
      toast.error('Please select a start date and time');
      return;
    }
    if (form.buy_in < 0) {
      toast.error('Buy-in must be 0 or more');
      return;
    }
    if (form.max_players < 2) {
      toast.error('Minimum 2 players required');
      return;
    }
    mutation.mutate(form);
  };

  const minDateTime = new Date(Date.now() + 15 * 60 * 1000).toISOString().slice(0, 16);

  if (!isAdmin) {
    return null;
  }

  return (
    <Dialog open={open} onClose={onClose} className="max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-on-surface flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              Create Tournament
            </h2>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              Create a global tournament for all players
            </p>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1 dialog-scroll">
          {/* Tournament Name */}
          <div className="space-y-2">
            <Label htmlFor="admin-name" className="font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase">
              Tournament Name *
            </Label>
            <Input
              id="admin-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g., Sunday Special"
              className="bg-surface-container-high border-outline-variant/50 text-on-surface"
              required
            />
          </div>

          {/* Tournament Type */}
          <div className="space-y-2">
            <Label className="font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase">
              Tournament Type
            </Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedType('SitAndGo');
                  setForm((f) => ({ ...f, tournament_type: 'SitAndGo', max_players: Math.min(f.max_players, 9) }));
                }}
                className={cn(
                  'flex-1 py-2 rounded-lg border-2 transition-all flex items-center justify-center gap-2',
                  selectedType === 'SitAndGo'
                    ? 'border-tertiary bg-tertiary/10 text-tertiary'
                    : 'border-white/10 text-on-surface-variant hover:border-white/30'
                )}
              >
                Sit & Go
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedType('Mtt');
                  setForm((f) => ({ ...f, tournament_type: 'Mtt', max_players: Math.max(f.max_players, 10) }));
                }}
                className={cn(
                  'flex-1 py-2 rounded-lg border-2 transition-all flex items-center justify-center gap-2',
                  selectedType === 'Mtt'
                    ? 'border-tertiary bg-tertiary/10 text-tertiary'
                    : 'border-white/10 text-on-surface-variant hover:border-white/30'
                )}
              >
                MTT
              </button>
            </div>
          </div>

          {/* Max Players */}
          <div className="space-y-2">
            <Label className="font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase">
              Max Players: {form.max_players}
            </Label>
            <input
              type="range"
              min={selectedType === 'SitAndGo' ? 2 : 10}
              max={selectedType === 'SitAndGo' ? 9 : 500}
              step={1}
              value={form.max_players}
              onChange={(e) => setForm((f) => ({ ...f, max_players: Number(e.target.value) }))}
              className="w-full h-2 bg-outline-variant/30 rounded-lg appearance-none cursor-pointer accent-tertiary"
            />
            <div className="flex justify-between text-[10px] text-on-surface-variant">
              <span>{selectedType === 'SitAndGo' ? 2 : 10}</span>
              <span>{selectedType === 'SitAndGo' ? 9 : 500}</span>
            </div>
          </div>

          {/* Buy-in */}
          <div className="space-y-2">
            <Label htmlFor="admin-buyin" className="font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase">
              Buy-in (chips)
            </Label>
            <div className="relative">
              <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
              <Input
                id="admin-buyin"
                type="number"
                min={0}
                step={100}
                value={form.buy_in}
                onChange={(e) => setForm((f) => ({ ...f, buy_in: Number(e.target.value) }))}
                className="pl-9 bg-surface-container-high border-outline-variant/50 text-on-surface"
              />
            </div>
          </div>

          {/* Scheduled Start */}
          <div className="space-y-2">
            <Label htmlFor="admin-start" className="font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase">
              Start Date & Time *
            </Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
              <Input
                id="admin-start"
                type="datetime-local"
                min={minDateTime}
                value={form.scheduled_start}
                onChange={(e) => setForm((f) => ({ ...f, scheduled_start: e.target.value }))}
                className="pl-9 bg-surface-container-high border-outline-variant/50 text-on-surface"
                required
              />
            </div>
          </div>

          {/* Start Delay (seconds) */}
          <div className="space-y-2">
            <Label className="font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase">
              Start Delay: {form.start_delay_seconds}s
            </Label>
            <input
              type="range"
              min={5}
              max={120}
              step={5}
              value={form.start_delay_seconds}
              onChange={(e) => setForm((f) => ({ ...f, start_delay_seconds: Number(e.target.value) }))}
              className="w-full h-2 bg-outline-variant/30 rounded-lg appearance-none cursor-pointer accent-tertiary"
            />
            <div className="flex justify-between text-[10px] text-on-surface-variant">
              <span>5s</span>
              <span>120s</span>
            </div>
          </div>

          {/* Min Players to Start */}
          <div className="space-y-2">
            <Label className="font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase">
              Min Players to Start: {form.min_players_to_start}
            </Label>
            <input
              type="range"
              min={2}
              max={form.max_players}
              step={1}
              value={form.min_players_to_start}
              onChange={(e) => setForm((f) => ({ ...f, min_players_to_start: Number(e.target.value) }))}
              className="w-full h-2 bg-outline-variant/30 rounded-lg appearance-none cursor-pointer accent-tertiary"
            />
            <div className="flex justify-between text-[10px] text-on-surface-variant">
              <span>2</span>
              <span>{form.max_players}</span>
            </div>
          </div>

          {/* Blind Schedule Template */}
          <div className="space-y-2">
            <Label className="font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase">
              Blind Schedule
            </Label>
            <Select
              value={form.blind_schedule_id}
              onValueChange={(value) => setForm((f) => ({ ...f, blind_schedule_id: value }))}
            >
              <SelectTrigger className="bg-surface-container-high border-outline-variant/50 text-on-surface">
                <SelectValue placeholder={templatesLoading ? 'Loading...' : 'Select a template'} />
              </SelectTrigger>
              <SelectContent>
                {templates?.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
                {(!templates || templates.length === 0) && (
                  <SelectItem value="default" disabled>No templates available</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
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
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={mutation.isPending}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Create Tournament
              </>
            )}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
