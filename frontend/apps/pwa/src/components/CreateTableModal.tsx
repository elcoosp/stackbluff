import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@stackbluff/shared';
import { LiquidMetalButton } from "@stackbluff/shared/ui/LiquidMetalButton";
import { Dialog } from '@stackbluff/shared/components/Dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trans, t } from '@lingui/react/macro';

interface CreateTableModalProps {
  open: boolean;
  onClose: () => void;
  onTableCreated: () => void;
}

export function CreateTableModal({ open, onClose, onTableCreated }: CreateTableModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tableName, setTableName] = useState('');
  const [stakeLevel, setStakeLevel] = useState('Micro');
  const [maxPlayers, setMaxPlayers] = useState('6');

  const createMutation = useMutation({
    mutationFn: (data: { name: string; stake_level: string; max_players: number }) =>
      apiClient<{ table_id: string }>('/tables', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      onTableCreated();
      onClose();
      navigate({ to: '/table/$tableId', params: { tableId: data.table_id } });
    },
    onError: (error: Error) => {
      console.error('Failed to create table:', error);
      alert(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableName.trim()) {
      alert(t`Table name is required`);
      return;
    }
    createMutation.mutate({
      name: tableName.trim(),
      stake_level: stakeLevel,
      max_players: parseInt(maxPlayers, 10),
    });
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5 shrink-0">
          <div>
            <h2 className="text-lg font-display-lg text-on-surface"><Trans>Create New Table</Trans></h2>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              <Trans>Enter a name and choose the stakes.</Trans>
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-6 dialog-scroll overflow-y-auto flex-1">
          <div className="space-y-2">
            <label className="font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase">
              <Trans>Table Name</Trans>
            </label>
            <Input
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder={t`e.g., My Private Table`}
              className="bg-surface-container-high border-outline-variant/50 text-on-surface"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase">
              <Trans>Stake Level</Trans>
            </label>
            <Select value={stakeLevel} onValueChange={setStakeLevel}>
              <SelectTrigger className="bg-surface-container-high border-outline-variant/50 text-on-surface">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-surface-container-high border-outline-variant/50">
                <SelectItem value="Micro"><Trans>Micro ($0.02/$0.05)</Trans></SelectItem>
                <SelectItem value="Low"><Trans>Low ($0.10/$0.25)</Trans></SelectItem>
                <SelectItem value="Medium"><Trans>Medium ($0.50/$1.00)</Trans></SelectItem>
                <SelectItem value="High"><Trans>High ($2/$4)</Trans></SelectItem>
                <SelectItem value="VeryHigh"><Trans>Very High ($5/$10)</Trans></SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="font-label-caps text-[10px] text-on-surface-variant tracking-wider uppercase">
              <Trans>Max Players: {maxPlayers}</Trans>
            </label>
            <input
              type="range"
              min={2}
              max={9}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(e.target.value)}
              className="w-full h-2 bg-outline-variant/30 rounded-lg appearance-none cursor-pointer accent-tertiary"
            />
            <div className="flex justify-between text-[10px] text-on-surface-variant">
              <span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/5 flex gap-3 justify-end shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-white/10 text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
          >
            <Trans>Cancel</Trans>
          </Button>
          <LiquidMetalButton type="submit" variant="emerald" disabled={createMutation.isPending}>
            {createMutation.isPending ? t`Creating...` : t`Create Table`}
          </LiquidMetalButton>
        </div>
      </form>
    </Dialog>
  );
}
