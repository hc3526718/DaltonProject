import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { isPushDeliveryEnabled } from '../lib/pushPrefsGate';
import { isSupabaseConfigured } from '../lib/env';
import { getSupabase } from '../lib/supabase';

/**
 * When the app is backgrounded, request server-side Expo push for new in-app notification rows.
 * Foreground alerts stay in ConversationInAppAlerts / EventInAppAlerts.
 */
export function NotificationPushRelay() {
  const { user } = useAuth();
  const dispatchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id || user.id.startsWith('demo-') || !isSupabaseConfigured()) return;
    const supabase = getSupabase();
    if (!supabase) return;

    const channel = supabase
      .channel(`push-relay-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'in_app_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as { id?: string } | null;
          const id = row?.id?.trim();
          if (!id || dispatchedRef.current.has(id)) return;
          if (!isPushDeliveryEnabled()) return;
          if (AppState.currentState === 'active') return;

          dispatchedRef.current.add(id);
          void supabase.functions
            .invoke('dispatch-in-app-push', { body: { notification_id: id } })
            .catch(() => {
              dispatchedRef.current.delete(id);
            });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return null;
}
