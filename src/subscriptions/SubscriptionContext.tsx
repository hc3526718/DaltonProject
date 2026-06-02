import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '../auth/AuthContext';
import { isPremiumDemoEmail } from '../auth/demoAccounts';
import {
  initRevenueCat,
  restorePurchases,
  customerHasPremium,
  fetchCustomerInfo,
  identifyRevenueCatUser,
} from './revenueCat';
import { resolvePaymentVerifiedAccess, resolvePremiumAccess } from './resolvePremiumAccess';
import { useStripeCheckoutReturn } from './useStripeCheckoutReturn';

type SubscriptionContextValue = {
  /** Legacy premium flag — kept for compatibility; mirrors payment verified for launch. */
  isPro: boolean;
  /** Mandatory £2 academy access — `subscription_state.is_payment_verified`. */
  isPaymentVerified: boolean;
  busy: boolean;
  refresh: () => Promise<void>;
  restore: () => Promise<boolean>;
  notifyNewPremiumFromPaywall: (activated: boolean) => void;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { sessionEmail, user } = useAuth();
  const [isPro, setIsPro] = useState(false);
  const [isPaymentVerified, setIsPaymentVerified] = useState(false);
  const [busy, setBusy] = useState(true);
  const [premiumThanksVisible, setPremiumThanksVisible] = useState(false);

  const notifyNewPremiumFromPaywall = useCallback((activated: boolean) => {
    if (activated) setPremiumThanksVisible(true);
  }, []);

  const dismissPremiumThanks = useCallback(() => {
    setPremiumThanksVisible(false);
  }, []);

  const refresh = useCallback(async () => {
    setBusy(true);
    if (!sessionEmail?.trim()) {
      setIsPro(false);
      setIsPaymentVerified(false);
      setBusy(false);
      return;
    }
    if (isPremiumDemoEmail(sessionEmail)) {
      setIsPro(true);
      setIsPaymentVerified(true);
      setBusy(false);
      return;
    }
    const [paid, pro] = await Promise.all([resolvePaymentVerifiedAccess(), resolvePremiumAccess()]);
    setIsPaymentVerified(paid);
    setIsPro(pro || paid);
    setBusy(false);
  }, [sessionEmail]);

  const onStripeReturn = useCallback(
    (_kind: 'success' | 'cancel') => {
      void refresh();
    },
    [refresh],
  );

  useStripeCheckoutReturn(onStripeReturn);

  const restore = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    if (!sessionEmail?.trim()) {
      setIsPro(false);
      setIsPaymentVerified(false);
      setBusy(false);
      return false;
    }
    if (isPremiumDemoEmail(sessionEmail)) {
      setIsPro(true);
      setIsPaymentVerified(true);
      setBusy(false);
      return false;
    }
    await initRevenueCat();
    const before = await fetchCustomerInfo();
    const hadPro = customerHasPremium(before);
    const info = await restorePurchases();
    const pro = customerHasPremium(info);
    const gained = pro && !hadPro;
    setIsPro(pro);
    setIsPaymentVerified(pro);
    setBusy(false);
    if (gained) {
      void refresh();
    }
    return gained;
  }, [sessionEmail, refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void identifyRevenueCatUser(user?.id ?? null);
  }, [user?.id]);

  const value = useMemo(
    () => ({
      isPro,
      isPaymentVerified,
      busy,
      refresh,
      restore,
      notifyNewPremiumFromPaywall,
    }),
    [isPro, isPaymentVerified, busy, refresh, restore, notifyNewPremiumFromPaywall],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription requires SubscriptionProvider');
  return ctx;
}
