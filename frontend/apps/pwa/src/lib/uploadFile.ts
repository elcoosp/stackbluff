import { getToken } from '@stackbluff/shared/auth/token';

/**
 * Upload a file to the CDN and return the URL
 * For MVP, we'll use a simple endpoint that accepts multipart/form-data
 */
export async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch('/api/upload', {
    method: 'POST',
    headers,
    body: formData,
    credentials: 'include',
  });

  if (!response.ok) {
    const text = await response.text();
    try {
      const error = JSON.parse(text);
      throw new Error(error.error || error.message || 'Upload failed');
    } catch {
      throw new Error(`Upload failed: HTTP ${response.status}`);
    }
  }

  const data = await response.json();
  return data.url;
}
