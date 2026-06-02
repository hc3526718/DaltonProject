import { StyleSheet, View } from 'react-native';
import { DALTON_BOOT_VIDEO_BG } from '../constants/daltonBootVideo';
import { BootCircleLoader } from './BootCircleLoader';

/** Pull-to-refresh indicator under the status bar (paired with transparent RefreshControl). */
export function PullRefreshRiveOverlay({
  visible,
  topInset,
}: {
  visible: boolean;
  topInset: number;
}) {
  if (!visible) return null;

  return (
    <View pointerEvents="none" style={[styles.overlay, { paddingTop: topInset }]}>
      <View style={styles.box}>
        <BootCircleLoader size={52} compact />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: 'center',
    backgroundColor: DALTON_BOOT_VIDEO_BG,
  },
  box: {
    height: 100,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DALTON_BOOT_VIDEO_BG,
  },
});
