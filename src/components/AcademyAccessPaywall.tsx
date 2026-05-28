import { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { AppLoadingIndicator } from './AppLoadingIndicator';
import { DS } from '../designSystem';
import { useSubscription } from '../subscriptions/SubscriptionContext';
import {
  openStripeCheckoutUrl,
  startStripeCheckout,
} from '../subscriptions/stripeBilling';
import { presentRevenueCatPaywall } from '../subscriptions/presentRevenueCatPaywall';
import { authAlert } from '../auth/authAlert';

const FEATURES = [
  'High-quality podcasts, interviews, and training media',
  'Special sponsorship deals and academy partnerships',
  'High-level events with QR check-in and booking',
  'Community feed — connect with athletes and coaches across the UK',
];

type Props = {
  onAccessGranted?: () => void;
};

/** Mandatory academy access subscription — non-dismissible until paid or restored. */
export function AcademyAccessPaywall({ onAccessGranted }: Props) {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const { refresh, restore, notifyNewPremiumFromPaywall, busy, isPaymentVerified } = useSubscription();
  const [payBusy, setPayBusy] = useState(false);
  const isWeb = Platform.OS === 'web';

  const startWebCheckout = useCallback(async () => {
    setPayBusy(true);
    try {
      const result = await startStripeCheckout('access');
      if (!result.ok) {
        authAlert('Checkout', result.error);
        return;
      }
      openStripeCheckoutUrl(result.url);
    } finally {
      setPayBusy(false);
    }
  }, []);

  const startMobilePaywall = useCallback(async () => {
    setPayBusy(true);
    try {
      const { premiumActivated } = await presentRevenueCatPaywall();
      await refresh();
      if (premiumActivated) {
        notifyNewPremiumFromPaywall(true);
        onAccessGranted?.();
      }
    } finally {
      setPayBusy(false);
    }
  }, [notifyNewPremiumFromPaywall, onAccessGranted, refresh]);

  const onRestore = useCallback(async () => {
    setPayBusy(true);
    try {
      const gained = await restore();
      if (gained) {
        notifyNewPremiumFromPaywall(true);
        onAccessGranted?.();
      } else {
        authAlert('Restore', 'No active subscription found for this account.');
      }
    } finally {
      setPayBusy(false);
    }
  }, [notifyNewPremiumFromPaywall, onAccessGranted, restore]);

  const loading = busy || payBusy;

  return (
    <View style={[styles.root, { paddingTop: insets.top + DS.space.lg, paddingBottom: insets.bottom + DS.space.lg }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>THE DALTON GRANT ACADEMY</Text>
        <Text style={styles.title}>Unlock full academy access</Text>
        <Text style={styles.subtitle}>
          A small monthly fee keeps the platform running and gives you everything Dalton has prepared for athletes in
          his academy — media, events, sponsors, and community.
        </Text>
        <View style={styles.priceCard}>
          <Text style={styles.price}>£2</Text>
          <Text style={styles.priceUnit}>/ month</Text>
          <Text style={styles.priceNote}>Mandatory to enter the app · Cancel anytime</Text>
        </View>
        <View style={styles.featureList}>
          {FEATURES.map((line) => (
            <View key={line} style={styles.featureRow}>
              <FontAwesome name="check-circle" size={16} color={DS.color.gold} />
              <Text style={styles.featureTxt}>{line}</Text>
            </View>
          ))}
        </View>
        {loading ? (
          <View style={styles.loadingRow}>
            <AppLoadingIndicator />
          </View>
        ) : null}
        <Pressable
          style={[styles.primaryBtn, loading && styles.btnDisabled]}
          disabled={loading}
          onPress={() => void (isWeb ? startWebCheckout() : startMobilePaywall())}
        >
          <Text style={styles.primaryBtnTxt}>{isWeb ? 'Continue to secure checkout' : 'Subscribe with App Store'}</Text>
        </Pressable>
        {!isWeb ? (
          <Pressable style={styles.secondaryBtn} disabled={loading} onPress={() => void onRestore()}>
            <Text style={styles.secondaryBtnTxt}>Restore purchases</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={styles.secondaryBtn}
          disabled={loading}
          onPress={() =>
            void refresh().then(() => {
              if (isPaymentVerified) onAccessGranted?.();
            })
          }
        >
          <Text style={styles.secondaryBtnTxt}>I already paid — refresh access</Text>
        </Pressable>
        <Pressable style={styles.logoutBtn} onPress={() => void logout()}>
          <Text style={styles.logoutTxt}>Sign out</Text>
        </Pressable>
        <Text style={styles.legal}>
          Payment is verified on our servers before the app unlocks. Sharing accounts or tampering with client checks
          does not bypass billing.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.color.background },
  scroll: { paddingHorizontal: DS.space.xl, paddingBottom: DS.space.xl },
  kicker: {
    fontFamily: DS.font.heading,
    fontSize: 13,
    letterSpacing: 3,
    color: DS.color.gold,
    textAlign: 'center',
  },
  title: {
    fontFamily: DS.font.heading,
    fontSize: 32,
    color: DS.color.text,
    textAlign: 'center',
    marginTop: DS.space.sm,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontFamily: DS.font.body,
    fontSize: 15,
    color: DS.color.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: DS.space.md,
  },
  priceCard: {
    marginTop: DS.space.xl,
    padding: DS.space.lg,
    borderRadius: DS.radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,168,75,0.35)',
    backgroundColor: 'rgba(200,168,75,0.08)',
    alignItems: 'center',
  },
  price: {
    fontFamily: DS.font.heading,
    fontSize: 48,
    color: DS.color.gold,
    lineHeight: 52,
  },
  priceUnit: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 16,
    color: DS.color.text,
    marginTop: 2,
  },
  priceNote: {
    fontFamily: DS.font.body,
    fontSize: 12,
    color: DS.color.textMuted,
    marginTop: DS.space.sm,
    textAlign: 'center',
  },
  featureList: { marginTop: DS.space.xl, gap: DS.space.md },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: DS.space.sm },
  featureTxt: {
    flex: 1,
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.text,
    lineHeight: 20,
  },
  loadingRow: { alignItems: 'center', marginVertical: DS.space.md },
  primaryBtn: {
    marginTop: DS.space.xl,
    backgroundColor: DS.color.gold,
    borderRadius: DS.radius.xl,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnTxt: {
    fontFamily: DS.font.bodyBold,
    fontSize: 16,
    color: DS.color.background,
  },
  secondaryBtn: {
    marginTop: DS.space.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: DS.radius.xl,
    borderWidth: 1,
    borderColor: DS.color.borderHairline,
  },
  secondaryBtnTxt: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 14,
    color: DS.color.text,
  },
  btnDisabled: { opacity: 0.55 },
  logoutBtn: { marginTop: DS.space.lg, alignItems: 'center', paddingVertical: 8 },
  logoutTxt: { fontFamily: DS.font.body, fontSize: 13, color: DS.color.textMuted },
  legal: {
    fontFamily: DS.font.body,
    fontSize: 11,
    color: DS.color.textMuted,
    textAlign: 'center',
    marginTop: DS.space.lg,
    lineHeight: 16,
  },
});
