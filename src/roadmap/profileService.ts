import { getSupabase } from '../lib/supabase';
import type { ProfileRow } from './types';

/**
 * Load the signed-in user’s profile row (call after `getSession` / `onAuthStateChange`).
 * Wire into `AuthProvider` when you want onboarding + display name hydrated from DB.
 */
export async function fetchProfileByUserId(userId: string): Promise<ProfileRow | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error || !data) return null;
  return data as ProfileRow;
}

/**
 * Ensure profile exists after OAuth / email sign-up (server trigger preferred; this is a client fallback).
 */
export async function ensureProfileRow(userId: string, emailHint: string | null): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const display = emailHint?.split('@')[0]?.trim() || 'Member';
  await supabase.from('profiles').upsert(
    { id: userId, display_name: display },
    { onConflict: 'id' },
  );
}

export async function updateProfileBasics(
  userId: string,
  patch: {
    first_name: string;
    last_name: string;
    display_name: string;
    username: string;
    sports: string[];
  },
): Promise<{ ok: true; profile: ProfileRow } | { ok: false; error: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Not connected.' };
  const { data, error } = await supabase
    .from('profiles')
    .update({
      first_name: patch.first_name,
      last_name: patch.last_name,
      display_name: patch.display_name,
      username: patch.username,
      sports: patch.sports,
    })
    .eq('id', userId)
    .select('*')
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Could not save profile.' };
  }
  return { ok: true, profile: data as ProfileRow };
}

export type AthleteDetails = {
  discipline: string;
  level: string;
  team: string;
  coach: string;
  badges: Record<string, boolean>;
};

export async function updateProfileAthleteDetails(
  userId: string,
  details: AthleteDetails,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Not connected.' };
  const { error } = await supabase
    .from('profiles')
    .update({
      athlete_details: details,
      primary_sport: details.discipline.trim() || null,
    })
    .eq('id', userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateProfileAllowMessagesFrom(
  userId: string,
  value: 'everyone' | 'followers_only' | 'friends_only',
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase
    .from('profiles')
    .update({ allow_messages_from: value })
    .eq('id', userId);
  return !error;
}
