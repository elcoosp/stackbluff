/**
 * StackBluff Mobile — Tailwind theme (NativeWind 4 / Tailwind 3).
 * Values mirror @stackbluff/ui-native tokens.ts (source: packages/shared/src/theme.css).
 * A test by Agent-07 asserts tokens.ts stays in sync with this file.
 */
const tokens = require('./tailwind.tokens.cjs');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/screens/**/*.{ts,tsx}',
    './src/hooks/**/*.{ts,tsx}',
    '../../packages/ui-native/src/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: tokens.colors,
      borderRadius: tokens.radii,
      fontFamily: tokens.fonts,
      fontSize: tokens.fontSizes,
    },
  },
  plugins: [],
};
