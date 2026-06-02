import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { warmDaltonBootVideoCache } from '../constants/daltonBootVideo';
import { DaltonVideoLoop } from './DaltonVideoLoop';

/** Hidden preload for auth hero video — mounted once on the auth stack (web + native). */
export function BootVideoWarmup() {
  useEffect(() => {
    warmDaltonBootVideoCache();
  }, []);

  return (
    <View
      style={styles.hidden}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <DaltonVideoLoop style={styles.video} accessibilityLabel="" />
    </View>
  );
}

const styles = StyleSheet.create({
  /** Off-screen but large enough for iOS/Android to decode frames before auth hero mounts. */
  hidden: {
    position: 'absolute',
    width: 320,
    height: 568,
    opacity: 0.01,
    overflow: 'hidden',
    left: -400,
    top: 0,
    zIndex: -1,
  },
  video: {
    width: '100%',
    height: '100%',
  },
});
