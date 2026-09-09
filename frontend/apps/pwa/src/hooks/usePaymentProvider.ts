import { useSyncExternalStore } from 'react';

function getProvider(): 'stripe' | 'telegram_stars' {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    return 'telegram_stars';
  }
  return 'stripe';
}

function getIsMiniApp(): boolean {
  return getProvider() === 'telegram_stars';
}

export function usePaymentProvider(): 'stripe' | 'telegram_stars' {
  return useSyncExternalStore(
    () => () => {},
    getProvider,
    () => 'stripe',
  );
}

export function useIsMiniApp(): boolean {
  return useSyncExternalStore(
    () => () => {},
    getIsMiniApp,
    () => false,
  );
}
