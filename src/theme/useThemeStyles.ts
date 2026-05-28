import { useMemo } from 'react';
import { StyleSheet, type StyleSheet as StyleSheetType } from 'react-native';
import { useAccessibility } from '../accessibility/AccessibilityContext';
import type { AccessibleColors } from '../lib/accessibilityTheme';

/**
 * Build styles from accessible color tokens (updates when a11y prefs change).
 * Use instead of module-level `StyleSheet.create` with static `DS.color`.
 */
export function useThemeStyles<T extends StyleSheetType.NamedStyles<T>>(
  factory: (colors: AccessibleColors, textScale: number) => T,
): T {
  const { colors, textScale } = useAccessibility();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- factory should be module-stable (e.g. createXStyles)
  return useMemo(() => StyleSheet.create(factory(colors, textScale)), [colors, textScale]);
}

/** Shared stack screen options keyed off accessible background. */
export function useThemedStackScreenOptions() {
  const { colors } = useAccessibility();
  return useMemo(
    () => ({
      headerShown: false as const,
      contentStyle: { backgroundColor: colors.background },
    }),
    [colors.background],
  );
}
