import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { GameRoomState } from '@stackbluff/shared/stores/gameStore';

interface TablePreviewThumbnailProps {
  roomId: string;
  room: GameRoomState;
  isActive: boolean;
  onClick: () => void;
}

export function TablePreviewThumbnail({ roomId, room, isActive, onClick }: TablePreviewThumbnailProps) {
  const playerCount = Object.keys(room.seats).length;
  const pot = room.pot || 0;
  const heroSeat = room.heroSeat;
  const heroUserId = heroSeat !== null ? room.seats[heroSeat]?.user_id : null;
  const heroStack = heroSeat !== null ? room.seats[heroSeat]?.stack || 0 : 0;

  // Get up to 4 players for preview
  const previewPlayers = Object.values(room.seats).slice(0, 4);

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        'relative w-12 h-12 rounded-lg border-2 transition-all duration-200 flex flex-col items-center justify-center bg-surface-container/80 backdrop-blur-sm',
        isActive ? 'border-tertiary shadow-[0_0_10px_rgba(78,222,163,0.3)]' : 'border-white/10 hover:border-white/30'
      )}
    >
      {/* Player avatars mini grid */}
      <div className="grid grid-cols-2 gap-0.5 w-full h-full p-1">
        {previewPlayers.map((seat, idx) => {
          const isHero = seat.user_id === heroUserId;
          return (
            <div
              key={idx}
              className={cn(
                'w-full aspect-square rounded-full border flex items-center justify-center text-[6px] font-bold transition-colors',
                isHero ? 'border-tertiary bg-tertiary/20 text-tertiary' : 'border-white/20 bg-white/5 text-white/50'
              )}
            >
              {isHero ? 'You' : seat.display_name?.charAt(0) || 'P'}
            </div>
          );
        })}
        {Array.from({ length: 4 - previewPlayers.length }).map((_, idx) => (
          <div
            key={`empty-${idx}`}
            className="w-full aspect-square rounded-full border border-white/5 bg-white/5 flex items-center justify-center text-[6px] text-white/20"
          >
            •
          </div>
        ))}
      </div>

      {/* Badge with player count */}
      <div className="absolute -top-1 -right-1 bg-surface-container border border-white/10 rounded-full px-1 text-[8px] font-mono text-white/70 min-w-[16px] text-center">
        {playerCount}
      </div>

      {/* Tooltip on hover */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black/90 backdrop-blur-sm rounded text-[8px] text-white/80 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        Pot: ${pot.toLocaleString()} • Stack: ${heroStack.toLocaleString()}
      </div>
    </motion.button>
  );
}
