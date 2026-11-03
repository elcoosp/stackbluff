/**
 * Ambient globals used by the native services layer.
 *
 * `process.env` is typed via `@types/node` (hoisted at the workspace root).
 * React Native 0.88 no longer ships its own TypeScript declarations, so the
 * classic `__DEV__` global must be declared here. If a future dependency
 * starts declaring it, remove this file's declaration to avoid a clash.
 */
declare const __DEV__: boolean;
