/// <reference types="jest" />
/**
 * Pulls in @types/jest (already a dependency of @stackbluff/mobile) so the
 * jest globals (describe / it / expect) typecheck under
 * `pnpm --filter @stackbluff/mobile check`. A triple-slash reference is used
 * instead of a "types" tsconfig entry because the expo/tsconfig.base is shared
 * and must not be edited for test tooling.
 */
