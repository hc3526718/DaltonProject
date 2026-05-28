import { getSupabase } from '../lib/supabase';
import type { UserSettingsRow } from './types';

const DEFAULT_PREFS: UserSettingsRow['preferences'] = {
  notifications_enabled: true,
  marketing_email: false,
};

export async function getUserSettings(userId: string): Promise<UserSettingsRow | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle();
  if (error || !data) {
    return { user_id: userId, preferences: { ...DEFAULT_PREFS }, updated_at: new Date().toISOString() };
  }
  return data as UserSettingsRow;
}

export async function updateUserSettings(
  userId: string,
  preferences: Partial<UserSettingsRow['preferences']>,
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const current = await getUserSettings(userId);
  const merged = { ...(current?.preferences ?? DEFAULT_PREFS), ...preferences };
  const { error } = await supabase.from('user_settings').upsert(
    { user_id: userId, preferences: merged, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  );
  return !error;
}
