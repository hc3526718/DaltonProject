/**
 * Optional **development-only** credential bypass when Supabase env is unavailable.
 * Passwords MUST come from `.env` (`EXPO_PUBLIC_DEV_DEMO_*`) — nothing secret is bundled in release.
 */

export const PREMIUM_DEMO_EMAIL = 'dalton.media.admin@dalton.test';
export const DEMO_EMAIL = 'user123@gmail.com';

export function isPremiumDemoEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === PREMIUM_DEMO_EMAIL.toLowerCase();
}

/** Legacy demo — only when Supabase missing and env password set (dev tooling). */
export function getDevDemoLegacyPassword(): string {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return '';
  return (process.env.EXPO_PUBLIC_DEV_DEMO_LEGACY_PASSWORD ?? '').trim();
}

/** Premium demo — only when Supabase missing and env password set (dev tooling). */
export function getDevDemoPremiumPassword(): string {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return '';
  return (process.env.EXPO_PUBLIC_DEV_DEMO_PREMIUM_PASSWORD ?? '').trim();
}
