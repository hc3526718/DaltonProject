import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';
import { useAccessibility } from '../accessibility/AccessibilityContext';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Root screen container using accessible background color. */
export function ScreenShell({ children, style }: Props) {
  const { colors } = useAccessibility();
  return <View style={[{ flex: 1, backgroundColor: colors.background }, style]}>{children}</View>;
}
