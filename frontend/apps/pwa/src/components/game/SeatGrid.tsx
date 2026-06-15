import { PlayerSpot } from './PlayerSpot';

type Position = { left: string; top: string; transform: string };

const MAX_SEATS = 9;

const desktopPositions: Position[] = [
  { left: '50%', top: '90%', transform: 'translate(-50%, -50%)' },
  { left: '88%', top: '72%', transform: 'translate(-50%, -50%)' },
  { left: '106%', top: '50%', transform: 'translate(-65%, -50%)' },
  { left: '88%', top: '28%', transform: 'translate(-50%, -50%)' },
  { left: '68%', top: '5%', transform: 'translate(-50%, -50%)' },
  { left: '32%', top: '5%', transform: 'translate(-50%, -50%)' },
  { left: '12%', top: '28%', transform: 'translate(-50%, -50%)' },
  { left: '-6%', top: '50%', transform: 'translate(35%, -50%)' },
  { left: '12%', top: '72%', transform: 'translate(-50%, -50%)' },
];


const mobilePositions: Position[] = [
  { left: '50%', top: '92%', transform: 'translate(-50%, -50%)' },   // 0  Hero
  { left: '-1%', top: '76%', transform: 'translate(0, -50%)' },     // 1  Bottom-left
  { left: '-4%', top: '50%', transform: 'translate(0, -50%)' },     // 2  Left-middle
  { left: '-1%', top: '24%', transform: 'translate(0, -50%)' },     // 3  Top-left
  { left: '28%', top: '-1%', transform: 'translate(-50%, -50%)' },  // 4  Top-center-left
  { left: '72%', top: '-1%', transform: 'translate(-50%, -50%)' },  // 5  Top-center-right
  { left: '101%', top: '24%', transform: 'translate(-100%, -50%)' }, // 6  Top-right
  { left: '104%', top: '50%', transform: 'translate(-100%, -50%)' }, // 7  Right-middle
  { left: '101%', top: '76%', transform: 'translate(-100%, -50%)' }, // 8  Bottom-right
];
const defaultHeroSeat = {
  seat_index: 0,
  user_id: 'hero',
  stack: 1000,
  current_bet: 0,
  is_all_in: false,
  is_active: true,
  display_name: 'You',
  avatar_url: undefined,
  hole_cards: [],
  position_badge: undefined,
};

const seatTransition = 'left 0.4s ease, top 0.4s ease, transform 0.4s ease';

export const SeatGrid = ({
  seats,
  heroSeat,
  isDesktop,
}: {
  seats: Record<number, any>;
  heroSeat: number | null;
  isDesktop: boolean;
}) => {
  const positions = isDesktop ? desktopPositions : mobilePositions;

  const allSeats: Record<number, any> = { ...seats };
  if (heroSeat !== null && !allSeats[heroSeat]) {
    allSeats[heroSeat] = { ...defaultHeroSeat, seat_index: heroSeat };
  }

  return (
    <>
      {Object.entries(allSeats).map(([index, seat]) => {
        const seatIndex = Number(index);
        const posIndex =
          heroSeat !== null
            ? ((seatIndex - heroSeat) % MAX_SEATS + MAX_SEATS) % MAX_SEATS
            : seatIndex;
        const pos = positions[posIndex];
        if (!pos) return null;

        return (
          <div
            key={index}
            className="absolute z-[440]"
            style={{
              left: pos.left,
              top: pos.top,
              transform: pos.transform,
              transition: seatTransition,
            }}
          >
            <PlayerSpot
              seat={seat}
              isHero={seatIndex === heroSeat}
              isMobile={!isDesktop}
            />
          </div>
        );
      })}
    </>
  );
};
