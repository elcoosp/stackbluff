declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        openInvoice: (url: string, callback: (status: 'paid' | 'cancelled' | 'failed' | string) => void) => void;
        ready: () => void;
        expand: () => void;
        platform: string;
      };
    };
  }
}

export {};
