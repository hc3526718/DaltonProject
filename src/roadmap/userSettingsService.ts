import { getSupabase } from '../lib/supabase';
import type { AccessibilityPrefsCloud } from '../lib/accessibilityPrefs';
import type { InAppNotifyPrefs } from '../lib/notificationBannerPrefs';

/** Stored in `user_settings.preferences` (JSON). */
export type UserPrefsDoc = {
  privacy?: {
    profile_public?: boolean;
    show_recent_results?: boolean;
    partner_analytics?: boolean;
  };
  notification_channels?: {
    push?: boolean;
    email?: boolean;
    event_reminders?: boolean;
    community_mentions?: boolean;
    /** Master accounts: sponsorship / media / event proposals */
    master_proposals?: boolean;
  };
  accessibility?: AccessibilityPrefsCloud;
  /** UUIDs the signed-in user has blocked from messaging. */
  blocked_user_ids?: string[];
  /** Saved media asset ids for the media library bookmark feature. */
  saved_media_ids?: string[];
  /** In-app banner category toggles (synced across devices). */
  in_app_notify?: InAppNotifyPrefs;
};

export const DEFAULT_USER_PREFS: UserPrefsDoc = {
  privacy: {
    profile_public: true,
    show_recent_results: true,
    partner_analytics: false,
  },
  notification_channels: {
    push: true,
    email: true,
    event_reminders: true,
    community_mentions: false,
    master_proposals: true,
  },
};

function mergePrefs(base: UserPrefsDoc, patch: Partial<UserPrefsDoc>): UserPrefsDoc {
  return {
    privacy: { ...base.privacy, ...patch.privacy },
    notification_channels: { ...base.notification_channels, ...patch.notification_channels },
    accessibility: { ...base.accessibility, ...patch.accessibility },
    blocked_user_ids: patch.blocked_user_ids ?? base.blocked_user_ids,
    saved_media_ids: patch.saved_media_ids ?? base.saved_media_ids,
    in_app_notify: patch.in_app_notify
      ? { ...base.in_app_notify, ...patch.in_app_notify }
      : base.in_app_notify,
  };
}

const RETRY_MS = [300, 1200, 2800];

async function upsertWithRetry(userId: string, preferences: Record<string, unknown>): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  for (let attempt = 0; attempt <= RETRY_MS.length; attempt++) {
    const { error } = await supabase.from('user_settings').upsert(
      {
        user_id: userId,
        preferences,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (!error) return true;
    const wait = RETRY_MS[attempt];
    if (wait == null) break;
    await new Promise((r) => setTimeout(r, wait));
  }
  return false;
}

/** Load merged preferences doc (defaults + stored JSON). */
export async function fetchUserPrefsDoc(userId: string): Promise<UserPrefsDoc> {
  const supabase = getSupabase();
  if (!supabase) return { ...DEFAULT_USER_PREFS };
  const { data, error } = await supabase
    .from('user_settings')
    .select('preferences')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return { ...DEFAULT_USER_PREFS };
  const raw = (data as { preferences: unknown }).preferences;
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_USER_PREFS };
  const p = raw as Record<string, unknown>;
  const privacy = (p.privacy as UserPrefsDoc['privacy']) ?? {};
  const notification_channels = (p.notification_channels as UserPrefsDoc['notification_channels']) ?? {};
  const accessibility = (p.accessibility as UserPrefsDoc['accessibility']) ?? {};
  const in_app_notify = (p.in_app_notify as UserPrefsDoc['in_app_notify']) ?? undefined;
  const blocked_user_ids = Array.isArray(p.blocked_user_ids)
    ? (p.blocked_user_ids as string[]).filter((id) => typeof id === 'string')
    : undefined;
  return mergePrefs(DEFAULT_USER_PREFS, {
    privacy: { ...privacy, profile_public: true },
    notification_channels,
    accessibility,
    ...(in_app_notify ? { in_app_notify } : {}),
    ...(blocked_user_ids ? { blocked_user_ids } : {}),
  });
}

/** Merge a partial patch, persist with retries. Fetches current row first so nested keys are not dropped. */
export async function patchUserPrefsDoc(userId: string, patch: Partial<UserPrefsDoc>): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { data } = await supabase.from('user_settings').select('preferences').eq('user_id', userId).maybeSingle();
  let base: UserPrefsDoc = { ...DEFAULT_USER_PREFS };
  if (data && typeof (data as { preferences: unknown }).preferences === 'object') {
    const raw = (data as { preferences: Record<string, unknown> }).preferences;
    const privacy = (raw.privacy as UserPrefsDoc['privacy']) ?? {};
    const notification_channels =
      (raw.notification_channels as UserPrefsDoc['notification_channels']) ?? {};
    const accessibility = (raw.accessibility as UserPrefsDoc['accessibility']) ?? {};
    const in_app_notify = (raw.in_app_notify as UserPrefsDoc['in_app_notify']) ?? undefined;
    const blocked_user_ids = Array.isArray(raw.blocked_user_ids)
      ? (raw.blocked_user_ids as string[]).filter((id) => typeof id === 'string')
      : undefined;
    base = mergePrefs(DEFAULT_USER_PREFS, {
      privacy,
      notification_channels,
      accessibility,
      ...(in_app_notify ? { in_app_notify } : {}),
      ...(blocked_user_ids ? { blocked_user_ids } : {}),
    });
  }
  const merged = mergePrefs(base, patch);
  merged.privacy = { ...merged.privacy, profile_public: true };
  return upsertWithRetry(userId, merged as unknown as Record<string, unknown>);
}
