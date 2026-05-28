import { Platform } from 'react-native';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import { navigateToPremiumPaywall } from './navigateToPremiumPaywall';
import { presentRevenueCatPaywall, type PresentPaywallResult } from './presentRevenueCatPaywall';

/**
 * Premium gate entry point:
 * - **Web**: navigates to Profile → Paywall (Stripe UI; RevenueCat native sheet unavailable).
 * - **iOS/Android**: presents RevenueCat Paywall UI.
 */
export async function presentPremiumPaywall(
  navigation?: NavigationProp<ParamListBase>,
): Promise<PresentPaywallResult> {
  if (Platform.OS === 'web') {
    if (navigation) {
      navigateToPremiumPaywall(navigation);
      return { presentedOk: true, premiumActivated: false };
    }
    return {
      presentedOk: false,
      premiumActivated: false,
    };
  }
  return presentRevenueCatPaywall();
}
