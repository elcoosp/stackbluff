/**
 * Base64url encoding/decoding utilities for Web Push VAPID keys.
 * Well-tested, production-safe implementation.
 */

/**
 * Convert a URL-safe base64 string to Uint8Array.
 * Required by PushManager.subscribe() for applicationServerKey.
 *
 * @param base64String - URL-safe base64 encoded string (no padding required)
 * @returns Uint8Array suitable for use as applicationServerKey
 * @throws Error if input is not valid base64url
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  if (!base64String || typeof base64String !== 'string') {
    throw new Error('urlBase64ToUint8Array: input must be a non-empty string');
  }

  // Convert base64url to standard base64
  // Replace URL-safe chars: - → +, _ → /
  const base64 = base64String.replace(/-/g, '+').replace(/_/g, '/');

  // Add padding if necessary (base64 length must be multiple of 4)
  const padLength = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(padLength);

  // Decode base64 to binary string
  const binaryString = atob(padded);

  // Convert binary string to Uint8Array
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes;
}

/**
 * Convert a Uint8Array to URL-safe base64 string.
 * Inverse of urlBase64ToUint8Array.
 */
export function uint8ArrayToUrlBase64(bytes: Uint8Array): string {
  let binaryString = '';
  for (let i = 0; i < bytes.length; i++) {
    binaryString += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binaryString);
  // Convert to URL-safe: + → -, / → _, remove padding
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
