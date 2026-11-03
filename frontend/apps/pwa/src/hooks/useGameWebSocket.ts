import { configureGameWebSocketBridge } from '@stackbluff/shared/hooks/gameWebSocketBridge';
import { toast } from 'sonner';
import { generateAndSubmitFingerprint } from '@/services/fingerprint';
import { UserUpdatedPayloadSchema } from '../lib/wsMessages';
import { useAuthStore } from '../stores/authStore';
import { useEntitlementsStore } from '../stores/entitlementsStore';

// The game websocket hook moved to @stackbluff/shared (RN surface refactor,
// see docs/mobile-plan/contracts/shared-rn-surface.md). Its PWA-hosted
// integrations — sonner toasts, device fingerprinting, the user.updated zod
// schema, the pwa auth/entitlements stores, and the VITE_WS_URL build env —
// are injected here. Every PWA consumer imports the hook through this module,
// so the bridge is always configured before the hook is used.
configureGameWebSocketBridge({
  toast,
  wsBaseUrl: () =>
    import.meta.env.VITE_WS_URL ||
    `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`,
  submitFingerprint: (token) => generateAndSubmitFingerprint(token),
  userUpdatedSchema: UserUpdatedPayloadSchema,
  authStore: useAuthStore,
  entitlementsStore: useEntitlementsStore,
});

export { useGameWebSocket } from '@stackbluff/shared';
