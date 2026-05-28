import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '../lib/supabase';

export type SubscriptionStateRow = {
  is_pro: boolean;
  is_payment_verified: boolean;
  entitlement_ids: string[] | null;
  updated_at: string | null;
};

/** `null` = no row yet (webhook not run); `true` / `false` = server mirror. */
export async function fetchSubscriptionStateIsPro(
  supabase?: SupabaseClient | null,
): Promise<boolean | null> {
  const row = await fetchSubscriptionStateRow(supabase);
  if (!row) return null;
  return row.is_pro;
}

/** Mandatory £2 academy access — server truth from Stripe / RevenueCat webhooks. */
export async function fetchSubscriptionStatePaymentVerified(
  supabase?: SupabaseClient | null,
): Promise<boolean | null> {
  const row = await fetchSubscriptionStateRow(supabase);
  if (!row) return null;
  return row.is_payment_verified;
}

export async function fetchSubscriptionStateRow(
  supabase?: SupabaseClient | null,
): Promise<SubscriptionStateRow | null> {
  const client = supabase ?? getSupabase();
  if (!client) return null;

  const {
    data: { user },
    error: userErr,
  } = await client.auth.getUser();
  if (userErr || !user?.id) return null;

  const { data, error } = await client
    .from('subscription_state')
    .select('is_pro, is_payment_verified, entitlement_ids, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) return null;
  return {
    is_pro: data.is_pro === true,
    is_payment_verified: data.is_payment_verified === true,
    entitlement_ids: Array.isArray(data.entitlement_ids) ? data.entitlement_ids : null,
    updated_at: typeof data.updated_at === 'string' ? data.updated_at : null,
  };
}
