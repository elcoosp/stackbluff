module.exports = (api) => {
  api.cache(true);
  return {
    presets: [['babel-preset-expo'], ['nativewind/babel', {}]],
    // babel-preset-expo auto-includes react-native-worklets/plugin for Reanimated 4 (SDK 58).
  };
};
