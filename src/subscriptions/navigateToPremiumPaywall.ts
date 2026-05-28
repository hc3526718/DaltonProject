import type { NavigationProp, ParamListBase } from '@react-navigation/native';

/** Opens Profile tab → Paywall (RevenueCat) from nested stacks inside the main tab navigator. */
export function navigateToPremiumPaywall(navigation: NavigationProp<ParamListBase>): void {
  navigation.getParent()?.navigate('Profile' as never, { screen: 'Paywall' } as never);
}

/** Premium tools or Dalton admin role (bypass paywall UI). */
export function hasPremiumOrAdminTier(isPro: boolean, role?: string | null): boolean {
  if (isPro) return true;
  return role === 'admin' || role === 'super_admin';
}
