import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Ensures new and legacy users have an explicit `dalton_verified` key in auth user_metadata
 * (defaults to false). Server-side, prefer `backend/auth_default_dalton_verified.sql` on auth.users.
 */
export async function ensureDefaultDaltonVerifiedMetadata(supabase: SupabaseClient): Promise<void> {
  try {
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user?.id) return;
    const meta = user.user_metadata as Record<string, unknown> | undefined;
    if (meta && Object.prototype.hasOwnProperty.call(meta, 'dalton_verified')) {
      return;
    }
    await supabase.auth.updateUser({
      data: { dalton_verified: false },
    });
  } catch {
    /* Session stays valid; metadata default is optional. */
  }
}

/**
 * Mirror `profiles.dalton_verified` into auth metadata when a master has approved the user.
 * Premium alone does not grant verification — masters approve via Master control.
 */
export async function syncDaltonVerifiedFromProfileIfPremium(
  supabase: SupabaseClient,
  _isPro: boolean,
): Promise<{ updated: boolean }> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user?.id) return { updated: false };

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('dalton_verified')
    .eq('id', user.id)
    .maybeSingle();

  if (profileErr || !profile?.dalton_verified) return { updated: false };

  const meta = user.user_metadata as Record<string, unknown> | undefined;
  if (meta?.dalton_verified === true || meta?.daltonVerified === true) {
    return { updated: false };
  }

  const { error: updErr } = await supabase.auth.updateUser({
    data: { dalton_verified: true },
  });
  return { updated: !updErr };
}
