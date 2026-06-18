export type Position = { left: string; top: string; transform: string };

export const MAX_SEATS = 9;

export const desktopPositions: Position[] = [
  { left: '50%', top: '78%', transform: 'translate(-50%, -50%)' },
  { left: '94%', top: '70%', transform: 'translate(-50%, -50%)' },
  { left: '110%', top: '50%', transform: 'translate(-70%, -50%)' },
  { left: '94%', top: '22%', transform: 'translate(-50%, -50%)' },
  { left: '72%', top: '2%', transform: 'translate(-50%, -50%)' },
  { left: '28%', top: '2%', transform: 'translate(-50%, -50%)' },
  { left: '6%', top: '22%', transform: 'translate(-50%, -50%)' },
  { left: '-10%', top: '50%', transform: 'translate(30%, -50%)' },
  { left: '6%', top: '70%', transform: 'translate(-50%, -50%)' },
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
