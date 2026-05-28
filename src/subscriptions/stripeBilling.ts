import { Platform } from 'react-native';
import { getDaltonWebUrl, isSupabaseConfigured } from '../lib/env';
import { getSupabase } from '../lib/supabase';

export type StripePlanKey = 'monthly' | 'annual' | 'access';

export type StripePlanDisplay = {
  key: StripePlanKey;
  title: string;
  priceLine: string;
  description: string;
  badge?: string;
};

const DEFAULT_PLANS: StripePlanDisplay[] = [
  {
    key: 'monthly',
    title: 'Monthly',
    priceLine: '£11.99 / month',
    description: 'Full premium access on web and mobile. Cancel anytime.',
  },
  {
    key: 'annual',
    title: 'Annual',
    priceLine: '£99.99 / year',
    description: 'Best value — one subscription across all your devices. Cancel anytime.',
    badge: 'Best value',
  },
];

/** Display copy for the web paywall (amounts come from Stripe Checkout). */
export function getStripePlanDisplays(): StripePlanDisplay[] {
  const raw = (process.env.EXPO_PUBLIC_STRIPE_PLAN_LABELS ?? '').trim();
  if (!raw) return DEFAULT_PLANS;
  try {
    const parsed = JSON.parse(raw) as StripePlanDisplay[];
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    /* use defaults */
  }
  return DEFAULT_PLANS;
}

/** Hosted Checkout only needs Supabase + Edge secrets; publishable key optional (future Payment Element). */
export function isStripeWebBillingConfigured(): boolean {
  if ((process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '').trim()) return true;
  return isSupabaseConfigured();
}

export function getStripeCheckoutReturnBaseUrl(): string {
  const web = getDaltonWebUrl();
  const basePath = (process.env.EXPO_PUBLIC_WEB_BASE_PATH ?? '/app').replace(/\/$/, '');
  if (web) return `${web}${basePath}`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}${basePath}`;
  }
  return '';
}

export type StartStripeCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/** Mandatory academy access (£2/mo) — configure STRIPE_PRICE_ACCESS_MONTHLY_ID in Supabase secrets. */
export function getAcademyAccessPlanLine(): string {
  return (process.env.EXPO_PUBLIC_ACADEMY_ACCESS_PRICE_LABEL ?? '£2 / month').trim() || '£2 / month';
}

/** Creates a Stripe Checkout session via Supabase Edge Function (secret key stays server-side). */
export async function startStripeCheckout(plan: StripePlanKey): Promise<StartStripeCheckoutResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: 'Sign in is required before subscribing.' };
  }

  const returnBase = getStripeCheckoutReturnBaseUrl();
  const { data, error } = await supabase.functions.invoke('stripe-create-checkout', {
    body: {
      plan,
      success_url: returnBase ? `${returnBase}?stripe_checkout=success` : undefined,
      cancel_url: returnBase ? `${returnBase}?stripe_checkout=cancel` : undefined,
    },
  });

  if (error) {
    let detail = error.message || 'Could not start checkout.';
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const body = (await ctx.json()) as { error?: string; hint?: string; code?: string };
        if (body?.error) {
          detail = body.error;
          if (body.hint === 'stripe_mode_mismatch') {
            detail +=
              ' Use Stripe test mode end-to-end: sk_test_ secret and test price IDs in Supabase secrets.';
          }
        }
      } catch {
        /* keep generic message */
      }
    }
    return { ok: false, error: detail };
  }

  const url = typeof data?.url === 'string' ? data.url : '';
  if (!url) {
    const msg = typeof data?.error === 'string' ? data.error : 'Checkout URL missing.';
    return { ok: false, error: msg };
  }

  return { ok: true, url };
}

export function openStripeCheckoutUrl(url: string): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.assign(url);
    return;
  }
  // Native webview builds could use Linking.openURL(url) if you add expo-linking here later.
}
