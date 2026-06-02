import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { CustomerInfo, PurchasesOffering } from 'react-native-purchases';
import { getRevenueCatEntitlementId, getRevenueCatOfferingIdentifier } from '../lib/env';

const ENTITLEMENT_PREMIUM = getRevenueCatEntitlementId();

/** RC dashboard may use `premium` or `Grant Access Pro` — treat both as premium. */
const PREMIUM_ENTITLEMENT_KEYS = [
  ENTITLEMENT_PREMIUM,
  'Grant Access Pro',
  'premium',
].filter((k, i, arr) => arr.indexOf(k) === i);

function getRevenueCatKeysForPlatform(): { ios: string; android: string } {
  const fromEnvIos = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS?.trim() ?? '';
  const fromEnvAndroid = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID?.trim() ?? '';
  const expoConfig = Constants.expoConfig as Record<string, unknown> | null | undefined;
  const extra = expoConfig?.extra as Record<string, unknown> | undefined;
  const fromExtraIos =
    typeof extra?.revenueCatApiKeyIos === 'string' ? extra.revenueCatApiKeyIos.trim() : '';
  const fromExtraAndroid =
    typeof extra?.revenueCatApiKeyAndroid === 'string' ? extra.revenueCatApiKeyAndroid.trim() : '';
  return {
    ios: fromEnvIos || fromExtraIos,
    android: fromEnvAndroid || fromExtraAndroid,
  };
}

function isExpoGo(): boolean {
  return (
    Constants.appOwnership === 'expo' ||
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  );
}

type PurchasesModule = typeof import('react-native-purchases').default;

/** True after `Purchases.configure` succeeded — RevenueCatUI asserts if paywall runs before this. */
let purchasesSdkConfigured = false;

/**
 * Never `import` Purchases at module scope — that loads the native module and breaks **Expo Go**.
 */
function tryPurchases(): PurchasesModule | null {
  if (isExpoGo()) return null;
  try {
    return require('react-native-purchases').default as PurchasesModule;
  } catch {
    return null;
  }
}

export function isRevenueCatSdkConfigured(): boolean {
  return purchasesSdkConfigured;
}

/**
 * Configures the native Purchases SDK. Safe to call multiple times — configures once, then no-ops.
 * @returns whether the SDK is ready for `getCustomerInfo` / RevenueCat UI (false in Expo Go or missing API key / configure error).
 */
export async function initRevenueCat(): Promise<boolean> {
  if (purchasesSdkConfigured) return true;
  const Purchases = tryPurchases();
  if (!Purchases) return false;
  const { ios, android } = getRevenueCatKeysForPlatform();
  const key = Platform.OS === 'ios' ? ios : android;
  if (!key) return false;
  try {
    Purchases.configure({ apiKey: key });
    purchasesSdkConfigured = true;
    return true;
  } catch (e) {
    if (__DEV__) console.warn('[RevenueCat] configure failed', e);
    return false;
  }
}

/**
 * Offering used by RevenueCat Paywall UI. Prefer `EXPO_PUBLIC_REVENUECAT_OFFERING_IDENTIFIER`
 * (RevenueCat **lookup key**, e.g. `Official Offering`); otherwise try that id; else dashboard **current**.
 *
 * Important: if the dashboard **current** offering still points at **Test Store** products while your
 * paywall design uses **App Store** SKUs, you must either mark the App Store offering as current **or**
 * set this env so `presentPaywall({ offering })` loads StoreKit prices for the right products.
 */
export async function fetchOfferingForPaywall(): Promise<PurchasesOffering | null> {
  const Purchases = tryPurchases();
  if (!Purchases) return null;
  const fromEnv = getRevenueCatOfferingIdentifier();
  const preferredKeys = [
    ...(fromEnv ? [fromEnv] : []),
    'Official Offering',
  ];
  try {
    const offerings = await Purchases.getOfferings();
    for (const key of preferredKeys) {
      const o = offerings.all[key];
      if (o) return o;
    }
    return offerings.current ?? null;
  } catch {
    return null;
  }
}

export async function fetchCustomerInfo(): Promise<CustomerInfo | null> {
  const Purchases = tryPurchases();
  if (!Purchases) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}

export function customerHasPremium(info: CustomerInfo | null): boolean {
  if (!info) return false;
  const active = info.entitlements.active;
  return PREMIUM_ENTITLEMENT_KEYS.some((key) => Boolean(active[key]));
}

export async function restorePurchases(): Promise<CustomerInfo | null> {
  const Purchases = tryPurchases();
  if (!Purchases) return null;
  try {
    return await Purchases.restorePurchases();
  } catch {
    return null;
  }
}

/**
 * Binds RevenueCat to the Supabase user id so App Store, Play, and Web Billing
 * share one customer record (required for single subscription across platforms).
 */
export async function identifyRevenueCatUser(appUserId: string | null): Promise<void> {
  const Purchases = tryPurchases();
  if (!Purchases) return;
  const ready = await initRevenueCat();
  if (!ready) return;
  try {
    if (!appUserId?.trim()) {
      await Purchases.logOut();
      return;
    }
    await Purchases.logIn(appUserId.trim());
  } catch (e) {
    if (__DEV__) console.warn('[RevenueCat] identify user failed', e);
  }
}

export { ENTITLEMENT_PREMIUM };
