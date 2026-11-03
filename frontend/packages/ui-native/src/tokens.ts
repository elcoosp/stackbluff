/**
 * StackBluff theme tokens — single source of truth for the native design system.
 * Values frozen from packages/shared/src/theme.css + PWA component styles.
 * See docs/mobile-plan/contracts/theme-tokens.md. Mirrored in apps/mobile/tailwind.tokens.cjs.
 */

export const colors = {
  background: '#131313',
  onBackground: '#e2e2e2',
  surface: '#131313',
  onSurface: '#e2e2e2',
  surfaceDim: '#131313',
  surfaceBright: '#393939',
  surfaceVariant: '#353535',
  surfaceContainerLowest: '#0e0e0e',
  surfaceContainerLow: '#1b1b1b',
  surfaceContainer: '#1f1f1f',
  surfaceContainerHigh: '#2a2a2a',
  surfaceContainerHighest: '#353535',
  onSurfaceVariant: '#c7c6cb',
  outline: '#919095',
  outlineVariant: '#46464b',
  primary: '#c6c6cf',
  onPrimary: '#2f3037',
  accent: '#4edea3',
  onAccent: '#003824',
  accentContainer: '#0cb880',
  error: '#ffb4ab',
  onError: '#690005',
  errorContainer: '#93000a',
  onErrorContainer: '#ffdad6',
  card: '#1f1f1f',
  cardForeground: '#e2e2e2',
  border: '#353535',
  ring: '#4edea3',
  muted: '#46464b',
  mutedForeground: '#c7c6cb',
  input: '#46464b',
  popover: '#1b1b1b',
  popoverForeground: '#e2e2e2',

  // Table visuals
  felt: '#1a6b42',
  feltDeep: '#0f4d2e',
  feltDark: '#0a3620',
  feltDarkest: '#082e1a',
  feltDarkestDesktop: '#052416',
  suitRed: '#e11d48',
  suitDark: '#1e293b',
} as const;

/** Table rail (mobile variant) — from TableFelt.tsx */
export const rail = {
  radiusMobile: 40,
  radiusDesktop: 140,
  background:
    'linear-gradient(180deg, #1a1a1a 0%, #2a2a2a 15%, #3a3a3a 30%, #1a1a1a 50%, #0d0d0d 70%, #2a2a2a 85%, #111 100%)' as const,
  gradientStops: [
    '#1a1a1a',
    '#2a2a2a',
    '#3a3a3a',
    '#1a1a1a',
    '#0d0d0d',
    '#2a2a2a',
    '#111111',
  ] as const,
  gradientPositions: [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1] as const,
  borderColor: 'rgba(255,255,255,0.08)',
  borderTopColor: 'rgba(255,255,255,0.15)',
  outerShadow: ['0 20px 60px rgba(0,0,0,0.9)', '0 0 100px rgba(0,0,0,0.5)'] as const,
  innerRingShadow: 'inset 0 0 12px rgba(0,0,0,0.9), inset 0 0 3px rgba(0,0,0,0.6)',
} as const;

/** Table felt (mobile variant) — from TableFelt.tsx */
export const felt = {
  radiusMobile: 28,
  radiusDesktop: 100,
  gradientStopsMobile: ['#1a6b42', '#0f4d2e', '#0a3620', '#082e1a'] as const,
  gradientPositionsMobile: [0, 0.35, 0.7, 1] as const,
  gradientStopsDesktop: ['#1a6b42', '#0f4d2e', '#0a3620', '#052416'] as const,
  gradientPositionsDesktop: [0, 0.3, 0.6, 1] as const,
  center: { x: '50%', y: '40%' },
  borderColor: 'rgba(0,0,0,0.6)',
  borderWidth: 2,
  noiseOpacity: 0.03,
  spotlightColor: 'rgba(78,222,163,0.05)',
  spotlightExtent: '50%',
  innerShadowMobile: 'inset 0 0 20px rgba(0,0,0,0.45)',
  softShadowMobile: 'inset 0 1px 15px rgba(0,0,0,0.4), inset 0 0 40px rgba(0,0,0,0.2)',
} as const;

