import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DS } from '../designSystem';
import { openMarketingLanding } from '../lib/marketingLanding';

/** Web auth stack: return to marketing landing page (/). */
export function AuthWebBackBar() {
  const insets = useSafeAreaInsets();
  if (Platform.OS !== 'web') return null;

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + DS.space.sm }]}>
      <Pressable
        onPress={openMarketingLanding}
        style={styles.btn}
        accessibilityRole="link"
        accessibilityLabel="Back to home page"
      >
        <FontAwesome name="arrow-left" size={18} color={DS.color.gold} />
        <Text style={styles.label}>Back to home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: DS.space.lg,
    paddingBottom: DS.space.sm,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 14,
    color: DS.color.textMuted,
  },
});
