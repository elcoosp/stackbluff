import { useCallback } from 'react';

export interface TelegramInvoiceResult {
  status: 'paid' | 'cancelled' | 'failed' | string;
}

export function useTelegramWebApp() {
  const openInvoice = useCallback(
    (url: string, onResult: (result: TelegramInvoiceResult) => void): boolean => {
      const tg = window.Telegram?.WebApp;
      if (!tg || typeof tg.openInvoice !== 'function') return false;

      tg.openInvoice(url, (status) => {
        onResult({ status });
      });
      return true;
    },
    []
  );

  return { openInvoice };
}
// Uses window.Telegram from global declaration in shared package