/** Card metrics — from Card.tsx (aspect 5/7, cqw-derived font ratios) */
export const card = {
  aspectRatio: 5 / 7,
  cornerRankRatio: 0.25,
  cornerSuitRatio: 0.2,
  centerSuitRatio: 0.55,
  paddingRatio: 0.1,
  frontBackground: '#ffffff',
  backBackground: ['#0f0f0f', '#1a1a1a'] as const,
  backBorderColor: 'rgba(255,255,255,0.3)',
  backPatternColor: 'rgba(78,222,163,0.15)',
  baseShadow: '0 4px 12px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.2)',
  winningShadowLow: '0 4px 12px rgba(0,0,0,0.5), 0 0 12px rgba(78,222,163,0.5)',
  winningShadowHigh: '0 4px 12px rgba(0,0,0,0.5), 0 0 24px rgba(78,222,163,0.7)',
  losingShadow: '0 4px 8px rgba(0,0,0,0.7)',
} as const;

/** Motion presets — Framer Motion values from PWA, frozen (theme-tokens.md §Motion) */
export const motion = {
  pressSpring: { stiffness: 300, damping: 20 },
  pressScale: 0.97,
  hoverLift: -4,
  loseDurationMs: 500,
  loseEasing: [0.22, 1, 0.36, 1] as const,
  loseScale: 0.98,
  winGlowLoopMs: 3000,
  floatLoopMs: 4000,
  sweepLoopMs: 3000,
  pulseEmeraldLoopMs: 2000,
  chipTossSpring: { stiffness: 260, damping: 20 },
} as const;

/** Typography */
export const fonts = {
  display: 'PlayfairDisplay_700Bold',
  body: 'Inter_400Regular',
  bodyBold: 'Inter_700Bold',
  data: 'JetBrainsMono_400Regular',
  labelCaps: 'JetBrainsMono_700Bold',
} as const;

export const fontSizes = {
  display: 32,
  headline: 24,
  body: 16,
  data: 14,
  label: 12,
} as const;

export const radii = { sm: 4, md: 12, base: 8, lg: 16, xl: 24 } as const;

/** Chip denominations — from PWA ChipStack/AnimatedChip */
export const chips = {
  denominations: [
    { value: 1000, color: '#1e1e1e', textColor: '#e2e2e2', ringColor: '#4edea3' },
    { value: 500, color: '#7a1f2b', textColor: '#ffffff', ringColor: '#e11d48' },
    { value: 100, color: '#1a1a1a', textColor: '#ffffff', ringColor: '#46464b' },
    { value: 25, color: '#0f4d2e', textColor: '#ffffff', ringColor: '#4edea3' },
    { value: 5, color: '#8a6d3b', textColor: '#ffffff', ringColor: '#d4af37' },
    { value: 1, color: '#e8e8e8', textColor: '#131313', ringColor: '#919095' },
  ],
  stackOffset: 3,
  chipSize: 28,
} as const;

/* ══════════════════════════════════════════════════════════════════════════
   Structured layer tokens (added by A2 for RN rendering of CSS effects).
   Same source files as above — CSS box-shadow/gradient strings decomposed
   into layerable values because RN cannot render those CSS syntaxes.
   ══════════════════════════════════════════════════════════════════════════ */

/** Rail nested-layer radii + highlight lines (TableFelt.tsx rail layers) */
export const railLayers = {
  /** [inset-2px layer radius, inset-6px layer radius] */
  innerRadiiMobile: [38, 35] as const,
  innerRadiiDesktop: [138, 134] as const,
  topHighlight: 'rgba(255,255,255,0.12)',
  bottomHighlight: 'rgba(255,255,255,0.04)',
  innerShadows: [{ depth: 12, alpha: 0.8 }] as const,
  /** inset-[2px] gradient overlay: white sheen → transparent → dark bottom */
  sheenStops: [
    { offset: 0, color: '#ffffff', opacity: 0.06 },
    { offset: 0.3, color: '#000000', opacity: 0 },
    { offset: 1, color: '#000000', opacity: 0.4 },
  ] as const,
  /** inset-[6px] hairline border */
  hairline: 'rgba(255,255,255,0.03)',
  /** inset 0 0 12px rgba(0,0,0,0.9) + inset 0 0 3px rgba(0,0,0,0.6) */
  innerRings: [
    { depth: 12, alpha: 0.9 },
    { depth: 3, alpha: 0.6 },
  ] as const,
} as const;

