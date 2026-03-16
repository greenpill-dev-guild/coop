/**
 * Validates that a URL uses a safe protocol (http or https) before rendering it as an href.
 * Prevents javascript:, data:, blob:, and other potentially dangerous URL schemes.
 */
export function isSafeExternalUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
