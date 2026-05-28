import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured } from './env';
import { getSupabase } from './supabase';
import { listInAppNotifications } from '../roadmap/notificationsService';
import { listConversationSummaries } from '../roadmap/messagingService';
import { fetchUserPrefsDoc } from '../roadmap/userSettingsService';

const LAST_SEEN_KEY = 'dalton_activity_last_seen_v1';

export type ActivitySnapshot = {
  unreadNotifications: number;
  unreadMessages: number;
};

export type ActivityLastSeen = {
  notificationsAt: string | null;
  messagesAt: string | null;
};

export async function loadActivityLastSeen(): Promise<ActivityLastSeen> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SEEN_KEY);
    if (!raw) return { notificationsAt: null, messagesAt: null };
    const parsed = JSON.parse(raw) as ActivityLastSeen;
    return {
      notificationsAt: parsed.notificationsAt ?? null,
      messagesAt: parsed.messagesAt ?? null,
    };
  } catch {
    return { notificationsAt: null, messagesAt: null };
  }
}

export async function saveActivityLastSeen(patch: Partial<ActivityLastSeen>): Promise<void> {
  const prev = await loadActivityLastSeen();
  const next = { ...prev, ...patch };
  await AsyncStorage.setItem(LAST_SEEN_KEY, JSON.stringify(next));
}

function notificationCountsForPrefs(
  notifs: { read_at: string | null; created_at: string; link_type?: string | null; title?: string }[],
  prefs: Awaited<ReturnType<typeof fetchUserPrefsDoc>>,
  notificationsSince: number,
  isMasterAccount: boolean,
): number {
  const channels = prefs.notification_channels ?? {};
  return notifs.filter((n) => {
    if (n.read_at) return false;
    const ts = Date.parse(n.created_at);
    if (Number.isNaN(ts) || ts <= notificationsSince) return false;

    const lt = (n.link_type ?? '').toLowerCase();
    const title = (n.title ?? '').toLowerCase();

    if (lt === 'conversation' || lt === 'dm' || lt === 'message') return false;
    if (title.includes('new message')) return false;

    if (lt === 'proposal_outcome') return true;

    if (isMasterAccount && /^new (sponsorship|event|media) proposal\b/.test(title)) {
      return channels.master_proposals !== false;
    }

    if (lt === 'proposal' || lt === 'content_proposal') {
      return channels.master_proposals !== false;
    }
    if (lt === 'event' || /\bevent\b/.test(title)) {
      return channels.event_reminders !== false;
    }
    if (lt === 'post' || title.includes('mention') || title.includes('@')) {
      return channels.community_mentions === true;
    }

    return channels.push !== false;
  }).length;
}

export async function fetchActivitySnapshot(userId: string): Promise<ActivitySnapshot> {
  if (!userId || userId.startsWith('demo-') || !isSupabaseConfigured()) {
    return { unreadNotifications: 0, unreadMessages: 0 };
  }
  const supabase = getSupabase();
  const [{ data: profileRow }, notifs, convos, prefs, lastSeen] = await Promise.all([
    supabase
      ? supabase.from('profiles').select('master_control').eq('id', userId).maybeSingle()
      : Promise.resolve({ data: null as { master_control?: string } | null }),
    listInAppNotifications(userId, 80),
    listConversationSummaries(userId),
    fetchUserPrefsDoc(userId),
    loadActivityLastSeen(),
  ]);

  const isMaster = profileRow?.master_control === 'yes';
  const notificationsSince = lastSeen.notificationsAt ? Date.parse(lastSeen.notificationsAt) : 0;
  const messagesSince = lastSeen.messagesAt ? Date.parse(lastSeen.messagesAt) : 0;

  const unreadNotifications = notificationCountsForPrefs(
    notifs,
    prefs,
    notificationsSince,
    isMaster,
  );

  const unreadMessages = convos.filter((c) => {
    if (!c.last_at || !c.last_sender_id) return false;
    if (c.last_sender_id === userId) return false;
    const ts = Date.parse(c.last_at);
    return ts > messagesSince;
  }).length;

  return { unreadNotifications, unreadMessages };
}

/** Call when user opens notifications list — clears notification badge. */
export async function markNotificationsSeen(): Promise<void> {
  await saveActivityLastSeen({ notificationsAt: new Date().toISOString() });
}

/** Call when user opens messages inbox — clears message badge. */
export async function markMessagesSeen(): Promise<void> {
  await saveActivityLastSeen({ messagesAt: new Date().toISOString() });
}
