export function getPaymentProvider(): 'stripe' | 'telegram_stars' {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    return 'telegram_stars';
  }
  return 'stripe';
}

export function isMiniApp(): boolean {
  return getPaymentProvider() === 'telegram_stars';
}
