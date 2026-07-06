import { useCallback } from 'react';

export interface TelegramInvoiceResult {
  status: 'paid' | 'cancelled' | 'failed' | string;
}

export function useTelegramWebApp() {
  const openInvoice = useCallback(
    (url: string, onResult: (result: TelegramInvoiceResult) => void): boolean => {
      const tg = window.Telegram?.WebApp;
      if (!tg?.openInvoice) return false;

      tg.openInvoice(url, (status) => {
        onResult({ status });
      });
      return true;
    },
    []
  );

  return { openInvoice };
}
