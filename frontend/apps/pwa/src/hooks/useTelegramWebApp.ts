import { useCallback } from 'react';

export interface TelegramInvoiceResult {
  status: 'paid' | 'cancelled' | 'failed' | string;
}

interface TelegramWebAppWithInvoice {
  openInvoice?: (url: string, callback: (status: string) => void) => void;
}

export function useTelegramWebApp() {
  const openInvoice = useCallback(
    (url: string, onResult: (result: TelegramInvoiceResult) => void): boolean => {
      const tg = window.Telegram?.WebApp as TelegramWebAppWithInvoice | undefined;
      if (!tg || typeof tg.openInvoice !== 'function') return false;

      tg.openInvoice(url, (status: string) => {
        onResult({ status });
      });
      return true;
    },
    [],
  );

  return { openInvoice };
}
// Uses window.Telegram from global declaration in shared package
