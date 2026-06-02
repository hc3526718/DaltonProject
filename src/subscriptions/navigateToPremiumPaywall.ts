import type { NavigationProp, ParamListBase } from '@react-navigation/native';

/** Opens Profile tab → Paywall (RevenueCat) from nested stacks inside the main tab navigator. */
export function navigateToPremiumPaywall(navigation: NavigationProp<ParamListBase>): void {
  const parent = navigation.getParent() as unknown as { navigate: (...args: any[]) => void } | undefined;
  parent?.navigate('Profile', { screen: 'Paywall' });
}

/** Premium tools or Dalton admin role (bypass paywall UI). */
export function hasPremiumOrAdminTier(isPro: boolean, role?: string | null): boolean {
  if (isPro) return true;
  return role === 'admin' || role === 'super_admin';
}
