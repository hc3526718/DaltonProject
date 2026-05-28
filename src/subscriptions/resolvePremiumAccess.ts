import { Platform } from 'react-native';
import {
  customerHasPremium,
  fetchCustomerInfo,
  initRevenueCat,
} from './revenueCat';
import {
  fetchSubscriptionStateIsPro,
  fetchSubscriptionStatePaymentVerified,
} from './subscriptionStateService';

/**
 * Premium resolution order:
 * 1. `subscription_state.is_pro` from Supabase (written by Stripe / RevenueCat webhooks).
 * 2. On native, RevenueCat SDK when DB has no row yet.
 * 3. On web, DB only (Stripe Checkout + webhook).
 */
export async function resolvePremiumAccess(): Promise<boolean> {
  const dbPro = await fetchSubscriptionStateIsPro();
  if (dbPro === true) return true;

  if (Platform.OS === 'web') {
    return dbPro === true;
  }

  await initRevenueCat();
  const info = await fetchCustomerInfo();
  const rcPro = customerHasPremium(info);
  if (rcPro) return true;

  if (dbPro === false) return false;
  return rcPro;
}

/** Mandatory academy access (£2/mo) — uses `is_payment_verified` on Supabase. */
export async function resolvePaymentVerifiedAccess(): Promise<boolean> {
  const dbPaid = await fetchSubscriptionStatePaymentVerified();
  if (dbPaid === true) return true;

  if (Platform.OS === 'web') {
    return dbPaid === true;
  }

  await initRevenueCat();
  const info = await fetchCustomerInfo();
  const rcPro = customerHasPremium(info);
  if (rcPro) return true;

  if (dbPaid === false) return false;
  return rcPro;
}
