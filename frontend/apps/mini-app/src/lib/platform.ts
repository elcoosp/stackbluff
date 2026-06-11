type BackButtonCallback = () => void;

export interface PlatformService {
  backButton: {
    show(): void;
    hide(): void;
    onClick(cb: BackButtonCallback): () => void;
  };
  close(): void;
}

class TelegramPlatform implements PlatformService {
  private boundHandler: (() => void) | null = null;

  backButton = {
    show: () => {
      window.Telegram?.WebApp?.BackButton.show();
    },
    hide: () => {
      window.Telegram?.WebApp?.BackButton.hide();
    },
    onClick: (cb: BackButtonCallback): (() => void) => {
      this.currentCallback = cb;
      if (window.Telegram?.WebApp?.BackButton) {
        this.boundHandler = () => cb();
        window.Telegram.WebApp.BackButton.onClick(this.boundHandler);
        return () => {
          if (this.boundHandler) {
            window.Telegram.WebApp.BackButton.offClick(this.boundHandler);
          }
        };
      } else {
        const handler = () => cb();
        window.addEventListener('popstate', handler);
        return () => window.removeEventListener('popstate', handler);
      }
    },
  };

  close = () => {
    if (window.Telegram?.WebApp?.close) {
      window.Telegram.WebApp.close();
    } else {
      window.close();
    }
  };
}

class PwaPlatform implements PlatformService {
  backButton = {
    show: () => {},
    hide: () => {},
    onClick: (cb: BackButtonCallback): (() => void) => {
      const handler = () => cb();
      window.addEventListener('popstate', handler);
      return () => window.removeEventListener('popstate', handler);
    },
  };
  close = () => {
    window.close();
  };
}

let platformInstance: PlatformService | null = null;

export function getPlatform(): PlatformService {
  if (platformInstance) return platformInstance;
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    platformInstance = new TelegramPlatform();
  } else {
    platformInstance = new PwaPlatform();
  }
  return platformInstance;
}

export function setPlatform(platform: PlatformService) {
  platformInstance = platform;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        BackButton: {
          show(): void;
          hide(): void;
          onClick(cb: () => void): void;
          offClick(cb: () => void): void;
        };
        close(): void;
      };
    };
  }
}
