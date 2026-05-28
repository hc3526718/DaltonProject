import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DS } from '../designSystem';

type Props = {
  visible: boolean;
  onDismiss: () => void;
};

export function PremiumSubscriptionThanksModal({ visible, onDismiss }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.scrim} pointerEvents="auto">
        <View style={[styles.card, { marginTop: Math.max(insets.top, DS.space.base) }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close thank you message"
            hitSlop={12}
            style={styles.closeBtn}
            onPress={onDismiss}
          >
            <FontAwesome name="times" size={20} color={DS.color.textMuted} />
          </Pressable>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.cardScroll}
          >
            <View style={styles.iconWrap}>
              <FontAwesome name="star" size={28} color={DS.color.gold} />
            </View>
            <Text style={styles.title}>Thank you</Text>
            <Text style={styles.lead}>You now have Premium access on Dalton.</Text>

            <Text style={styles.body}>
              Enjoy subscriber-only tools across media, events, and the community. Manage or cancel anytime from
              Premium → Manage subscription.
            </Text>

            <Pressable style={styles.primaryCta} onPress={onDismiss}>
              <Text style={styles.primaryCtaTxt}>Continue</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: DS.color.overlayDark80,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: DS.space.lg,
    paddingBottom: DS.space.xl,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '88%',
    backgroundColor: 'rgba(16,16,16,0.96)',
    borderRadius: DS.radius.xl,
    borderWidth: 1,
    borderColor: DS.color.goldTint30,
    paddingTop: DS.space.xl + 8,
    paddingHorizontal: DS.space.lg,
    paddingBottom: DS.space.lg,
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.35,
          shadowRadius: 16,
        }
      : Platform.OS === 'android'
        ? { elevation: 12 }
        : {}),
  },
  closeBtn: {
    position: 'absolute',
    top: DS.space.md,
    right: DS.space.md,
    zIndex: 2,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  cardScroll: {
    paddingTop: DS.space.sm,
    paddingHorizontal: DS.space.sm,
    paddingBottom: DS.space.sm,
  },
  iconWrap: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: DS.color.goldTint10,
    borderWidth: 1,
    borderColor: DS.color.goldTint30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: DS.space.base,
  },
  title: {
    fontFamily: DS.font.heading,
    fontSize: 26,
    letterSpacing: 1.2,
    color: DS.color.gold,
    textAlign: 'center',
    marginBottom: DS.space.sm,
  },
  lead: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 16,
    color: DS.color.text,
    textAlign: 'center',
    marginBottom: DS.space.lg,
  },
  body: {
    fontFamily: DS.font.body,
    fontSize: 14,
    lineHeight: 22,
    color: DS.color.textMuted,
    marginBottom: DS.space.base,
    textAlign: 'center',
  },
  primaryCta: {
    marginTop: DS.space.lg,
    alignSelf: 'stretch',
    backgroundColor: DS.color.gold,
    paddingVertical: DS.space.md,
    borderRadius: DS.radius.lg,
    alignItems: 'center',
  },
  primaryCtaTxt: {
    fontFamily: DS.font.bodyBold,
    fontSize: 15,
    letterSpacing: 0.8,
    color: DS.color.background,
  },
});
