import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { DS } from '../designSystem';
import { isSupabaseConfigured } from '../lib/env';
import { getSupabase } from '../lib/supabase';
import type { EventsStackParamList } from '../navigation/types';
import { listAllEvents } from '../roadmap/liveDataService';
import type { EventRow } from '../roadmap/types';
import {
  hasPremiumOrAdminTier,
  navigateToPremiumPaywall,
} from '../subscriptions/navigateToPremiumPaywall';
import { presentPremiumPaywall } from '../subscriptions/presentPremiumPaywall';
import { useSubscription } from '../subscriptions/SubscriptionContext';

type Props = NativeStackScreenProps<EventsStackParamList, 'HostScanPickEvent'>;

export function HostScanPickEventScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isPro, refresh: refreshSubscription, notifyNewPremiumFromPaywall } = useSubscription();
  const premiumGate = hasPremiumOrAdminTier(isPro, user?.role);
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => {
    if (premiumGate) return;
    void (async () => {
      if (Platform.OS === 'web') {
        navigateToPremiumPaywall(navigation);
        return;
      }
      const { premiumActivated } = await presentPremiumPaywall(navigation);
      await refreshSubscription();
      if (premiumActivated) notifyNewPremiumFromPaywall(true);
      if (navigation.canGoBack()) navigation.goBack();
    })();
  }, [premiumGate, navigation, refreshSubscription, notifyNewPremiumFromPaywall]);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setRows([]);
      setLoading(false);
      return;
    }
    const s = getSupabase();
    if (!s) {
      setRows([]);
      setLoading(false);
      return;
    }
    const uid = (await s.auth.getUser()).data.user?.id;
    if (!uid) {
      setRows([]);
      setLoading(false);
      return;
    }
    const evs = await listAllEvents(250);
    const mine = evs.filter((e) => (e.created_by ?? '').trim() === uid);
    mine.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    setRows(mine);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!premiumGate) {
    return <View style={styles.root} />;
  }

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: insets.top + DS.space.sm }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
          <FontAwesome name="arrow-left" size={22} color={DS.color.text} />
        </Pressable>
        <Text style={styles.title}>SCAN ATTENDANCE</Text>
        <View style={{ width: 40 }} />
      </View>
      <Text style={styles.sub}>
        Choose which event you&apos;re checking people in for. The attendee&apos;s QR must match this event.
      </Text>
      {loading ? (
        <Text style={styles.muted}>Loading your events…</Text>
      ) : rows.length === 0 ? (
        <Text style={styles.muted}>You don&apos;t have any created events yet. Create an event first.</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ paddingBottom: 32 + insets.bottom, paddingHorizontal: DS.space.md }}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('HostAttendeeScan', { selectedEventId: item.id })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.rowMeta}>{new Date(item.starts_at).toLocaleString()}</Text>
              </View>
              <FontAwesome name="chevron-right" size={14} color={DS.color.textMuted} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.color.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DS.space.md,
    paddingBottom: DS.space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.color.borderHairline,
  },
  backBtn: { padding: DS.space.sm },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: DS.font.heading,
    fontSize: 14,
    letterSpacing: 1.6,
    color: DS.color.gold,
  },
  sub: {
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.textMuted,
    paddingHorizontal: DS.space.lg,
    paddingVertical: DS.space.md,
    lineHeight: 20,
  },
  muted: {
    paddingHorizontal: DS.space.lg,
    fontFamily: DS.font.body,
    color: DS.color.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    paddingVertical: DS.space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.color.borderHairline,
  },
  rowTitle: { fontFamily: DS.font.bodyMedium, fontSize: 16, color: DS.color.text },
  rowMeta: { fontFamily: DS.font.body, fontSize: 12, color: DS.color.textMuted, marginTop: 4 },
});
