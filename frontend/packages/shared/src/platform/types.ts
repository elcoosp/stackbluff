export interface PlatformUser {
  id: string;
  name: string;
  avatarUrl?: string;
  isTelegram?: boolean;
}

export interface PaymentRequest {
  amount: number;
  currency: string;
  description: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export interface ShareContent {
  title: string;
  text?: string;
  url?: string;
}

export interface PlatformAPI {
  getUser(): Promise<PlatformUser>;
  sendPayment(request: PaymentRequest): Promise<PaymentResult>;
  shareContent(content: ShareContent): Promise<boolean>;
  isInApp(): boolean;
}
