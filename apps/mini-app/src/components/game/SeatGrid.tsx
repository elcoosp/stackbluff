import { motion } from 'framer-motion';
import { PlayerSpot } from './PlayerSpot';
const mobilePositions = (index: number, total: number) => {
  const positions = { 0: { top: '5%', left: '20%' }, 1: { top: '5%', left: '60%' }, 2: { top: '20%', left: '80%' }, 3: { top: '50%', left: '80%' }, 4: { top: '50%', left: '20%' }, 5: { top: '70%', left: '50%' } };
  return positions[index] || { top: '50%', left: '50%' };
};
const desktopPositions = (index: number, total: number) => {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  const radiusX = 35, radiusY = 25;
  return { top: `calc(50% + ${radiusY * Math.sin(angle)}%)`, left: `calc(50% + ${radiusX * Math.cos(angle)}%)` };
};
export const SeatGrid = ({ seats, heroSeat, isDesktop }: { seats: Record<number, any>; heroSeat: number; isDesktop: boolean }) => (
  <div className="relative w-full h-full">
    {Object.values(seats).map((seat) => (
      <motion.div key={seat.seat_index} layout className="absolute -translate-x-1/2 -translate-y-1/2" style={isDesktop ? desktopPositions(seat.seat_index, Object.keys(seats).length) : mobilePositions(seat.seat_index, Object.keys(seats).length)}>
        <PlayerSpot seat={seat} isHero={heroSeat === seat.seat_index} />
      </motion.div>
    ))}
  </div>
);
