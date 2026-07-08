import { useState, useEffect } from 'react';
import { useActiveRoom } from '@stackbluff/shared/stores/gameStore';
import { useGameWebSocket } from '@/hooks/useGameWebSocket';
import { Moon, Sun } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SitOutButtonProps {
  roomId: string;
  className?: string;
}

export function SitOutButton({ roomId, className }: SitOutButtonProps) {
  const room = useActiveRoom();
  const { sendWsMessage } = useGameWebSocket(roomId); // We'll need to get the tableId from room

  const [isSittingOut, setIsSittingOut] = useState(false);

  // Determine if the hero is sitting out from the room state
  useEffect(() => {
    if (!room) return;
    // Find the hero seat (the user's own seat)
    const heroSeat = room.heroSeat;
    if (heroSeat === null || heroSeat === undefined) return;
    const seat = room.seats[heroSeat];
    if (seat) {
      setIsSittingOut(seat.sitting_out || false);
    }
  }, [room]);

  const toggleSitOut = () => {
    const newState = !isSittingOut;
    sendWsMessage('sit_out', { room_id: roomId, sitting_out: newState });
    // Optimistic update
    setIsSittingOut(newState);
  };

  if (!room) return null;

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={toggleSitOut}
      className={cn(
        'p-2 rounded-full transition-colors',
        isSittingOut
          ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
          : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10',
        className
      )}
      title={isSittingOut ? 'Sit In' : 'Sit Out'}
    >
      {isSittingOut ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
    </motion.button>
  );
}
