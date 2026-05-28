import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';
import { useAccessibility } from '../accessibility/AccessibilityContext';
import { scaledFontSize } from '../lib/accessibilityTheme';
import { DS } from '../designSystem';

type Variant = 'default' | 'muted' | 'subtle' | 'gold' | 'inverse';

type Props = TextProps & {
  variant?: Variant;
  color?: string;
};

export function ThemedText({ variant = 'default', color, style, ...rest }: Props) {
  const { colors, prefs } = useAccessibility();
  const variantColor: Record<Variant, string> = {
    default: colors.text,
    muted: colors.textMuted,
    subtle: colors.textSubtle ?? colors.textMuted,
    gold: colors.gold,
    inverse: colors.background,
  };
  const base: TextStyle = {
    fontFamily: DS.font.body,
    color: color ?? variantColor[variant],
  };
  const flat = StyleSheet.flatten(style);
  if (flat?.fontSize && typeof flat.fontSize === 'number') {
    base.fontSize = scaledFontSize(flat.fontSize, prefs);
  }
  return <Text style={[base, style]} {...rest} />;
}
