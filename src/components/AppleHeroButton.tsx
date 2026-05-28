import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type PressableProps, type ViewStyle } from 'react-native';
import { AppLoadingIndicator } from './AppLoadingIndicator';
import { DS } from '../designSystem';
import type { AccessibleColors } from '../lib/accessibilityTheme';
import { useThemeStyles } from '../theme/useThemeStyles';

type Variant = 'primary' | 'secondary' | 'ghost' | 'social' | 'unfollow';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  variant?: Variant;
  style?: ViewStyle | ViewStyle[];
  loading?: boolean;
  large?: boolean;
};

export function AppleHeroButton({
  children,
  variant = 'primary',
  style,
  disabled,
  loading,
  large = true,
  ...rest
}: Props) {
  const styles = useThemeStyles(createAppleHeroButtonStyles);
  const minH = large ? DS.apple.controlHeight : 44;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        { minHeight: minH, borderRadius: DS.apple.radiusButton },
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        variant === 'social' && styles.social,
        variant === 'unfollow' && styles.unfollow,
        pressed && !disabled && !loading && styles.pressed,
        (disabled || loading) && styles.disabled,
        variant === 'primary' && DS.apple.shadowButton,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <AppLoadingIndicator size={24} />
      ) : typeof children === 'string' ? (
        <Text
          style={[
            styles.label,
            variant === 'primary' && styles.labelPrimary,
            variant === 'secondary' && styles.labelSecondary,
            variant === 'ghost' && styles.labelGhost,
            variant === 'social' && styles.labelSocial,
            variant === 'unfollow' && styles.labelUnfollow,
          ]}
          numberOfLines={1}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

function createAppleHeroButtonStyles(c: AccessibleColors) {
  return {
    base: {
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      paddingHorizontal: DS.space.lg,
    },
    primary: {
      backgroundColor: c.gold,
    },
    secondary: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: c.goldTint30,
    },
    ghost: {
      backgroundColor: DS.apple.fillSecondary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: DS.apple.separator,
    },
    social: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: DS.apple.separator,
    },
    unfollow: {
      backgroundColor: c.background,
      borderWidth: 1.5,
      borderColor: c.gold,
    },
    pressed: {
      opacity: 0.88,
    },
    disabled: {
      opacity: 0.45,
    },
    label: {
      fontFamily: DS.font.bodyMedium,
      fontSize: 17,
      fontWeight: '600' as const,
      letterSpacing: 0.2,
    },
    labelPrimary: {
      color: c.background,
    },
    labelSecondary: {
      color: c.gold,
    },
    labelGhost: {
      color: c.text,
    },
    labelSocial: {
      color: c.text,
      fontWeight: '600' as const,
    },
    labelUnfollow: {
      color: c.gold,
    },
  };
}
