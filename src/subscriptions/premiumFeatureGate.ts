import { Alert } from 'react-native';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import type { AppUser } from '../auth/AuthContext';
import { canCreateVerifiedContent } from '../creator/creatorAccess';

export type PremiumGateResult = 'allowed' | 'blocked';

const MASTER_ONLY_TITLE = 'Master access only';
const MASTER_ONLY_MESSAGE =
  'Creating events, media, and sponsor pages is limited to Dalton Academy master accounts while we launch.';

/**
 * Gate creator tools — master / admin only (premium + verification paused for launch).
 */
export async function gatePremiumFeatureAccess(opts: {
  navigation: NavigationProp<ParamListBase>;
  isPro: boolean;
  user: AppUser | null;
  refreshSubscription?: () => Promise<void>;
  notifyNewPremiumFromPaywall?: (activated: boolean) => void;
}): Promise<PremiumGateResult> {
  void opts.navigation;
  void opts.refreshSubscription;
  void opts.notifyNewPremiumFromPaywall;

  if (canCreateVerifiedContent(opts.isPro, opts.user)) {
    return 'allowed';
  }

  Alert.alert(MASTER_ONLY_TITLE, MASTER_ONLY_MESSAGE);
  return 'blocked';
}
