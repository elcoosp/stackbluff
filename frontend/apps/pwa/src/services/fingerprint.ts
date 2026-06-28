/**
 * Device fingerprinting service for anti‑cheat collusion detection.
 * Collects browser/device characteristics, hashes them using SHA‑256,
 * and sends the hash to the backend on login and before game sessions.
 */

// Components to include in fingerprint
export async function collectFingerprintComponents(): Promise<string> {
  const components: string[] = [];

  // Screen resolution
  components.push(`${window.screen.width}x${window.screen.height}`);

  // Timezone
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Platform
  components.push(navigator.platform);

  // Language
  components.push(navigator.language);

  // User agent
  components.push(navigator.userAgent);

  // WebGL vendor and renderer (if available)
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        components.push(`webgl_vendor:${vendor}`);
        components.push(`webgl_renderer:${renderer}`);
      }
    }
  } catch (_) {
    // ignore WebGL errors
  }

  // Fonts (async, with timeout)
  try {
    const fontList = await Promise.race([
      document.fonts.ready.then(() => {
        const fonts: string[] = [];
        for (const font of document.fonts.values()) {
          fonts.push(font.family);
        }
        return fonts;
      }),
      new Promise<string[]>((_, reject) => setTimeout(() => reject(new Error('Font loading timeout')), 500))
    ]);
    components.push(`fonts:${fontList.join(',')}`);
  } catch (_) {
    // fallback: no fonts
    components.push('fonts:');
  }

  return components.join('|');
}

/**
 * Hash the concatenated components using SHA‑256.
 */
export async function hashFingerprint(components: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(components);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Send the fingerprint hash to the backend.
 * Call this on login and before each game session.
 */
export async function submitFingerprint(hash: string): Promise<void> {
  const response = await fetch('/anti-cheat/fingerprint', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
    },
    body: JSON.stringify({ fingerprint_hash: hash }),
  });
  if (!response.ok) {
    console.error('Failed to submit fingerprint:', response.status);
  }
}

/**
 * Generate and submit fingerprint. Use this as a one‑stop function.
 */
export async function generateAndSubmitFingerprint(): Promise<void> {
  const components = await collectFingerprintComponents();
  const hash = await hashFingerprint(components);
  await submitFingerprint(hash);
}
