import type { ImageStyle, StyleProp, ViewStyle } from 'react-native';
import { Image, View } from 'react-native';
import { DALTON_LOGO_FINAL_IMG } from '../constants/brandAssets';

type Props = {
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

/** Main Dalton mark — same asset as native splash (`dalton_logo_final_img.png`). */
export function BrandLogo({ width = 160, height = 160, style }: Props) {
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
