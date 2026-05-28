import { getMasterDeleteUserEdgeUrl, getSupabaseAnonKey, getVerifyMasterPinEdgeUrl } from '../lib/env';
import { getSupabase } from '../lib/supabase';

/** Verify master PIN via Edge Function (avoids PostgREST RPC 404). Falls back to RPC if needed. */
export async function verifyMasterPin(
  pin: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' };

  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) return { ok: false, message: 'Sign in required.' };

  try {
    const res = await fetch(getVerifyMasterPinEdgeUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: getSupabaseAnonKey(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pin }),
    });
    const txt = await res.text();
    if (res.status === 404) {
      return verifyMasterPinRpc(supabase, pin);
    }
    if (!res.ok) {
      let msg = txt || res.statusText;
      try {
        const j = JSON.parse(txt) as { error?: string };
        if (j.error) msg = j.error;
      } catch {
        /* ignore */
      }
      if (msg === 'invalid_pin' || msg.includes('invalid')) {
        return { ok: false, message: 'Incorrect PIN.' };
      }
      if (msg === 'server_misconfigured') {
        return {
          ok: false,
          message:
            'Master PIN service is not deployed. Run: supabase functions deploy verify-master-pin',
        };
      }
      return { ok: false, message: msg };
    }
    const parsed = JSON.parse(txt) as { valid?: boolean };
    if (parsed.valid === true) return { ok: true };
    return { ok: false, message: 'Incorrect PIN.' };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Could not verify PIN.',
    };
  }
}

async function verifyMasterPinRpc(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  pin: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc('verify_master_pin', { pin });
  if (error) {
    const msg = error.message ?? 'Could not verify PIN.';
    if (msg.includes('404') || error.code === 'PGRST202') {
      return {
        ok: false,
        message:
          'Master PIN verification is unavailable. Deploy the verify-master-pin Edge Function in Supabase.',
      };
    }
    return { ok: false, message: msg };
  }
  if (data === true) return { ok: true };
  return { ok: false, message: 'Incorrect PIN.' };
}

export type PremiumAwaitingDaltonVerificationRow = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_pro: boolean;
  premium_updated_at: string | null;
};

export async function listPremiumAwaitingDaltonVerification(): Promise<
  PremiumAwaitingDaltonVerificationRow[]
> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('list_premium_awaiting_dalton_verification');
  if (error || !data) return [];
  return data as PremiumAwaitingDaltonVerificationRow[];
}

export async function masterGrantDaltonVerified(
  targetUserId: string,
  pin: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' };
  const { data, error } = await supabase.rpc('master_grant_dalton_verified', {
    target_user_id: targetUserId,
    pin,
  });
  if (error) {
    const msg = error.message ?? 'Could not verify user.';
    if (msg.includes('user_not_premium')) {
      return { ok: false, message: 'This account does not have an active Premium subscription.' };
    }
    if (msg.includes('invalid_pin') || msg.includes('verify_master_pin')) {
      return { ok: false, message: 'Incorrect PIN.' };
    }
    return { ok: false, message: msg };
  }
  if (data === true) return { ok: true };
  return { ok: false, message: 'Incorrect PIN or not authorized.' };
}

/** Requires deployed Edge Function `master-delete-user` + `SUPABASE_SERVICE_ROLE_KEY` secret. */
export async function masterDeleteUserAccount(
  targetUserId: string,
  pin: string,
): Promise<{ ok: boolean; message?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, message: 'Supabase not configured' };
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) return { ok: false, message: 'Not signed in' };
  try {
    const res = await fetch(getMasterDeleteUserEdgeUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: getSupabaseAnonKey(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ target_user_id: targetUserId, pin }),
    });
    const txt = await res.text();
    if (!res.ok) return { ok: false, message: txt || res.statusText };
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'network_error' };
  }
}
