/**
 * Device fingerprinting service for anti‑cheat collusion detection.
 * Collects stable browser/device characteristics, hashes them using SHA‑256,
 * and sends the hash to the backend on login and before game sessions.
 */

// Components to include in fingerprint (all synchronous and deterministic)
export function collectFingerprintComponents(): string {
  const components: string[] = [];

  components.push(`${window.screen.width}x${window.screen.height}`);
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
  components.push(navigator.platform);
  components.push(navigator.language);
  components.push(navigator.userAgent);

  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl && 'getExtension' in gl && 'getParameter' in gl) {
      const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const vendor = (gl as any).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        const renderer = (gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        components.push(`webgl_vendor:${vendor}`);
        components.push(`webgl_renderer:${renderer}`);
      }
    }
  } catch (_) { /* ignore */ }

  // Fonts are omitted for consistency (async issues).
  return components.join('|');
}

export async function hashFingerprint(components: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(components);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function submitFingerprint(hash: string, token: string): Promise<void> {
  const response = await fetch('/anti-cheat/fingerprint', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ fingerprint_hash: hash }),
  });
  if (!response.ok) {
    console.error('Failed to submit fingerprint:', response.status);
  }
}

/**
 * Generate and submit fingerprint.
 * @param token Authentication token (passed from caller).
 */
export async function generateAndSubmitFingerprint(token: string): Promise<void> {
  const components = collectFingerprintComponents();
  const hash = await hashFingerprint(components);
  await submitFingerprint(hash, token);
}
