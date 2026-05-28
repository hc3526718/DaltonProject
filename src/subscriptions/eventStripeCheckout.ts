import { Linking, Platform } from 'react-native';
import { getSupabase } from '../lib/supabase';
import { getStripeCheckoutReturnBaseUrl } from './stripeBilling';

export type StartEventCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/** One-time Stripe Checkout for a paid event ticket (requires `events.stripe_price_id`). */
export async function startEventStripeCheckout(
  eventId: string,
): Promise<StartEventCheckoutResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: 'Sign in is required before checkout.' };
  }
  const returnBase = getStripeCheckoutReturnBaseUrl();
  const { data, error } = await supabase.functions.invoke('stripe-create-checkout', {
    body: {
      mode: 'event',
      event_id: eventId,
      success_url: returnBase
        ? `${returnBase}?stripe_checkout=success&event_id=${encodeURIComponent(eventId)}`
        : undefined,
      cancel_url: returnBase
        ? `${returnBase}?stripe_checkout=cancel&event_id=${encodeURIComponent(eventId)}`
        : undefined,
    },
  });
  if (error) {
    return { ok: false, error: error.message || 'Could not start checkout.' };
  }
  const url = typeof data?.url === 'string' ? data.url : '';
  if (!url) {
    const msg = typeof data?.error === 'string' ? data.error : 'Checkout URL missing.';
    return { ok: false, error: msg };
  }
  return { ok: true, url };
}

export function openEventCheckoutUrl(url: string): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.assign(url);
    return;
  }
  void Linking.openURL(url);
}
