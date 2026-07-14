export default {
  locales: ["en", "fr", "es"],
  sourceLocale: "en",
  catalogs: [
    {
      path: "src/locales/{locale}/messages",
      include: ["src"],
      exclude: ["**/node_modules/**"],
    },
  ],
  compileNamespace: "es",  // Use ES modules for Vite
  fallbackLocales: {
    default: "en",
  },
};
