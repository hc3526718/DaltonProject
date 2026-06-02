import { useEffect, useRef, useCallback } from 'react';
import { Alert, AppState, Platform, Vibration } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { isSupabaseConfigured } from '../lib/env';
import { getSupabase } from '../lib/supabase';
import { openCommunityMessageThread, openCommunityMessagesInbox } from '../navigation/rootNavigationRef';
import type { InAppNotification } from '../roadmap/notificationsService';
import {
  isInAppBannerAllowed,
  loadInAppNotifyPrefs,
} from '../lib/notificationBannerPrefs';
import { isPushDeliveryEnabled } from '../lib/pushPrefsGate';
import { isMasterControlUser } from '../lib/notifyPrefsAccess';
import { fetchUserPrefsDoc } from '../roadmap/userSettingsService';
import { listInAppNotifications } from '../roadmap/notificationsService';

function isDmLikeNotification(n: Pick<InAppNotification, 'title' | 'link_type'>): boolean {
  const lt = (n.link_type ?? '').toLowerCase();
  if (lt === 'conversation' || lt === 'dm' || lt === 'message') return true;
  const title = (n.title ?? '').toLowerCase();
  return title.includes('message') || title.includes('messaged');
}

function buzz(): void {
  if (Platform.OS === 'android') {
    try {
      void Vibration.vibrate(280);
    } catch {
      /* ignore */
    }
  }
}

function navigateToNotificationDm(n: InAppNotification): void {
  const id = (n.link_id ?? '').trim();
  const lt = (n.link_type ?? '').toLowerCase();
  if (id && (lt === 'conversation' || lt === 'dm' || lt === 'message')) {
    openCommunityMessageThread(id);
    return;
  }
  openCommunityMessagesInbox();
}

/**
 * Alerts for new DM-style in-app notifications + one catch-up prompt after signing in with unread DM rows.
 * Mounted beside `AppNavigator` so it uses `rootNavigationRef` (outside the tab tree).
 */
export function ConversationInAppAlerts() {
  const { user } = useAuth();
  const alertedIdsRef = useRef<Set<string>>(new Set());
  const prevUserRef = useRef<string | null>(null);

  const showThreadAlert = useCallback(async (n: InAppNotification) => {
    const prefs = await loadInAppNotifyPrefs();
    const isMaster = isMasterControlUser(user);
    if (!isInAppBannerAllowed('messages', prefs, isMaster)) return;

    if (user?.id && !user.id.startsWith('demo-')) {
      const doc = await fetchUserPrefsDoc(user.id);
      if (doc.notification_channels?.push === false) return;
      if (!isPushDeliveryEnabled()) return;
    }

    const title = n.title?.trim() || 'New message';
    const subtitle = (n.body ?? '').trim();
    buzz();
    Alert.alert(title, subtitle || 'Open your messages to reply.', [
      { text: 'Dismiss', style: 'cancel', onPress: () => undefined },
      {
        text: 'Open conversation',
        onPress: () => {
          navigateToNotificationDm(n);
        },
      },
    ]);
  }, [user]);

  useEffect(() => {
    if (!user?.id || user.id.startsWith('demo-') || !isSupabaseConfigured()) {
      prevUserRef.current = user?.id ?? null;
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      prevUserRef.current = user?.id ?? null;
      return;
    }

    const justSignedIn = prevUserRef.current !== user.id;
    prevUserRef.current = user.id;

    if (justSignedIn) {
      void listInAppNotifications(user.id, 40).then((rows) => {
        const unreadDm = rows.find((n) => !n.read_at && isDmLikeNotification(n) && (n.link_id ?? '').trim());
        if (!unreadDm || alertedIdsRef.current.has(unreadDm.id)) return;
        alertedIdsRef.current.add(unreadDm.id);
        void showThreadAlert(unreadDm);
      });
    }

    const channel = supabase
      .channel(`dm-inapp-alerts-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'in_app_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as InAppNotification | null;
          if (!row?.id) return;
          if (alertedIdsRef.current.has(row.id)) return;
          if (!isDmLikeNotification(row)) return;
          if (AppState.currentState !== 'active') return;
          alertedIdsRef.current.add(row.id);
          void showThreadAlert(row);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, showThreadAlert]);

  return null;
}
