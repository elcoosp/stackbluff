import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTable } from '../lib/api';
import { useTableStore } from '../stores/tableStore';
import { useToast } from './ui/toast';

interface CreateTableModalProps {
  open: boolean;
  onClose: () => void;
}

const STAKE_OPTIONS = [
  { label: '$0.02/$0.05 (NL5)', value: 'micro' },
  { label: '$0.10/$0.25 (NL25)', value: 'low' },
  { label: '$0.50/$1.00 (NL100)', value: 'medium' },
  { label: '$2/$4 (NL400)', value: 'high' },
  { label: '$5/$10 (NL1000)', value: 'very_high' },
  { label: '$10/$20 (NL2000)', value: 'elite' },
];

export function CreateTableModal({ open, onClose }: CreateTableModalProps) {
  const navigate = useNavigate();
  const [stakeLevel, setStakeLevel] = useState(STAKE_OPTIONS[0].value);
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { refresh } = useTableStore();
  const { show: showToast, ToastContainer } = useToast();

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (maxPlayers < 2 || maxPlayers > 9) {
      showToast('Max players must be between 2 and 9');
      return;
    }
    setIsSubmitting(true);
    try {
      const { table_id } = await createTable({
        stake_level: stakeLevel,
        max_players: maxPlayers,
      });
      await refresh();
      showToast('Table created!', 'success');
      onClose();
      navigate(`/table/${table_id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create table';
      showToast(message);
      console.error('Create table error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <ToastContainer />
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg w-full max-w-md p-6">
          <h2 className="text-xl font-semibold mb-4">Create New Table</h2>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="stake" className="block text-sm font-medium mb-1">
                Stake Level
              </label>
              <select
                id="stake"
                value={stakeLevel}
                onChange={(e) => setStakeLevel(e.target.value)}
                className="w-full border rounded-md p-2 bg-white dark:bg-gray-800"
              >
                {STAKE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label htmlFor="maxPlayers" className="block text-sm font-medium mb-1">
                Max Players ({maxPlayers})
              </label>
              <input
                id="maxPlayers"
                type="range"
                min={2}
                max={9}
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>2</span>
                <span>3</span>
                <span>4</span>
                <span>5</span>
                <span>6</span>
                <span>7</span>
                <span>8</span>
                <span>9</span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border rounded-md"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50"
              >
                {isSubmitting ? 'Creating...' : 'Create Table'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
