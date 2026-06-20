export type Position = { left: string; top: string; transform: string };

export const MAX_SEATS = 9;

export const desktopPositions: Position[] = [
  // 0: Hero
  { left: '50%', top: '82%', transform: 'translate(-50%, -50%)' },

  // 1 to 3: RIGHT SIDE (Straight column, overlapping rail slightly)
  { left: '92%', top: '72%', transform: 'translate(-50%, -50%)' }, // 1: Right Bottom
  { left: '92%', top: '50%', transform: 'translate(-50%, -50%)' }, // 2: Right Middle
  { left: '92%', top: '28%', transform: 'translate(-50%, -50%)' }, // 3: Right Upper

  // 4 & 5: TOP (Left untouched to avoid community cards)
  { left: '72%', top: '15%', transform: 'translate(-50%, -50%)' }, // 4: Top Right
  { left: '28%', top: '15%', transform: 'translate(-50%, -50%)' }, // 5: Top Left

  // 6 to 8: LEFT SIDE (Straight column, overlapping rail slightly)
  { left: '8%', top: '28%', transform: 'translate(-50%, -50%)' },  // 6: Left Upper
  { left: '8%', top: '50%', transform: 'translate(-50%, -50%)' },  // 7: Left Middle
  { left: '8%', top: '72%', transform: 'translate(-50%, -50%)' },  // 8: Left Bottom
];

export function getMobilePositions(isNarrow: boolean): Position[] {
  return [
    // 0: Hero (Bottom Center)
    { left: '50%', top: isNarrow ? '82%' : '85%', transform: 'translate(-50%, -50%)' },

    // 4 ON THE RIGHT (Straight U, slightly overlapping rail but inside screen)
    { left: '90%', top: '72%', transform: 'translate(-50%, -50%)' }, // 1: Right Bottom
    { left: '90%', top: '56%', transform: 'translate(-50%, -50%)' }, // 2: Right Mid-Bottom
    { left: '90%', top: '40%', transform: 'translate(-50%, -50%)' }, // 3: Right Mid-Top
    { left: '90%', top: '25%', transform: 'translate(-50%, -50%)' }, // 4: Right Top

    // 4 ON THE LEFT (Straight U, slightly overlapping rail but inside screen)
    { left: '10%', top: '25%', transform: 'translate(-50%, -50%)' }, // 5: Left Top
    { left: '10%', top: '40%', transform: 'translate(-50%, -50%)' }, // 6: Left Mid-Top
    { left: '10%', top: '56%', transform: 'translate(-50%, -50%)' }, // 7: Left Mid-Bottom
    { left: '10%', top: '72%', transform: 'translate(-50%, -50%)' }, // 8: Left Bottom
  ];
}

/** Pot center position relative to the table container */
export const potPositionDesktop: Position = { left: '50%', top: '10%', transform: 'translate(-50%, -50%)' };
export const potPositionMobile: Position = { left: '50%', top: '14%', transform: 'translate(-50%, -50%)' };

/** Convert a seat index to a position index relative to the hero */
export function getPositionIndex(seatIndex: number, heroSeat: number): number {
  return ((seatIndex - heroSeat) % MAX_SEATS + MAX_SEATS) % MAX_SEATS;
}
