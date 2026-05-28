import type { AppUser } from '../auth/AuthContext';
import { isPremiumDemoEmail } from '../auth/demoAccounts';

/** Dalton Academy master / staff roles that bypass the mandatory access subscription. */
export function isAccessExemptUser(user: AppUser | null, sessionEmail?: string | null): boolean {
  if (!user) return false;
  if (user.id.startsWith('demo-')) return true;
  if (user.masterControl) return true;
  if (user.role === 'admin' || user.role === 'super_admin') return true;
  if (sessionEmail && isPremiumDemoEmail(sessionEmail)) return true;
  return false;
}

/** Mandatory £2/mo academy access — requires `subscription_state.is_payment_verified`. */
export function hasAppAccess(
  user: AppUser | null,
  isPaymentVerified: boolean,
  sessionEmail?: string | null,
): boolean {
  if (isAccessExemptUser(user, sessionEmail)) return true;
  return isPaymentVerified;
}
