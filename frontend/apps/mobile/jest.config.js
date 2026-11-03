/**
 * Jest config for @stackbluff/mobile (Expo SDK 58 / jest-expo, Jest 30).
 *
 * - Preset `jest-expo` provides the RN test environment, asset stubs, TS mapping
 *   and babel (babel-preset-expo + nativewind) wiring.
 * - transformIgnorePatterns follows the Expo docs pattern and extends the list
 *   shipped in node_modules/jest-expo/jest-preset.js with the packages this app
 *   depends on that ship untranspiled ESM/flow: nativewind, react-native-css-interop,
 *   @tanstack/*, zustand. The leading `.pnpm` alternative keeps pnpm-style
 *   `node_modules/.pnpm/<pkg>/node_modules/<pkg>` paths transformable (important
 *   because jest resolves symlinked deps to their real path).
 * - Tests live in `<rootDir>/__tests__` and are intentionally pure-logic
 *   (no react-native / expo imports) so CI runs green without simulators.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  preset: 'jest-expo',
  testMatch: [
    '<rootDir>/__tests__/**/*.spec.ts',
    '<rootDir>/__tests__/**/*.spec.tsx',
    '<rootDir>/__tests__/**/*.test.ts',
    '<rootDir>/__tests__/**/*.test.tsx',
  ],
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|nativewind|react-native-css-interop|@tanstack|zustand))',
    // Disable transforming the reanimated plugin in multi-platform tests, causing
    // "Reentrant plugin detected trying to load react-native-reanimated/plugin.."
    '/node_modules/react-native-reanimated/plugin/',
    // The react-native babel preset is part of the transformer itself.
    '/node_modules/@react-native/babel-preset/',
  ],
};
