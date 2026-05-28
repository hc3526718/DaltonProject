import { Linking, Platform } from 'react-native';
import { getDaltonWebUrl } from './env';

/** Marketing homepage (static site root). On web at /app, uses site origin. */
export function getMarketingLandingUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const { origin, pathname } = window.location;
    if (pathname.startsWith('/app')) {
      return `${origin}/`;
    }
    return origin.endsWith('/') ? origin.slice(0, -1) : origin;
  }
  const base = getDaltonWebUrl().replace(/\/$/, '');
  return base || '/';
}

export function openMarketingLanding(): void {
  const url = getMarketingLandingUrl();
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (url.startsWith('http')) {
      window.location.href = url.endsWith('/') ? url : `${url}/`;
    } else {
      window.location.href = '/';
    }
    return;
  }
  if (url.startsWith('http')) {
    void Linking.openURL(url);
  }
}
