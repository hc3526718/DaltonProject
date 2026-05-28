import { Alert } from 'react-native';
import type RevenueCatUIDefault from 'react-native-purchases-ui';
import {
  customerHasPremium,
  fetchCustomerInfo,
  fetchOfferingForPaywall,
  initRevenueCat,
} from './revenueCat';

/** `react-native-purchases-ui` exports `RevenueCatUI` as default — CommonJS `require` is `{ default }`, not `{ RevenueCatUI }`. */
function getRevenueCatUI(): typeof RevenueCatUIDefault | null {
  try {
    const ui = require('react-native-purchases-ui') as {
      default?: typeof RevenueCatUIDefault;
      RevenueCatUI?: typeof RevenueCatUIDefault;
    };
    return ui.default ?? ui.RevenueCatUI ?? null;
  } catch {
    return null;
  }
}

export type PresentPaywallResult = {
  /** User dismissed paywall without error (native sheet may still cancel purchase). */
  presentedOk: boolean;
  /** Premium entitlement became active after the sheet closed (purchase or restore from sheet). */
  premiumActivated: boolean;
};

/**
 * Presents RevenueCat Paywall UI from the **react-native-purchases-ui** package (already in package.json).
 *
 * - **Offering**: Passes the offering from `fetchOfferingForPaywall()` so prices match **App Store**
 *   products (not the dashboard **current** offering if that still points at Test Store). Override with
 *   `EXPO_PUBLIC_REVENUECAT_OFFERING_IDENTIFIER` (lookup key).
 * - **Expo Go**: Native Purchases are unavailable; calls may error and show an alert (use a dev build to test).
 */
function notConfiguredMessage(): string {
  if (__DEV__) {
    return 'RevenueCat is not configured. Set EXPO_PUBLIC_REVENUECAT_API_KEY_IOS (or _ANDROID) in .env, restart Metro, and for EAS builds add the same variable to the production environment and rebuild.';
  }
  return 'Subscriptions are temporarily unavailable. Please try again later.';
}

export async function presentRevenueCatPaywall(): Promise<PresentPaywallResult> {
  const configured = await initRevenueCat();
  if (!configured) {
    Alert.alert('Premium', notConfiguredMessage());
    return { presentedOk: false, premiumActivated: false };
  }
  const before = await fetchCustomerInfo();
  const hadPremium = customerHasPremium(before);
  try {
    const rc = getRevenueCatUI();
    if (!rc?.presentPaywall) {
      throw new Error(
        'RevenueCat paywall UI is unavailable. If you are using Expo Go, create an EAS dev build (expo-dev-client) or a production build. Also ensure react-native-purchases-ui is installed and the app is rebuilt.',
      );
    }
    const offering = await fetchOfferingForPaywall();
    await rc.presentPaywall(offering ? { offering } : undefined);
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.message
        : 'RevenueCat paywall UI is unavailable. Build a dev client / EAS build to test purchases.';
    Alert.alert('Premium', msg);
    return { presentedOk: false, premiumActivated: false };
  }
  const after = await fetchCustomerInfo();
  const premiumActivated = customerHasPremium(after) && !hadPremium;
  return { presentedOk: true, premiumActivated };
}

/** Subscription management sheet (manage/cancel in App Store / Play where supported). */
export async function presentRevenueCatCustomerCenter(): Promise<boolean> {
  const configured = await initRevenueCat();
  if (!configured) {
    Alert.alert('Subscriptions', notConfiguredMessage());
    return false;
  }
  try {
    const rc = getRevenueCatUI();
    if (!rc?.presentCustomerCenter) {
      throw new Error(
        'RevenueCat customer center UI is unavailable. If you are using Expo Go, create an EAS dev build (expo-dev-client) or a production build. Also ensure react-native-purchases-ui is installed and the app is rebuilt.',
      );
    }
    await rc.presentCustomerCenter();
    return true;
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.message
        : 'RevenueCat customer center UI is unavailable. Build a dev client / EAS build to manage subscriptions.';
    Alert.alert('Subscriptions', msg);
    return false;
  }
}
