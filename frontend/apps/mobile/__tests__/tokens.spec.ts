/**
 * Token/brand smoke tests — pins the FROZEN theme-token contract.
 *
 * Source of truth: docs/mobile-plan/contracts/theme-tokens.md
 * Implemented in:  frontend/packages/ui-native/src/tokens.ts (A2)
 * Mirrored in:     frontend/apps/mobile/tailwind.tokens.cjs (tailwind theme)
 *
 * The ui-native import is a RELATIVE import of the TS source (not the package
 * barrel) on purpose: `@stackbluff/ui-native`'s index re-exports components that
 * pull in react-native, and these tests must stay runnable in plain node/CI.
 */
import {
  card,
  colors,
  felt,
  fontSizes,
  motion,
  radii,
} from '../../../packages/ui-native/src/tokens';
import tailwindTokens from '../tailwind.tokens.cjs';

/** 'felt-deep' -> 'feltDeep' */
function kebabToCamel(key: string): string {
  return key.replace(/-([a-z])/g, (_match, char: string) => char.toUpperCase());
}

// allowJs gives the .cjs import its exact object shape; widen to Records so the
// dynamic (string-keyed) sync lookups below typecheck without implicit any.
const twColors = tailwindTokens.colors as Record<string, string>;
const twRadii = tailwindTokens.radii as Record<string, string>;
const twFontSizes = tailwindTokens.fontSizes as Record<string, string[]>;

describe('ui-native brand colors (frozen contract)', () => {
  it('uses the brand emerald accent #4edea3', () => {
    expect(colors.accent).toBe('#4edea3');
    expect(colors.ring).toBe('#4edea3');
  });

  it('uses the dark canvas #131313', () => {
    expect(colors.background).toBe('#131313');
    expect(colors.surface).toBe('#131313');
  });

  it('pairs accent/on-accent and error/on-error from the contract', () => {
    expect(colors.onAccent).toBe('#003824');
    expect(colors.accentContainer).toBe('#0cb880');
    expect(colors.error).toBe('#ffb4ab');
    expect(colors.onError).toBe('#690005');
  });

  it('keeps suit colors in sync with the PWA cards', () => {
    expect(colors.suitRed).toBe('#e11d48');
    expect(colors.suitDark).toBe('#1e293b');
  });
});

describe('ui-native felt (table visuals)', () => {
  it('exposes the frozen felt stop hexes', () => {
    expect(colors.felt).toBe('#1a6b42');
    expect(colors.feltDeep).toBe('#0f4d2e');
    expect(colors.feltDark).toBe('#0a3620');
    expect(colors.feltDarkest).toBe('#082e1a');
  });

  it('uses the mobile radial gradient stops from TableFelt', () => {
    expect([...felt.gradientStopsMobile]).toEqual(['#1a6b42', '#0f4d2e', '#0a3620', '#082e1a']);
    expect([...felt.gradientPositionsMobile]).toEqual([0, 0.35, 0.7, 1]);
  });

  it('keeps border/noise/spotlight decorations from the contract', () => {
    expect(felt.borderWidth).toBe(2);
    expect(felt.noiseOpacity).toBe(0.03);
    expect(felt.spotlightColor).toBe('rgba(78,222,163,0.05)');
  });
});

describe('ui-native card metrics', () => {
  it('keeps the 5:7 card aspect', () => {
    expect(card.aspectRatio).toBeCloseTo(5 / 7, 12);
  });

  it('keeps cqw-derived font ratios', () => {
    expect(card.cornerRankRatio).toBe(0.25);
    expect(card.cornerSuitRatio).toBe(0.2);
    expect(card.centerSuitRatio).toBe(0.55);
    expect(card.paddingRatio).toBe(0.1);
  });
});

describe('ui-native motion presets', () => {
  it('freezes the press spring at stiffness 300 / damping 20', () => {
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

describe('tailwind.tokens.cjs <-> ui-native tokens sync', () => {
  it('mirrors the brand accent and felt tokens', () => {
    expect(tailwindTokens.colors.accent).toBe('#4edea3');
    expect(tailwindTokens.colors.felt).toBe('#1a6b42');
    expect(tailwindTokens.colors['felt-deep']).toBe('#0f4d2e');
    expect(tailwindTokens.colors['felt-dark']).toBe('#0a3620');
    expect(tailwindTokens.colors['felt-darkest']).toBe('#082e1a');
  });

  it('maps every tailwind color key to the same hex in ui-native tokens', () => {
    const tailwindKeys = Object.keys(tailwindTokens.colors);
    expect(tailwindKeys.length).toBeGreaterThan(0);
    for (const key of tailwindKeys) {
      const camel = kebabToCamel(key);
      expect(camel in colors).toBe(true);
      expect(twColors[key]).toBe(colors[camel as keyof typeof colors]);
    }
    // Note: tokens.colors.feltDarkestDesktop (#052416) is intentionally NOT
    // mirrored in tailwind.tokens.cjs — it is a desktop-only gradient stop.
  });

  it('mirrors radii (px suffix, DEFAULT -> base)', () => {
    const tailwindToTokenKey: Record<string, keyof typeof radii> = {
      sm: 'sm',
      DEFAULT: 'base',
      md: 'md',
      lg: 'lg',
      xl: 'xl',
    };
    for (const [twKey, tokenKey] of Object.entries(tailwindToTokenKey)) {
      expect(twRadii[twKey]).toBe(`${radii[tokenKey]}px`);
    }
  });

  it('mirrors font sizes (tailwind [size, line-height] arrays)', () => {
    for (const [key, size] of Object.entries(fontSizes)) {
      const tailwindSize = twFontSizes[key];
      expect(tailwindSize).toBeDefined();
      expect(Number.parseInt(tailwindSize[0], 10)).toBe(size);
    }
  });
});
