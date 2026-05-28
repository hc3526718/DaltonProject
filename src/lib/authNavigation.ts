import { Platform } from 'react-native';
import { openMarketingLanding } from './marketingLanding';

type NavLike = {
  canGoBack: () => boolean;
  goBack: () => void;
};

/** Auth screens: on web, back goes to marketing site; on native, pop stack. */
export function authBackHandler(navigation: NavLike, nativeFallback?: () => void): (() => void) | undefined {
  if (Platform.OS === 'web') {
    return openMarketingLanding;
  }
  if (navigation.canGoBack()) {
    return () => navigation.goBack();
  }
  return nativeFallback;
}
