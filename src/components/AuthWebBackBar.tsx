import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DS } from '../designSystem';
import { openMarketingLanding } from '../lib/marketingLanding';

const HORIZONTAL_INSET = DS.space.lg + DS.space.base;

/** Web auth stack only: return to marketing landing page (/). */
export function AuthWebBackBar() {
  const insets = useSafeAreaInsets();
  if (Platform.OS !== 'web') return null;

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + DS.space.md }]}>
      <Pressable
        onPress={openMarketingLanding}
        style={styles.btn}
        accessibilityRole="link"
        accessibilityLabel="Back to home page"
      >
        <FontAwesome name="arrow-left" size={22} color={DS.color.gold} />
        <Text style={styles.label}>Back to home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: HORIZONTAL_INSET,
    paddingBottom: DS.space.sm,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingVertical: DS.space.sm,
    paddingRight: DS.space.md,
  },
  label: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 17,
    color: DS.color.textMuted,
  },
});
