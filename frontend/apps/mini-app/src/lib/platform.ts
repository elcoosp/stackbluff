export const PlatformAPI = {
  backButton: {
    show: () => {
      if (window.Telegram?.WebApp?.BackButton) {
        window.Telegram.WebApp.BackButton.show();
      }
    },
    hide: () => {
      if (window.Telegram?.WebApp?.BackButton) {
        window.Telegram.WebApp.BackButton.hide();
      }
    },
    onClick: (callback: () => void) => {
      if (window.Telegram?.WebApp?.BackButton) {
        window.Telegram.WebApp.BackButton.onClick(callback);
      } else {
        window.addEventListener('popstate', callback);
      }
    },
  },
  close: () => {
    if (window.Telegram?.WebApp?.close) {
      window.Telegram.WebApp.close();
    } else {
      window.close();
    }
  },
};

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        BackButton: { show(): void; hide(): void; onClick(cb: () => void): void };
        close(): void;
      };
    };
  }
}
