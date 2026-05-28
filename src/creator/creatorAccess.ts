import type { AppUser } from '../auth/AuthContext';

/**
 * Creator tools (events, media uploads, sponsor proposals) — master control only for launch.
 * Premium / Dalton verification gates are paused; re-enable in `creatorAccess` when ready.
 */
export function canCreateVerifiedContent(_isPro: boolean, user: AppUser | null): boolean {
  if (!user) return false;
  if (user.masterControl) return true;
  if (user.role === 'admin' || user.role === 'super_admin') return true;
  return false;
}
