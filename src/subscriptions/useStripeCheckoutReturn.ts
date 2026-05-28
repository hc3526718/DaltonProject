import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * After Stripe Checkout success_url redirect, strip query params and refresh subscription.
 */
export function useStripeCheckoutReturn(onReturn: (kind: 'success' | 'cancel') => void): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const status = params.get('stripe_checkout');
    if (status !== 'success' && status !== 'cancel') return;

    onReturn(status);

    const url = new URL(window.location.href);
    url.searchParams.delete('stripe_checkout');
    const next = url.pathname + (url.search ? url.search : '') + url.hash;
    window.history.replaceState({}, '', next);
  }, [onReturn]);
}
