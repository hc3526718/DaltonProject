import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DS, tabRootTitleText } from '../designSystem';
import type { AccessibleColors } from '../lib/accessibilityTheme';
import { useThemeStyles } from '../theme/useThemeStyles';

type Props = {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
  largeTitle?: boolean;
  titleAlign?: 'left' | 'center';
  titleColor?: string;
};

export function ScreenHeader({
  title,
  onBack,
  right,
  largeTitle,
  titleAlign = 'left',
  titleColor,
}: Props) {
  const insets = useSafeAreaInsets();
  const styles = useThemeStyles(createScreenHeaderStyles);
  const resolvedTitleColor = titleColor ?? styles.titleColorDefault.color;

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + DS.space.md }]}>
      <View style={styles.row}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
            <FontAwesome name="arrow-left" size={22} color={styles.backIconColor.color} />
          </Pressable>
        ) : (
          <View style={styles.backPlaceholder} />
        )}
        <Text
          style={[
            styles.title,
            tabRootTitleText,
            largeTitle && styles.titleLarge,
            { color: resolvedTitleColor, textAlign: titleAlign },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <View style={styles.rightSlot}>{right}</View>
      </View>
    </View>
  );
}

function createScreenHeaderStyles(c: AccessibleColors) {
  return {
    wrap: {
      paddingHorizontal: DS.space.lg,
      paddingBottom: DS.space.base,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: DS.apple.separator,
      backgroundColor: c.background,
    },
    row: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      gap: DS.space.sm,
    },
    backBtn: {
      width: 40,
      alignItems: 'flex-start' as const,
    },
    backPlaceholder: {
      width: 40,
    },
    title: {
      flex: 1,
      fontWeight: '400' as const,
      textTransform: 'uppercase' as const,
    },
    titleLarge: {
      fontSize: 40,
      letterSpacing: 2.5,
    },
    rightSlot: {
      minWidth: 40,
      alignItems: 'flex-end' as const,
    },
    backIconColor: { color: c.text },
    titleColorDefault: { color: c.text },
  };
}
