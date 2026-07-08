import { loadStripe } from '@stripe/stripe-js';

export const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

/**
 * Redirect to Stripe Checkout.
 * Uses the checkout URL from the backend, or constructs it from the session ID.
 *
 * Note: stripe.redirectToCheckout() is DEPRECATED and no longer works.
 * Modern approach: redirect to the Checkout Session URL directly.
 */
export function redirectToStripeCheckout(clientSecret: string, checkoutUrl?: string): void {
  // Prefer the URL from the backend
  if (checkoutUrl) {
    window.location.href = checkoutUrl;
    return;
  }

  // Fallback: construct URL from session ID
  // The session ID is the client_secret for Checkout Sessions
  const url = `https://checkout.stripe.com/c/pay/${clientSecret}`;
  window.location.href = url;
}
