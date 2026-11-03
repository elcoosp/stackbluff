/**
 * Token contract tests for @stackbluff/ui-native (vitest, node env).
 *
 * Mirrors apps/mobile/__tests__/tokens.spec.ts (same FROZEN contract:
 * docs/mobile-plan/contracts/theme-tokens.md) so the design-system package can
 * be verified standalone. The tailwind.tokens.cjs mirror-sync assertions live in
 * the mobile jest suite (the .cjs file belongs to the app's tailwind config).
 */
import { card, colors, felt, motion } from '../src/tokens';

describe('frozen brand colors', () => {
  it('uses the brand emerald accent #4edea3 on the #131313 canvas', () => {
    expect(colors.accent).toBe('#4edea3');
    expect(colors.ring).toBe('#4edea3');
    expect(colors.background).toBe('#131313');
    expect(colors.surface).toBe('#131313');
  });

  it('pairs accent/on-accent from the contract', () => {
    expect(colors.onAccent).toBe('#003824');
    expect(colors.accentContainer).toBe('#0cb880');
  });
});

describe('frozen felt (table visuals)', () => {
  it('exposes the felt stop hexes', () => {
    expect(colors.felt).toBe('#1a6b42');
    expect(colors.feltDeep).toBe('#0f4d2e');
    expect(colors.feltDark).toBe('#0a3620');
    expect(colors.feltDarkest).toBe('#082e1a');
  });

  it('uses the mobile radial gradient stops from TableFelt', () => {
    expect([...felt.gradientStopsMobile]).toEqual(['#1a6b42', '#0f4d2e', '#0a3620', '#082e1a']);
    expect([...felt.gradientPositionsMobile]).toEqual([0, 0.35, 0.7, 1]);
    expect(felt.noiseOpacity).toBe(0.03);
    expect(felt.spotlightColor).toBe('rgba(78,222,163,0.05)');
  });
});

describe('frozen card metrics', () => {
  it('keeps the 5:7 aspect and cqw-derived font ratios', () => {
    expect(card.aspectRatio).toBeCloseTo(5 / 7, 12);
    expect(card.cornerRankRatio).toBe(0.25);
    expect(card.cornerSuitRatio).toBe(0.2);
    expect(card.centerSuitRatio).toBe(0.55);
    expect(card.paddingRatio).toBe(0.1);
  });
});

describe('frozen motion presets', () => {
  it('freezes the press spring at stiffness 300 / damping 20 and scale 0.97', () => {
    expect(motion.pressSpring.stiffness).toBe(300);
    expect(motion.pressSpring.damping).toBe(20);
    expect(motion.pressScale).toBe(0.97);
  });

  it('freezes the chip toss spring at stiffness 260 / damping 20', () => {
    expect(motion.chipTossSpring.stiffness).toBe(260);
    expect(motion.chipTossSpring.damping).toBe(20);
  });

  it('freezes the lose animation curve 500ms cubic-bezier(0.22, 1, 0.36, 1)', () => {
    expect(motion.loseDurationMs).toBe(500);
    expect([...motion.loseEasing]).toEqual([0.22, 1, 0.36, 1]);
  });
});
