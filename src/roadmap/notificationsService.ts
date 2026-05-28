import { getSupabase } from '../lib/supabase';
import type { PushDeviceRow } from './types';

/** Persist Expo push token for targeted notifications (requires `device_push_tokens` table — see SQL stub). */
export async function registerDevicePushToken(
  userId: string,
  expoPushToken: string,
  platform: PushDeviceRow['platform'],
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from('device_push_tokens').upsert(
    {
      user_id: userId,
      expo_push_token: expoPushToken,
      platform,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  return !error;
}

export type InAppNotification = {
  id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  link_type?: string | null;
  link_id?: string | null;
};

/** Requires `in_app_notifications` in `backend/roadmap_extensions.sql` + RLS in `rls_policies.sql`. */
export async function listInAppNotifications(userId: string, limit = 50): Promise<InAppNotification[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('in_app_notifications')
    .select('id, title, body, read_at, created_at, link_type, link_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as InAppNotification[];
}

export async function markInAppNotificationRead(userId: string, id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase
    .from('in_app_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);
  return !error;
}

export async function markAllInAppNotificationsRead(userId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase
    .from('in_app_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
  return !error;
}

/** Remove every in-app notification for this user (requires delete RLS policy). */
export async function clearInAppNotifications(userId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from('in_app_notifications').delete().eq('user_id', userId);
  return !error;
}
