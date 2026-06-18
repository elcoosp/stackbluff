export type Position = { left: string; top: string; transform: string };

export const MAX_SEATS = 9;

export const desktopPositions: Position[] = [
  // Hero (seat 0) – bottom center
  { left: '50%', top: '78%', transform: 'translate(-50%, -50%)' },
  // Seat 1 – right side, slightly lower
  { left: '88%', top: '68%', transform: 'translate(-50%, -50%)' },
  // Seat 2 – right side, middle
  { left: '92%', top: '50%', transform: 'translate(-50%, -50%)' },
  // Seat 3 – right side, slightly upper
  { left: '88%', top: '32%', transform: 'translate(-50%, -50%)' },
  // Seat 4 – top right
  { left: '68%', top: '8%', transform: 'translate(-50%, -50%)' },
  // Seat 5 – top left
  { left: '32%', top: '8%', transform: 'translate(-50%, -50%)' },
  // Seat 6 – left side, upper
  { left: '12%', top: '32%', transform: 'translate(-50%, -50%)' },
  // Seat 7 – left side, middle
  { left: '8%', top: '50%', transform: 'translate(-50%, -50%)' },
  // Seat 8 – left side, lower
  { left: '12%', top: '68%', transform: 'translate(-50%, -50%)' },
];

export function getMobilePositions(isNarrow: boolean): Position[] {
  return [
    { left: '50%', top: isNarrow ? '74%' : '80%', transform: 'translate(-50%, -50%)' },
    { left: '-2%', top: isNarrow ? '66%' : '72%', transform: 'translate(0, -50%)' },
    { left: '-6%', top: '50%', transform: 'translate(0, -50%)' },
    { left: '-2%', top: '20%', transform: 'translate(0, -50%)' },
    { left: '30%', top: '-2%', transform: 'translate(-50%, -50%)' },
    { left: '70%', top: '-2%', transform: 'translate(-50%, -50%)' },
    { left: '102%', top: '20%', transform: 'translate(-100%, -50%)' },
    { left: '106%', top: '50%', transform: 'translate(-100%, -50%)' },
    { left: '102%', top: isNarrow ? '66%' : '72%', transform: 'translate(-100%, -50%)' },
  ];
}

/** Pot center position relative to the table container */
export const potPositionDesktop: Position = { left: '50%', top: '10%', transform: 'translate(-50%, -50%)' };
export const potPositionMobile: Position = { left: '50%', top: '14%', transform: 'translate(-50%, -50%)' };

/** Convert a seat index to a position index relative to the hero */
export function getPositionIndex(seatIndex: number, heroSeat: number): number {
  return ((seatIndex - heroSeat) % MAX_SEATS + MAX_SEATS) % MAX_SEATS;
}
