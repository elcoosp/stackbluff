import { PlayerSpot } from './PlayerSpot';

type Position = { left: string; top: string; transform: string };

const MAX_SEATS = 9;

// ── Desktop positions (pushed to the rail) ──
const desktopPositions: Position[] = [
  { left: '50%', top: '94%', transform: 'translate(-50%, -50%)' },  // 0: bottom center
  { left: '94%', top: '78%', transform: 'translate(-50%, -50%)' },  // 1: bottom-right
  { left: '110%', top: '50%', transform: 'translate(-70%, -50%)' }, // 2: right-middle
  { left: '94%', top: '22%', transform: 'translate(-50%, -50%)' },  // 3: top-right
  { left: '72%', top: '2%', transform: 'translate(-50%, -50%)' },   // 4: top-center-right
  { left: '28%', top: '2%', transform: 'translate(-50%, -50%)' },   // 5: top-center-left
  { left: '6%', top: '22%', transform: 'translate(-50%, -50%)' },   // 6: top-left
  { left: '-10%', top: '50%', transform: 'translate(30%, -50%)' },  // 7: left-middle
  { left: '6%', top: '78%', transform: 'translate(-50%, -50%)' },   // 8: bottom-left
];

// ── Mobile positions (on the edges) ──
const mobilePositions: Position[] = [
  { left: '50%', top: '96%', transform: 'translate(-50%, -50%)' },  // 0: hero
  { left: '-2%', top: '80%', transform: 'translate(0, -50%)' },     // 1: bottom-left
  { left: '-6%', top: '50%', transform: 'translate(0, -50%)' },     // 2: left-middle
  { left: '-2%', top: '20%', transform: 'translate(0, -50%)' },     // 3: top-left
  { left: '30%', top: '-2%', transform: 'translate(-50%, -50%)' },  // 4: top-center-left
  { left: '70%', top: '-2%', transform: 'translate(-50%, -50%)' },  // 5: top-center-right
  { left: '102%', top: '20%', transform: 'translate(-100%, -50%)' }, // 6: top-right
  { left: '106%', top: '50%', transform: 'translate(-100%, -50%)' }, // 7: right-middle
  { left: '102%', top: '80%', transform: 'translate(-100%, -50%)' }, // 8: bottom-right
];

const defaultHeroSeat = {
  seat: 0,
  user_id: 'hero',
  stack: 1000,
  current_bet: 0,
  is_all_in: false,
  is_folded: false,
  is_active: true,
  display_name: 'You',
  avatar_url: undefined,
  hole_cards: [],
  position_badge: undefined,
  action: undefined,
};

const seatTransition = 'left 0.4s ease, top 0.4s ease, transform 0.4s ease';

export const SeatGrid = ({
  seats,
  heroSeat,
  dealerIndex,
  isDesktop,
  currentTurnUserId,
  timerTotalMs,
}: {
  seats: Record<number, any>;
  heroSeat: number | null;
  dealerIndex?: number | null;
  isDesktop: boolean;
  currentTurnUserId?: string | null;
  timerTotalMs?: number | null;
}) => {
  const positions = isDesktop ? desktopPositions : mobilePositions;

  const allSeats: Record<number, any> = { ...seats };
  if (heroSeat !== null && !allSeats[heroSeat]) {
    allSeats[heroSeat] = { ...defaultHeroSeat, seat: heroSeat };
  }

  const seatEntries = Object.entries(allSeats);

  return (
    <>
      {seatEntries.map(([index, seat]) => {
        const seatIndex = Number(index);
        const posIndex =
          heroSeat !== null
            ? ((seatIndex - heroSeat) % MAX_SEATS + MAX_SEATS) % MAX_SEATS
            : seatIndex;
        const pos = positions[posIndex];
        if (!pos) return null;

        const isDealer = dealerIndex !== undefined && dealerIndex !== null && seatIndex === dealerIndex;

        // Check if this seat is the current turn player
        const isCurrentTurn = currentTurnUserId && seat.user_id === currentTurnUserId;
        const timerRemainingMs = isCurrentTurn ? timerTotalMs : null;

        const seatWithName = {
          ...seat,
          display_name: seat.display_name || seat.user_id || 'Player',
          position_badge: seat.position_badge || undefined,
        };

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
              seat={seatWithName}
              isHero={seatIndex === heroSeat}
              isMobile={!isDesktop}
              isDealer={isDealer}
              seatPosition={pos}
              timerRemainingMs={timerRemainingMs}
            />
          </div>
        );
      })}
    </>
  );
};
