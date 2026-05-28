import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { AppLoadingIndicator } from '../components/AppLoadingIndicator';
import { ScreenHeader } from '../components/ScreenHeader';
import { DS } from '../designSystem';
import { isSupabaseConfigured } from '../lib/env';
import { listHostEventDashboard, type HostEventDashboardRow } from '../roadmap/liveDataService';
import type { EventsStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<EventsStackParamList, 'HostEventDashboard'>;

function formatStartsAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function HostEventDashboardScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const live = isSupabaseConfigured() && user && !user.id.startsWith('demo-');
  const [rows, setRows] = useState<HostEventDashboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!live || !user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await listHostEventDashboard(user.id);
    setRows(data);
    setLoading(false);
  }, [live, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const totalBookings = rows.reduce((n, r) => n + r.bookingCount, 0);
  const totalChecked = rows.reduce((n, r) => n + r.checkedInCount, 0);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader title="Event dashboard" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lead}>
          Live totals from your hosted events and bookings. Tap an event to open check-in.
        </Text>
        {loading ? (
          <AppLoadingIndicator />
        ) : (
          <>
            <View style={styles.statGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statVal}>{rows.length}</Text>
                <Text style={styles.statLbl}>Your events</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statVal}>{totalBookings}</Text>
                <Text style={styles.statLbl}>Bookings</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statVal}>{totalChecked}</Text>
                <Text style={styles.statLbl}>Checked in</Text>
              </View>
            </View>
            <Text style={styles.section}>Events</Text>
            {rows.length === 0 ? (
              <Text style={styles.empty}>No hosted events yet. Create one from the Events tab.</Text>
            ) : (
              rows.map((r) => (
                <Pressable
                  key={r.eventId}
                  style={styles.row}
                  onPress={() =>
                    navigation.navigate('HostAttendeeScan', { selectedEventId: r.eventId })
                  }
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTxt}>{r.title}</Text>
                    <Text style={styles.rowMeta}>{formatStartsAt(r.startsAt)}</Text>
                  </View>
                  <Text style={styles.rowCount}>
                    {r.checkedInCount}/{r.bookingCount} in
                  </Text>
                </Pressable>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.color.background },
  body: { padding: DS.space.lg },
  lead: {
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.textMuted,
    lineHeight: 22,
    marginBottom: DS.space.xl,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DS.space.md,
    marginBottom: DS.space.xl,
  },
  statCard: {
    flex: 1,
    minWidth: '28%',
    backgroundColor: DS.color.surface,
    borderRadius: DS.radius.lg,
    padding: DS.space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.borderWhite5,
  },
  statVal: {
    fontFamily: DS.font.heading,
    fontSize: 22,
    color: DS.color.gold,
    letterSpacing: 1,
  },
  statLbl: {
    fontFamily: DS.font.body,
    fontSize: 11,
    color: DS.color.textMuted,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  section: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 13,
    color: DS.color.screenTitle,
    marginBottom: DS.space.md,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  empty: {
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.textMuted,
    lineHeight: 22,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: DS.space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.color.borderHairline,
    gap: DS.space.md,
  },
  rowTxt: { fontFamily: DS.font.bodyMedium, fontSize: 15, color: DS.color.text },
  rowMeta: { fontFamily: DS.font.body, fontSize: 12, color: DS.color.textMuted, marginTop: 4 },
  rowCount: { fontFamily: DS.font.body, fontSize: 13, color: DS.color.gold },
});
