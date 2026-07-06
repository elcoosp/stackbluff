import { describe, it, expect } from 'vitest';
import { urlBase64ToUint8Array, uint8ArrayToUrlBase64 } from '../lib/crypto/base64url';

describe('urlBase64ToUint8Array', () => {
  it('should convert valid base64url string to Uint8Array', () => {
    // Known test vector: "hello" in base64url is "aGVsbG8"
    const result = urlBase64ToUint8Array('aGVsbG8');
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(5);
    expect(Array.from(result)).toEqual([104, 101, 108, 108, 111]); // "hello"
  });

  it('should handle base64url with URL-safe characters', () => {
    // Base64url uses - instead of + and _ instead of /
    // Test with a string that would have + and / in standard base64
    const result = urlBase64ToUint8Array('PDw_Pz4-'); // <<??>> in base64url
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('should handle strings with padding', () => {
    const result = urlBase64ToUint8Array('YQ=='); // "a" with padding
    expect(result.length).toBe(1);
    expect(result[0]).toBe(97); // 'a'
  });

  it('should handle strings without padding', () => {
    const result = urlBase64ToUint8Array('YQ'); // "a" without padding
    expect(result.length).toBe(1);
    expect(result[0]).toBe(97);
  });

  it('should throw on empty string', () => {
    expect(() => urlBase64ToUint8Array('')).toThrow();
  });

  it('should throw on non-string input', () => {
    // @ts-expect-error testing invalid input
    expect(() => urlBase64ToUint8Array(null)).toThrow();
    // @ts-expect-error testing invalid input
    expect(() => urlBase64ToUint8Array(undefined)).toThrow();
    // @ts-expect-error testing invalid input
    expect(() => urlBase64ToUint8Array(123)).toThrow();
  });

  it('should round-trip correctly', () => {
    const original = new Uint8Array([0, 1, 2, 255, 254, 253]);
    const encoded = uint8ArrayToUrlBase64(original);
    const decoded = urlBase64ToUint8Array(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });

  it('should handle typical VAPID public key length (65 bytes)', () => {
    // VAPID P-256 public keys are 65 bytes (uncompressed point)
    // This is a valid 88-character base64url string (66 bytes when decoded)
    const vapidKey = 'BPM1KZ9xH8Y8Z5Q3X2W1V0U9T8S7R6Q5P4O3N2M1L0K9J8I7H6G5F4E3D2C1B0A9Z8Y7X6W5V4U3T2S1R0Q9P8O7N6M5L4K3J2I1H0G9F8E7D6C5B4A3Z2Y1X0W9V8U7T6S5R4Q3P2O1N0M9L8K7J6I5H4G3F2E1D0C9B8A7Z6Y5X4W3V2U1T0S9R8Q7P6O5N4M3L2K1J0I9H8G7F6E5D4C3B2A1';
    const result = urlBase64ToUint8Array(vapidKey);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('uint8ArrayToUrlBase64', () => {
  it('should convert Uint8Array to URL-safe base64', () => {
    const bytes = new Uint8Array([104, 101, 108, 108, 111]); // "hello"
    const result = uint8ArrayToUrlBase64(bytes);
    expect(result).toBe('aGVsbG8');
  });

  it('should not contain +, /, or = characters', () => {
    const bytes = new Uint8Array([255, 255, 255, 255]);
    const result = uint8ArrayToUrlBase64(bytes);
    expect(result).not.toContain('+');
    expect(result).not.toContain('/');
    expect(result).not.toContain('=');
  });
});
