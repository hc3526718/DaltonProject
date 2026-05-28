import { useCallback, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppLoadingIndicator } from '../components/AppLoadingIndicator';
import { StripePremiumPaywall } from '../components/StripePremiumPaywall';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome } from '@expo/vector-icons';
import { DS } from '../designSystem';
import { presentRevenueCatCustomerCenter, presentRevenueCatPaywall } from '../subscriptions/presentRevenueCatPaywall';
import { useSubscription } from '../subscriptions/SubscriptionContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Paywall'>;

export function PaywallScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { busy, refresh, restore, notifyNewPremiumFromPaywall, isPro } = useSubscription();
  const [presenting, setPresenting] = useState(false);
  const paywallBusy = useRef(false);
  const isWeb = Platform.OS === 'web';

  const showRevenueCatPaywall = useCallback(async () => {
    if (paywallBusy.current) return;
    paywallBusy.current = true;
    setPresenting(true);
    try {
      const { premiumActivated } = await presentRevenueCatPaywall();
      await refresh();
      if (premiumActivated) notifyNewPremiumFromPaywall(true);
    } finally {
      paywallBusy.current = false;
      setPresenting(false);
    }
  }, [refresh, notifyNewPremiumFromPaywall]);

  useFocusEffect(
    useCallback(() => {
      if (isWeb) {
        if (!busy && isPro) {
          navigation.replace('AthleteProfile');
        }
        return undefined;
      }
      void showRevenueCatPaywall();
    }, [isWeb, busy, isPro, navigation, showRevenueCatPaywall]),
  );

  const exitPaywall = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('AthleteProfile');
  }, [navigation]);

  const openCustomerCenter = async () => {
    await presentRevenueCatCustomerCenter();
  };

  if (isWeb) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={exitPaywall}
            style={styles.iconHit}
          >
            <FontAwesome name="chevron-left" size={22} color={DS.color.gold} />
          </Pressable>
          <Text style={styles.topTitle}>Premium</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView contentContainerStyle={styles.webScroll} keyboardShouldPersistTaps="handled">
          {busy ? (
            <View style={styles.webLoader}>
              <AppLoadingIndicator />
            </View>
          ) : isPro ? (
            <View style={styles.webActive}>
              <FontAwesome name="check-circle" size={48} color={DS.color.gold} />
              <Text style={styles.activeTitle}>You have Premium</Text>
              <Text style={styles.lead}>
                Your subscription is active on this account. Open Dalton on any device while signed in
                with the same email to use premium features.
              </Text>
              <Pressable style={styles.linkBtn} onPress={() => void refresh()}>
                <Text style={styles.linkTxt}>Refresh status</Text>
              </Pressable>
            </View>
          ) : (
            <StripePremiumPaywall />
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          onPress={exitPaywall}
          style={styles.iconHit}
        >
          <FontAwesome name="chevron-left" size={22} color={DS.color.gold} />
        </Pressable>
        <Text style={styles.topTitle}>Premium</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.center}>
        {busy || presenting ? (
          <AppLoadingIndicator />
        ) : (
          <>
            <Text style={styles.lead}>
              Subscription options use your RevenueCat Paywall templates. Tap below if the sheet did not open
              (e.g. Expo Go or store billing not configured).
            </Text>
            <Pressable style={styles.primaryBtn} onPress={() => void showRevenueCatPaywall()}>
              <Text style={styles.primaryBtnText}>View plans</Text>
            </Pressable>
            <Pressable style={styles.linkBtn} onPress={() => void openCustomerCenter()}>
              <Text style={styles.linkTxt}>Manage subscription</Text>
            </Pressable>
            <Pressable
              style={styles.linkBtn}
              onPress={() =>
                void restore().then((gained) => {
                  if (gained) notifyNewPremiumFromPaywall(true);
                })
              }
            >
              <Text style={styles.linkTxt}>Restore purchases</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DS.space.base,
    paddingBottom: DS.space.sm,
  },
  iconHit: { padding: DS.space.xs },
  topTitle: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 16,
    color: DS.color.screenTitle,
  },
  webScroll: {
    flexGrow: 1,
    paddingBottom: DS.space.xxl,
  },
  webLoader: {
    flex: 1,
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webActive: {
    alignItems: 'center',
    paddingHorizontal: DS.space.xl,
    paddingTop: DS.space.xxl,
    gap: DS.space.md,
  },
  activeTitle: {
    fontFamily: DS.font.heading,
    fontSize: 28,
    color: DS.color.white,
  },
  center: {
    flex: 1,
    paddingHorizontal: DS.space.xl,
    justifyContent: 'center',
    alignItems: 'stretch',
    gap: DS.space.md,
  },
  lead: {
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: DS.space.md,
  },
  primaryBtn: {
    backgroundColor: DS.color.gold,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 16,
    color: DS.color.background,
    fontWeight: '700',
  },
  linkBtn: { paddingVertical: 12, alignItems: 'center' },
  linkTxt: {
    fontFamily: DS.font.body,
    fontSize: 15,
    color: DS.color.gold,
  },
});
