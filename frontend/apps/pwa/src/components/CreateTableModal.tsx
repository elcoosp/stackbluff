import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';

export function CreateTableModal({ open, onClose, onTableCreated }) {
  const navigate = useNavigate();
  const [stakeLevel, setStakeLevel] = useState('Micro');
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ stake_level: stakeLevel, max_players: maxPlayers }),
      });
      if (!res.ok) throw new Error('Failed to create table');
      const data = await res.json();
      onTableCreated();
      onClose();
      navigate({ to: '/table/$tableId', params: { tableId: data.table_id } });
    } catch (err) {
      console.error(err);
      alert('Failed to create table');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface-container rounded-lg shadow-lg w-full max-w-md p-6">
        <h2 className="text-xl font-semibold mb-4">Create New Table</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Stake Level</label>
            <select value={stakeLevel} onChange={(e) => setStakeLevel(e.target.value)} className="w-full border rounded-md p-2 bg-surface-container-high">
              <option value="Micro">Micro ($0.02/$0.05)</option>
              <option value="Low">Low ($0.10/$0.25)</option>
              <option value="Medium">Medium ($0.50/$1.00)</option>
              <option value="High">High ($2/$4)</option>
              <option value="VeryHigh">Very High ($5/$10)</option>
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Max Players ({maxPlayers})</label>
            <input type="range" min={2} max={9} value={maxPlayers} onChange={(e) => setMaxPlayers(Number(e.target.value))} className="w-full" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-md">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-tertiary text-on-tertiary rounded-md disabled:opacity-50">
              {isSubmitting ? 'Creating...' : 'Create Table'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
