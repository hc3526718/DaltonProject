import { Platform, RefreshControl } from 'react-native';
import { DS } from '../designSystem';

/** Hides native spinner; pair with PullRefreshRiveOverlay on supported platforms. */
export function pullRefreshControl(refreshing: boolean, onRefresh: () => void) {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor="transparent"
      title=""
      progressViewOffset={Platform.OS === 'android' ? 40 : undefined}
      colors={[DS.color.background]}
      progressBackgroundColor={DS.color.background}
    />
  );
}
