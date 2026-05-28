import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { isSupabaseConfigured } from '../lib/env';
import {
  fetchActivitySnapshot,
  markMessagesSeen,
  markNotificationsSeen,
  type ActivitySnapshot,
} from '../lib/activityBadges';
import { getSupabase } from '../lib/supabase';

type ActivityBadgeContextValue = ActivitySnapshot & {
  refresh: () => Promise<void>;
  clearNotificationBadge: () => Promise<void>;
  clearMessageBadge: () => Promise<void>;
};

const ActivityBadgeContext = createContext<ActivityBadgeContextValue>({
  unreadNotifications: 0,
  unreadMessages: 0,
  refresh: async () => undefined,
  clearNotificationBadge: async () => undefined,
  clearMessageBadge: async () => undefined,
});

export function useActivityBadges(): ActivityBadgeContextValue {
  return useContext(ActivityBadgeContext);
}

export function ActivityBadgeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<ActivitySnapshot>({
    unreadNotifications: 0,
    unreadMessages: 0,
  });

  const refresh = useCallback(async () => {
    if (!user?.id || user.id.startsWith('demo-') || !isSupabaseConfigured()) {
      setSnapshot({ unreadNotifications: 0, unreadMessages: 0 });
      return;
    }
    const next = await fetchActivitySnapshot(user.id);
    setSnapshot(next);
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured()) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const channel = supabase
      .channel(`activity-badges-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'in_app_notifications', filter: `user_id=eq.${user.id}` },
        () => void refresh(),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, refresh]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const clearNotificationBadge = useCallback(async () => {
    await markNotificationsSeen();
    await refresh();
  }, [refresh]);

  const clearMessageBadge = useCallback(async () => {
    await markMessagesSeen();
    await refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      ...snapshot,
      refresh,
      clearNotificationBadge,
      clearMessageBadge,
    }),
    [snapshot, refresh, clearNotificationBadge, clearMessageBadge],
  );

  return <ActivityBadgeContext.Provider value={value}>{children}</ActivityBadgeContext.Provider>;
}
