import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DALTON_BOOT_VIDEO_BG } from '../constants/daltonBootVideo';
import { BootCircleLoader } from './BootCircleLoader';

/** Web app boot — gold ring loader on pure black. */
export function DaltonBootScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <BootCircleLoader size={64} compact />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: DALTON_BOOT_VIDEO_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
