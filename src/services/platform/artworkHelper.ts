import { getGlobalContext } from './index';

/**
 * Normalizes and converts track / album artwork URLs for cross-platform rendering.
 * On Android / Capacitor, converts native absolute file paths or file:// URIs
 * to webview-accessible URLs via Capacitor.convertFileSrc().
 */
export function getArtworkUrl(pathOrUri?: string): string | undefined {
  if (!pathOrUri || typeof pathOrUri !== 'string') return undefined;

  const trimmed = pathOrUri.trim();
  if (!trimmed) return undefined;

  // Base64 data URIs and remote HTTP/HTTPS assets render natively in WebViews
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  ) {
    return trimmed;
  }

  // Under Capacitor (Android native shell), convert local storage path to webview stream
  const ctx = getGlobalContext();
  if (ctx.Capacitor?.convertFileSrc) {
    try {
      return ctx.Capacitor.convertFileSrc(trimmed);
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}
