import type { ImageStyle, StyleProp, ViewStyle } from 'react-native';
import { Image, View } from 'react-native';
import { DALTON_LOGO_FINAL_IMG } from '../constants/brandAssets';

type Props = {
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

/** Compact logo for auth chrome — same asset as `BrandLogo`, smaller default size. */
export function BrandLogoMark({ width = 72, height = 72, style }: Props) {
  return (
    <View style={style} accessibilityRole="image" accessibilityLabel="Dalton logo">
      <Image
        source={DALTON_LOGO_FINAL_IMG}
        style={{ width, height } as ImageStyle}
        resizeMode="contain"
      />
    </View>
  );
}
