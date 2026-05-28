import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { AppLoadingIndicator } from './AppLoadingIndicator';
import { DS } from '../designSystem';
import {
  getStripePlanDisplays,
  isStripeWebBillingConfigured,
  openStripeCheckoutUrl,
  startStripeCheckout,
  type StripePlanKey,
} from '../subscriptions/stripeBilling';
import { authAlert } from '../auth/authAlert';

type Props = {
  onSubscribed?: () => void;
  showClose?: boolean;
  onClose?: () => void;
};

const FEATURES = [
  'Unlimited saves & early booking',
  'Creator & host tools (Dalton verified)',
  'Premium media & ad-free experience',
  'Same access on web, iOS, and Android',
];

export function StripePremiumPaywall({ onSubscribed, showClose, onClose }: Props) {
  const plans = getStripePlanDisplays();
  const [selected, setSelected] = useState<StripePlanKey>(plans[0]?.key ?? 'monthly');
  const [busy, setBusy] = useState(false);
  const configured = isStripeWebBillingConfigured();

  const subscribe = useCallback(async () => {
    if (!configured) {
      authAlert(
        'Premium',
        'Stripe is not configured for web yet. Add EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY and deploy the stripe-create-checkout Edge Function with STRIPE_SECRET_KEY.',
      );
      return;
    }
    setBusy(true);
    try {
      const result = await startStripeCheckout(selected);
      if (!result.ok) {
        authAlert('Checkout', result.error);
        return;
      }
      openStripeCheckoutUrl(result.url);
      onSubscribed?.();
    } finally {
      setBusy(false);
    }
  }, [configured, onSubscribed, selected]);

  return (
    <View style={styles.root}>
      {showClose ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={12}
          onPress={onClose}
          style={styles.closeHit}
        >
          <FontAwesome name="times" size={22} color={DS.color.gold} />
        </Pressable>
      ) : null}

      <View style={styles.hero}>
        <Text style={styles.kicker}>DALTON PREMIUM</Text>
        <Text style={styles.title}>Unlock verified access</Text>
        <Text style={styles.subtitle}>
          Subscribe once with Stripe — your premium status follows your account on every device.
        </Text>
      </View>

      <View style={styles.featureList}>
        {FEATURES.map((line) => (
          <View key={line} style={styles.featureRow}>
            <FontAwesome name="check-circle" size={16} color={DS.color.gold} />
            <Text style={styles.featureText}>{line}</Text>
          </View>
        ))}
      </View>

      <View style={styles.planList}>
        {plans.map((plan) => {
          const active = plan.key === selected;
          return (
            <Pressable
              key={plan.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setSelected(plan.key)}
              style={[styles.planCard, active && styles.planCardActive]}
            >
              <View style={styles.planHeader}>
                <Text style={[styles.planTitle, active && styles.planTitleActive]}>{plan.title}</Text>
                {plan.badge ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{plan.badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.planPrice}>{plan.priceLine}</Text>
              <Text style={styles.planDesc}>{plan.description}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void subscribe()}
        style={[styles.primaryBtn, busy && styles.primaryBtnDisabled]}
      >
        {busy ? (
          <AppLoadingIndicator size={24} />
        ) : (
          <Text style={styles.primaryBtnText}>Continue to secure checkout</Text>
        )}
      </Pressable>

      <Text style={styles.footnote}>
        You will complete payment on Stripe. Taxes and final price are shown before you pay.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: DS.space.xl,
    paddingBottom: DS.space.xl,
    gap: DS.space.md,
  },
  closeHit: {
    alignSelf: 'flex-end',
    padding: DS.space.xs,
    marginTop: DS.space.xs,
  },
  hero: {
    alignItems: 'center',
    gap: DS.space.sm,
    paddingTop: DS.space.sm,
  },
  kicker: {
    fontFamily: DS.font.heading,
    fontSize: 14,
    letterSpacing: 3,
    color: DS.color.gold,
  },
  title: {
    fontFamily: DS.font.heading,
    fontSize: 36,
    lineHeight: 40,
    color: DS.color.white,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: DS.font.body,
    fontSize: 14,
    lineHeight: 21,
    color: DS.color.textMuted,
    textAlign: 'center',
    maxWidth: 340,
  },
  featureList: {
    gap: DS.space.sm,
    paddingVertical: DS.space.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: DS.space.sm,
  },
  featureText: {
    flex: 1,
    fontFamily: DS.font.body,
    fontSize: 14,
    lineHeight: 20,
    color: DS.color.text,
  },
  planList: {
    gap: DS.space.sm,
  },
  planCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: DS.color.cardBorder,
    backgroundColor: DS.color.surface,
    padding: DS.space.base,
    gap: 4,
  },
  planCardActive: {
    borderColor: DS.color.gold,
    backgroundColor: DS.color.goldTint10,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planTitle: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 17,
    color: DS.color.screenTitle,
  },
  planTitleActive: {
    color: DS.color.gold,
  },
  badge: {
    backgroundColor: DS.color.goldTint30,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 11,
    color: DS.color.gold,
  },
  planPrice: {
    fontFamily: DS.font.bodyBold,
    fontSize: 15,
    color: DS.color.white,
  },
  planDesc: {
    fontFamily: DS.font.body,
    fontSize: 13,
    color: DS.color.textMuted,
    lineHeight: 18,
  },
  primaryBtn: {
    backgroundColor: DS.color.gold,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 16,
    color: DS.color.background,
    fontWeight: '700',
  },
  footnote: {
    fontFamily: DS.font.body,
    fontSize: 12,
    lineHeight: 17,
    color: DS.color.textMuted,
    textAlign: 'center',
  },
});
