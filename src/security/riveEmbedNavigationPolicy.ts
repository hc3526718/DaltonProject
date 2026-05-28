/**
 * Boot Rive embed WebView — allow HTTPS plus in-page schemes Rive uses (`blob:`, `data:`).
 * Blocks `javascript:`, `file:`, etc.
 */
export function isAllowedRiveBootEmbedNavigation(url: string): boolean {
  if (!url || url.startsWith('about:')) return true;
  if (url.startsWith('blob:') || url.startsWith('data:')) return true;
  if (url.startsWith('wss://')) return true;
  return url.startsWith('https://');
}
