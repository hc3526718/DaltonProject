import { Linking, Platform } from 'react-native';
import { getDaltonWebUrl } from './env';

export type LegalPagePath =
  | '/terms'
  | '/privacy'
  | '/athlete-agreement'
  | '/cookies'
  | '/cookie-policy';

export function legalPageUrl(path: LegalPagePath): string {
  const normalized = path === '/cookies' ? '/cookie-policy' : path;
  const base = getDaltonWebUrl().replace(/\/$/, '');
  if (!base) return '';
  return `${base}${normalized}`;
}

export async function openLegalPage(path: LegalPagePath): Promise<boolean> {
  const url = legalPageUrl(path);
  if (!url) return false;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  }
  await Linking.openURL(url);
  return true;
}