/** Felt spotlight + inset shadow layers (TableFelt.tsx felt layers) */
export const feltLayers = {
  spotlightMobile: { cx: 50, cy: 45, r: 50, color: '#4edea3', opacity: 0.05 },
  spotlightDesktop: { cx: 50, cy: 45, r: 55, color: '#4edea3', opacity: 0.06 },
  innerShadowsMobile: [
    { depth: 20, alpha: 0.45 },
    { depth: 15, alpha: 0.4 },
    { depth: 40, alpha: 0.2 },
  ] as const,
  innerShadowsDesktop: [
    { depth: 30, alpha: 0.6 },
    { depth: 8, alpha: 0.4 },
    { depth: 2, alpha: 0.5 },
    { depth: 80, alpha: 0.3 },
  ] as const,
} as const;

/** Card state extras (Card.tsx losing wrapper / back pattern detail) */
export const cardExtras = {
  bottomEdge: '#e5e7eb',
  bottomEdgeHeight: 4,
  backInnerBorder: 'rgba(255,255,255,0.1)',
  backBracket: 'rgba(255,255,255,0.15)',
  losingOpacity: 0.55,
  losingOverlay: 'rgba(0,0,0,0.35)',
  winGlowHaloWidth: 12,
} as const;

/** Premium metal chip body (AnimatedChip.tsx layers) */
export const chipBody = {
  rimStops: [
    { offset: 0, color: '#4a4a4a' },
    { offset: 0.4, color: '#1a1a1a' },
    { offset: 0.6, color: '#2a2a2a' },
    { offset: 1, color: '#0a0a0a' },
  ] as const,
  faceStops: [
    { offset: 0, color: '#222222' },
    { offset: 0.8, color: '#000000' },
  ] as const,
  ringColors: ['#0a0a0a', '#cfcfcf', '#333333'] as const,
  innerRing: 'rgba(255,255,255,0.1)',
  gloss: 'rgba(255,255,255,0.35)',
} as const;

/** Raise slider track/thumb (RaiseSlider.tsx custom track CSS) */
export const slider = {
  trackHeight: 6,
  trackColor: 'rgba(255,255,255,0.1)',
  thumbSize: 20,
  thumbBorder: 'rgba(255,255,255,0.2)',
  thumbStops: ['#ffffff', '#8b8b8b', '#1a1a1a'] as const,
  thumbActiveScale: 1.15,
  activeRing: 'rgba(78,222,163,0.2)',
  activeRingWidth: 6,
  tickIntervalMs: 80,
} as const;

/** Timer bar ramp (TimerBar.tsx interpolateColor) */
export const timer = {
  height: 4,
  trackColor: 'rgba(255,255,255,0.1)',
  criticalThreshold: 20,
  green: '#4edea3',
  amber: '#fbbf24',
  red: '#ff003c',
  glowOpacity: 0.35,
  inactiveOpacity: 0.4,
} as const;

/** Table badges (Badge.tsx) */
export const badges = {
  dealerGradient: ['#facc15', '#d97706'] as const,
  dealerText: '#000000',
  coGradient: ['#6b7280', '#374151'] as const,
  coText: '#ffffff',
  defaultBg: 'rgba(198,198,207,0.2)',
} as const;

/** Rank tier text colors (RankTierBadge.tsx tailwind palette) */
export const rankTierColors = {
  brick: '#92400e',
  bronze: '#d97706',
  silver: '#d1d5db',
  gold: '#facc15',
  platinum: '#67e8f9',
  diamond: '#93c5fd',
  maestro: '#c084fc',
  legend: '#eab308',
} as const;

/** Glass hub material (index.css .glass-hub + GlassHub.tsx) */
export const glassHub = {
  bg: 'rgba(10,10,10,0.85)',
  border: 'rgba(255,255,255,0.1)',
  borderTop: 'rgba(255,255,255,0.15)',
  activeBorder: 'rgba(78,222,163,0.6)',
  shadow: 'rgba(0,0,0,0.8)',
  activeGlow: 'rgba(78,222,163,0.3)',
  radius: 16,
} as const;

/** Player avatar ring/fallback (PlayerAvatar.tsx) */
export const avatar = {
  ring: 'rgba(78,222,163,0.2)',
  ringWidth: 2,
  border: 'rgba(78,222,163,0.5)',
  fallbackBg: '#1f1f1f',
  fallbackText: '#e2e2e2',
  /** RN has no grayscale image filter — approximate PWA `grayscale` class */
  imageOpacity: 0.85,
} as const;
