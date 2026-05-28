import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BootCircleLoader } from './BootCircleLoader';

type Props = {
  style?: StyleProp<ViewStyle>;
  /** Diameter of the ring (default 52). Use ~22–28 inside buttons. */
  size?: number;
};

/** Standard Dalton loading spinner — single ring with gold arc (matches boot screen). */
export function AppLoadingIndicator({ style, size }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <BootCircleLoader size={size} compact />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
