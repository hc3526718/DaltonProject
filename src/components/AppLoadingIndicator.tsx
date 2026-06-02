import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BootCircleLoader } from './BootCircleLoader';

type Props = {
  style?: StyleProp<ViewStyle>;
  /** Loader diameter (gold ring). */
  size?: number;
};

/** Standard Dalton loading indicator — gold single-segment ring. */
export function AppLoadingIndicator({ style, size = 52 }: Props) {
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
