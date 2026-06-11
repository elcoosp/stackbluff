import { PwaPlatform } from './pwa';
import { TelegramPlatform } from './telegram';
import type { PlatformAPI } from './types';

let platformInstance: PlatformAPI | null = null;

export function getPlatform(): PlatformAPI {
  if (!platformInstance) {
    const isTelegram = typeof window !== 'undefined' && !!window.Telegram?.WebApp;
    platformInstance = isTelegram ? new TelegramPlatform() : new PwaPlatform();
  }
  return platformInstance;
}

export * from './types';
export { PwaPlatform, TelegramPlatform };
