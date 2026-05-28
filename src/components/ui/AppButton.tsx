import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { AppLoadingIndicator } from '../AppLoadingIndicator';
import { DS } from '../../designSystem';

type Variant = 'primary' | 'secondary' | 'ghost';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  style?: ViewStyle;
};

/**
 * Minimal, high-contrast controls — Apple-adjacent radii and vertical rhythm (HeroUI-inspired spacing).
 */
export function AppButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  style,
}: Props) {
  const v = variantStyles[variant];
  const dim = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={dim}
      style={({ pressed }) => [
        styles.base,
        v.container,
        pressed && !dim && v.pressed,
        dim && styles.dim,
        style,
      ]}
    >
      {loading ? (
        <AppLoadingIndicator size={24} />
      ) : (
        <>
          {icon}
          <Text style={[styles.label, v.label]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: DS.apple.controlHeight,
    paddingHorizontal: DS.space.lg,
    borderRadius: DS.apple.radiusButton,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: DS.space.sm,
  },
  label: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 16,
    letterSpacing: 0.2,
  },
  dim: { opacity: 0.45 },
});

const variantStyles = {
  primary: {
    container: {
      backgroundColor: DS.color.gold,
      ...DS.apple.shadowButton,
    },
    pressed: { backgroundColor: DS.color.goldTint90 },
    label: { color: DS.color.background },
    spinner: DS.color.background,
  },
  secondary: {
    container: {
      backgroundColor: DS.apple.fillSecondary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: DS.apple.separator,
    },
    pressed: { backgroundColor: DS.color.surface },
    label: { color: DS.color.text },
    spinner: DS.color.gold,
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    pressed: { backgroundColor: DS.apple.fillSecondary },
    label: { color: DS.color.gold },
    spinner: DS.color.gold,
  },
} as const;
