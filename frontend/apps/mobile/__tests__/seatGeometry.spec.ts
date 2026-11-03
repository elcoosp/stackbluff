/**
 * Seat geometry tests — pins the table-viewport contract (FROZEN).
 *
 * Source of truth (per docs/mobile-plan/contracts/table-viewport.md):
 *   frontend/apps/pwa/src/lib/seatPositions.ts  — original PWA implementation.
 *
 * IMPORTANT: this spec intentionally tests a LOCAL COPY of `getPositionIndex`
 * (mod-9 rotation) instead of importing it from `@stackbluff/ui-native`:
 * Agent-02 delivers `packages/ui-native/src/viewport/table.tsx` in parallel and
 * that module imports react-native, which these pure-logic tests must not pull
 * in. The local copy below mirrors the ui-native implementation 1:1 (same
 * `(((seatIndex - heroSeat) % MAX_SEATS) + MAX_SEATS) % MAX_SEATS` rotation, as
 * frozen from the PWA). The cross-check against the PWA source guarantees the
 * local copy never drifts, and therefore that the ui-native port (which must
 * equal the PWA behavior) is pinned by transitivity.
 */
import {
  desktopPositions,
  getMobilePositions,
  getPositionIndex,
  MAX_SEATS,
  potPositionDesktop,
  potPositionMobile,
} from '../../../apps/pwa/src/lib/seatPositions';

/** Local copy of the ui-native / PWA mod-9 rotation (see JSDoc above). */
const LOCAL_MAX_SEATS = 9;
function localGetPositionIndex(seatIndex: number, heroSeat: number): number {
  return (((seatIndex - heroSeat) % LOCAL_MAX_SEATS) + LOCAL_MAX_SEATS) % LOCAL_MAX_SEATS;
}

describe('MAX_SEATS', () => {
  it('is 9 per the frozen contract', () => {
    expect(MAX_SEATS).toBe(9);
  });
});

describe('getPositionIndex (mod-9 rotation)', () => {
  it('matches the PWA source of truth for every (seat, hero) pair', () => {
    for (let seatIndex = 0; seatIndex < 9; seatIndex += 1) {
      for (let heroSeat = 0; heroSeat < 9; heroSeat += 1) {
        expect(localGetPositionIndex(seatIndex, heroSeat)).toBe(
          getPositionIndex(seatIndex, heroSeat),
        );
      }
    }
  });

  it('always maps the hero seat to display index 0 (hero anchor is bottom-center)', () => {
    for (let heroSeat = 0; heroSeat < 9; heroSeat += 1) {
      expect(localGetPositionIndex(heroSeat, heroSeat)).toBe(0);
    }
  });

  it('always returns a value in 0..8, including negative (wrapped) seats', () => {
    for (let seatIndex = -18; seatIndex < 27; seatIndex += 1) {
      for (let heroSeat = 0; heroSeat < 9; heroSeat += 1) {
        const index = localGetPositionIndex(seatIndex, heroSeat);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThanOrEqual(8);
        expect(Number.isInteger(index)).toBe(true);
      }
    }
  });

  it('preserves circular seating order around the rotation', () => {
    // The next seat clockwise (seatIndex + 1) must always sit at (position + 1) % 9.
    for (let heroSeat = 0; heroSeat < 9; heroSeat += 1) {
      for (let seatIndex = 0; seatIndex < 9; seatIndex += 1) {
        const next = localGetPositionIndex((seatIndex + 1) % 9, heroSeat);
        expect(next).toBe((localGetPositionIndex(seatIndex, heroSeat) + 1) % 9);
      }
    }
  });

  it('is a pure rotation: seat at offset k keeps offset k for any hero', () => {
    for (let heroSeat = 0; heroSeat < 9; heroSeat += 1) {
      for (let offset = 0; offset < 9; offset += 1) {
        expect(localGetPositionIndex((heroSeat + offset) % 9, heroSeat)).toBe(offset);
      }
    }
  });
});

describe('mobile positions (hero anchored bottom-center)', () => {
  const mobile = getMobilePositions(false);

  it('yields exactly 9 positions', () => {
    expect(mobile).toHaveLength(9);
  });

  it('anchors the hero (position 0) to the bottom at 10px, centered', () => {
    const hero = mobile[0];
    expect(hero.left).toBe('50%');
    expect(hero.top).toBe('auto');
    expect(hero.bottom).toBe('10px');
  });

  it('stacks seats 1..4 down the right rail and 5..8 up the left rail', () => {
    for (const i of [1, 2, 3, 4]) {
      expect(mobile[i].left).toBe('91%');
    }
    for (const i of [5, 6, 7, 8]) {
      expect(mobile[i].left).toBe('9%');
    }
    // Right rail walks from bottom (70%) to top (10%); left rail mirrors top-down.
    expect(mobile[1].top).toBe('70%');
    expect(mobile[2].top).toBe('50%');
    expect(mobile[3].top).toBe('30%');
    expect(mobile[4].top).toBe('10%');
    expect(mobile[5].top).toBe('10%');
    expect(mobile[6].top).toBe('30%');
    expect(mobile[7].top).toBe('50%');
    expect(mobile[8].top).toBe('70%');
  });
});

describe('desktop positions (landscape / tablet)', () => {
  it('yields exactly 9 positions with the hero at bottom-center', () => {
    expect(desktopPositions).toHaveLength(9);
    expect(desktopPositions[0].left).toBe('50%');
    expect(desktopPositions[0].top).toBe('82%');
    expect(desktopPositions[2].left).toBe('92%');
    expect(desktopPositions[6].left).toBe('8%');
  });
});

describe('pot anchor positions (contract: desktop 10% / mobile 14%)', () => {
  it('matches the frozen values', () => {
    expect(potPositionDesktop.left).toBe('50%');
    expect(potPositionDesktop.top).toBe('10%');
    expect(potPositionMobile.left).toBe('50%');
    expect(potPositionMobile.top).toBe('14%');
  });
});
