import type {
  PaymentRequest,
  PaymentResult,
  PlatformAPI,
  PlatformUser,
  ShareContent,
} from './types';

export class PwaPlatform implements PlatformAPI {
  async getUser(): Promise<PlatformUser> {
    return {
      id: 'pwa-user-1',
      name: 'PWA Player',
      isTelegram: false,
    };
  }

  async sendPayment(request: PaymentRequest): Promise<PaymentResult> {
    console.warn('Payment not implemented in PWA', request);
    return { success: false, error: 'Payment not available in PWA' };
  }

  async shareContent(content: ShareContent): Promise<boolean> {
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
    return false;
  }
}
