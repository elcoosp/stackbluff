import type {
  PaymentRequest,
  PaymentResult,
  PlatformAPI,
  PlatformUser,
  ShareContent,
} from './types';

;
        };
        sendData(data: string): void;
        shareToStory?(mediaUrl: string, options?: unknown): void;
        HapticFeedback: {
          impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
        };
      };
    };
  }
}

export class TelegramPlatform implements PlatformAPI {
  constructor() {
    if (this.isInApp()) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
  }

  async getUser(): Promise<PlatformUser> {
    const webApp = window.Telegram?.WebApp;
    const userData = webApp?.initDataUnsafe?.user;
    if (userData) {
      return {
        id: String(userData.id),
        name: userData.first_name || userData.username || 'Telegram User',
        avatarUrl: userData.photo_url,
        isTelegram: true,
      };
    }
    return {
      id: 'telegram-dev-user',
      name: 'Dev User',
      isTelegram: false,
    };
  }

  async sendPayment(request: PaymentRequest): Promise<PaymentResult> {
    console.warn('Payment not implemented in Telegram Mini App', request);
    return { success: false, error: 'Payment not available' };
  }

  async shareContent(content: ShareContent): Promise<boolean> {
    if (window.Telegram?.WebApp?.shareToStory) {
      window.Telegram.WebApp.shareToStory(content.url || window.location.href);
      return true;
    }
    if (navigator.share) {
      try {
        await navigator.share({
          title: content.title,
          text: content.text,
          url: content.url,
        });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  isInApp(): boolean {
    return !!window.Telegram?.WebApp;
  }
}
