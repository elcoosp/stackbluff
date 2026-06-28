import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog } from '@stackbluff/shared/components/Dialog';
import { useQuery } from '@tanstack/react-query';
import { useClubTournaments } from '../../hooks/useClubTournaments';
import type { BlindTemplate } from '../../types/club';
import { apiRequest } from '../../lib/errorHandler';
import { logger } from '../../lib/logger';

interface ScheduleTournamentDialogProps {
  clubId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ScheduleTournamentDialog({
  clubId,
  isOpen,
  onClose,
}: ScheduleTournamentDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    max_players: 50,
    buy_in: 1000,
    scheduled_start: '',
    blind_schedule_id: 'standard',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const { scheduleTournament, isScheduling } = useClubTournaments(clubId);

  // Fetch blind templates from API
  const { data: blindTemplates } = useQuery<BlindTemplate[]>({
    queryKey: ['blind-templates'],
    queryFn: () => apiRequest<BlindTemplate[]>('/blind-templates', {}, {}),
    staleTime: 5 * 60 * 1000,
  });

  const templates = blindTemplates || [
    { id: 'standard', name: 'Standard (20 min levels)' },
    { id: 'turbo', name: 'Turbo (10 min levels)' },
    { id: 'deep-stack', name: 'Deep Stack (30 min levels)' },
    { id: 'hyper-turbo', name: 'Hyper Turbo (5 min levels)' },
  ];

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Tournament name is required';
    }

    if (!formData.scheduled_start) {
      newErrors.scheduled_start = 'Date and time are required';
    } else {
      const startDate = new Date(formData.scheduled_start);
      const now = new Date();
      if (startDate <= now) {
        newErrors.scheduled_start = 'Start time must be in the future';
      }
    }

    if (formData.max_players < 10 || formData.max_players > 500) {
      newErrors.max_players = 'Max players must be between 10 and 500';
    }

    if (formData.buy_in < 0) {
      newErrors.buy_in = 'Buy-in must be a positive number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    try {
      await scheduleTournament({
        name: formData.name.trim(),
        max_players: formData.max_players,
        buy_in: formData.buy_in,
        scheduled_start: new Date(formData.scheduled_start).toISOString(),
        blind_schedule_id: formData.blind_schedule_id,
      });

      toast.success('Tournament scheduled successfully!');
      handleClose();
    } catch (err) {
      logger.error('Failed to schedule tournament', err instanceof Error ? err : undefined, { clubId });
      toast.error(err instanceof Error ? err.message : 'Failed to schedule tournament');
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      max_players: 50,
      buy_in: 1000,
      scheduled_start: '',
      blind_schedule_id: 'standard',
    });
    setErrors({});
    onClose();
  };

  const minDateTime = new Date(Date.now() + 15 * 60 * 1000).toISOString().slice(0, 16);

  return (
    <Dialog open={isOpen} onClose={handleClose}>
      <div className="p-6">
        <h2 className="text-2xl font-bold text-white mb-6">Schedule Tournament</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-white/80 font-medium mb-2">Tournament Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Sunday Special"
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-white/80 font-medium mb-2">Start Date & Time *</label>
            <input
              type="datetime-local"
              value={formData.scheduled_start}
              onChange={(e) => setFormData({ ...formData, scheduled_start: e.target.value })}
              min={minDateTime}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            {errors.scheduled_start && (
              <p className="text-red-400 text-sm mt-1">{errors.scheduled_start}</p>
            )}
          </div>

          <div>
            <label className="block text-white/80 font-medium mb-2">Blind Structure</label>
            <select
              value={formData.blind_schedule_id}
              onChange={(e) => setFormData({ ...formData, blind_schedule_id: e.target.value })}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {templates.map((template) => (
                <option key={template.id} value={template.id} className="bg-gray-800">
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-white/80 font-medium mb-2">Max Players *</label>
              <input
                type="number"
                value={formData.max_players}
                onChange={(e) => setFormData({ ...formData, max_players: parseInt(e.target.value) || 0 })}
                min={10}
                max={500}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              {errors.max_players && <p className="text-red-400 text-sm mt-1">{errors.max_players}</p>}
            </div>

            <div>
              <label className="block text-white/80 font-medium mb-2">Buy-in (chips) *</label>
              <input
                type="number"
                value={formData.buy_in}
                onChange={(e) => setFormData({ ...formData, buy_in: parseInt(e.target.value) || 0 })}
                min={0}
                step={100}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              {errors.buy_in && <p className="text-red-400 text-sm mt-1">{errors.buy_in}</p>}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg text-white font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isScheduling}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg text-white font-medium transition-all shadow-lg disabled:opacity-50"
            >
              {isScheduling ? 'Scheduling...' : 'Schedule Tournament'}
            </button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
