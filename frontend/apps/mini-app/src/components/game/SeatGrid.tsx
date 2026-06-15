import { motion } from 'framer-motion';
import { PlayerSpot } from './PlayerSpot';
const desktopPositions: Record<number, { top: string; left: string; transform: string; right?: string }> = {
  0: { top: '82%', left: '5%', transform: 'translate(-50%, -50%)' },
  1: { top: '40%', left: '2%', transform: 'translate(-50%, -50%)' },
  2: { top: '10%', left: '15%', transform: 'translate(-50%, -50%)' },
  3: { top: '0%', left: '50%', transform: 'translate(-50%, -50%)' },
  4: { top: '10%', right: '15%', transform: 'translate(50%, -50%)' },
  5: { top: '40%', right: '2%', transform: 'translate(50%, -50%)' },
  6: { top: '82%', right: '5%', transform: 'translate(50%, -50%)' },
  7: { bottom: '-45px', left: '50%', transform: 'translateX(-50%)' },
  8: { top: '92%', left: '28%', transform: 'translate(-50%, -50%)' },
};
const mobilePositions: Record<number, { top: string; left: string; transform: string }> = {
  0: { top: '10%', left: '20%', transform: 'translate(-50%, -50%)' },
  1: { top: '10%', left: '80%', transform: 'translate(-50%, -50%)' },
  2: { top: '30%', left: '90%', transform: 'translate(-50%, -50%)' },
  3: { top: '60%', left: '90%', transform: 'translate(-50%, -50%)' },
  4: { top: '60%', left: '10%', transform: 'translate(-50%, -50%)' },
  5: { top: '30%', left: '10%', transform: 'translate(-50%, -50%)' },
  6: { top: '80%', left: '50%', transform: 'translate(-50%, -50%)' },
  7: { bottom: '20px', left: '50%', transform: 'translateX(-50%)' },
};
export const SeatGrid = ({ seats, heroSeat, isDesktop }: { seats: Record<number, any>; heroSeat: number; isDesktop: boolean }) => (
  <div className="relative w-full h-full">
    {Object.values(seats).map((seat) => {
      const pos = isDesktop ? desktopPositions[seat.seat_index] : mobilePositions[seat.seat_index];
      if (!pos) return null;
      return <motion.div key={seat.seat_index} layout className="absolute" style={{ ...pos, zIndex: seat.seat_index === heroSeat ? 350 : 50 }}><PlayerSpot seat={seat} isHero={heroSeat === seat.seat_index} /></motion.div>;
    })}
  </div>
);
