/**
 * Paywall / entitlement framing — uses live `react-native-purchases` helpers where configured.
 */
import { customerHasPremium, ENTITLEMENT_PREMIUM, fetchCustomerInfo } from '../subscriptions/revenueCat';
import type { CustomerInfo } from 'react-native-purchases';
import type { AppUser } from '../auth/AuthContext';
import { canCreateVerifiedContent } from '../creator/creatorAccess';

export { ENTITLEMENT_PREMIUM };

export async function loadPremiumState(): Promise<boolean> {
  const info = await fetchCustomerInfo();
  return customerHasPremium(info);
}

/** Creator paywall: premium entitlement or admin bypass. */
export function canUseCreatorTools(isPro: boolean, user: AppUser | null): boolean {
  return canCreateVerifiedContent(isPro, user);
}

/** Sponsorship: never post directly to sponsor feed — submissions only (see `sponsorshipService`). */
export function canPublishSponsorPostFromApp(): boolean {
  return false;
}

export type PaywallContext = {
  customerInfo: CustomerInfo | null;
  isPro: boolean;
};
