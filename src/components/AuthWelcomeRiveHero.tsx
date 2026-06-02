import { StyleSheet, View } from 'react-native';
import { DALTON_BOOT_VIDEO_BG } from '../constants/daltonBootVideo';
import { DaltonVideoLoop } from './DaltonVideoLoop';

type Props = {
  /** Height of the hero slot (welcome / auth). */
  height?: number;
};

/** Auth welcome hero — brand video loops immediately (no poster gate). */
export function AuthWelcomeRiveHero({ height = 220 }: Props) {
  return (
    <View style={[styles.slot, { height }]}>
      <DaltonVideoLoop style={styles.video} accessibilityLabel="The Dalton Grant Academy" />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DALTON_BOOT_VIDEO_BG,
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
});
