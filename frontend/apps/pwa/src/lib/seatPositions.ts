export type Position = { left: string; top: string; bottom?: string; transform: string };

export const MAX_SEATS = 9;

export const desktopPositions: Position[] = [
  { left: '50%', top: '82%', transform: 'translate(-50%, -50%)' },
  { left: '92%', top: '72%', transform: 'translate(-50%, -50%)' },
  { left: '92%', top: '50%', transform: 'translate(-50%, -50%)' },
  { left: '92%', top: '28%', transform: 'translate(-50%, -50%)' },
  { left: '72%', top: '15%', transform: 'translate(-50%, -50%)' },
  { left: '28%', top: '15%', transform: 'translate(-50%, -50%)' },
  { left: '8%', top: '28%', transform: 'translate(-50%, -50%)' },
  { left: '8%', top: '50%', transform: 'translate(-50%, -50%)' },
  { left: '8%', top: '72%', transform: 'translate(-50%, -50%)' },
];

export function getMobilePositions(isNarrow: boolean): Position[] {
  const topPositions = [16, 32, 48, 64]; // percentages from top
  const heroTop = 'auto';
  const heroBottom = '5px'; // 60px from bottom ensures the center of the hub clears the action bar

  const rightSide = topPositions.map((t) => ({ left: '91%', top: t + '%', transform: 'translate(-50%, -50%)' }));
  const leftSide = topPositions.map((t) => ({ left: '9%', top: t + '%', transform: 'translate(-50%, -50%)' }));

  return [
    { left: '50%', top: heroTop, bottom: heroBottom, transform: 'translate(-50%, -50%)' }, // 0: Hero
    rightSide[3], rightSide[2], rightSide[1], rightSide[0],
    leftSide[0], leftSide[1], leftSide[2], leftSide[3],
  ];
}

export const potPositionDesktop: Position = { left: '50%', top: '10%', transform: 'translate(-50%, -50%)' };
export const potPositionMobile: Position = { left: '50%', top: '14%', transform: 'translate(-50%, -50%)' };

export function getPositionIndex(seatIndex: number, heroSeat: number): number {
  return ((seatIndex - heroSeat) % MAX_SEATS + MAX_SEATS) % MAX_SEATS;
}
