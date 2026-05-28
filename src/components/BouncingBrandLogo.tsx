import { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { BrandLogo } from './BrandLogo';

type Props = {
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

/** Gentle scale loop — use on boot / onboarding when Rive is disabled or fails. */
export function BouncingBrandLogo({ width = 160, height = 160, style }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.07,
          duration: 720,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 720,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scale]);
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <BrandLogo width={width} height={height} />
    </Animated.View>
  );
}
