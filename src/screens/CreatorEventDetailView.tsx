import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandLogo } from '../components/BrandLogo';
import { AppleHeroButton } from '../components/AppleHeroButton';
import { OptionMenuModal } from '../components/OptionMenuModal';
import { EventDetailSections } from '../components/EventDetailSections';
import { DS } from '../designSystem';
import { formatEntryPaymentNotice } from '../lib/eventEntryPayment';
import { resolveEventPresentation } from '../lib/eventDescriptionParse';
import type { EventsStackParamList } from '../navigation/types';
import type { EventReviewRow, EventRow } from '../roadmap/types';
import {
  listBookingsForEventHost,
  listEventReviewsForHost,
  subscribeBookingsForEvent,
  type HostBookingRosterRow,
} from '../roadmap/liveDataService';
import { isSupabaseConfigured } from '../lib/env';
import { useAuth } from '../auth/AuthContext';
import { eventEffectiveEndMs, isEventArchivedForBrowse, reviewsUnlockAtMs } from '../lib/eventTiming';

const DEFAULT_HERO =
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=600&auto=format&fit=crop';

function formatSchedule(ev: EventRow): string {
  const start = new Date(ev.starts_at);
  if (Number.isNaN(start.getTime())) return ev.title;
  const dateFmt: Intl.DateTimeFormatOptions = {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  };
  const timeFmt: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  const d = start.toLocaleDateString(undefined, dateFmt);
  const t1 = start.toLocaleTimeString(undefined, timeFmt);
  const end = ev.ends_at ? new Date(ev.ends_at) : null;
  const t2 =
    end && !Number.isNaN(end.getTime()) ? end.toLocaleTimeString(undefined, timeFmt) : null;
  return t2 ? `${d} · ${t1} – ${t2}` : `${d} · ${t1}`;
}

function formatReviewsUnlock(scheduleEndsMs: number): string {
  return new Date(scheduleEndsMs).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

type Nav = NativeStackNavigationProp<EventsStackParamList>;

type Props = {
  navigation: Nav;
  event: EventRow;
  onShare?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
};

export function CreatorEventDetailView({ navigation, event, onShare, onEdit, onDelete }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const live = isSupabaseConfigured() && user && !user.id.startsWith('demo-');
  const hero = event.hero_image_url?.trim() || DEFAULT_HERO;
  const [roster, setRoster] = useState<HostBookingRosterRow[]>([]);
  const [reviewsTick, setReviewsTick] = useState(0);
  const [reviews, setReviews] = useState<EventReviewRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const endMs = useMemo(() => eventEffectiveEndMs(event), [event.starts_at, event.ends_at]);
  const archived = useMemo(() => isEventArchivedForBrowse(event), [event.starts_at, event.ends_at]);
  const reviewsGateMs = useMemo(() => reviewsUnlockAtMs(event), [event.starts_at, event.ends_at]);
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);
  const reviewsUnlocked = clock >= reviewsGateMs;

  const loadRoster = useCallback(async () => {
    if (!live) return;
    const rows = await listBookingsForEventHost(event.id);
    setRoster(rows);
  }, [event.id, live]);

  const loadReviews = useCallback(async () => {
    if (!live || !reviewsUnlocked) return;
    setReviews(await listEventReviewsForHost(event.id));
  }, [event.id, live, reviewsUnlocked, reviewsTick]);

  useFocusEffect(
    useCallback(() => {
      void loadRoster();
    }, [loadRoster]),
  );

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  useEffect(() => {
    if (!live) return undefined;
    return subscribeBookingsForEvent(event.id, () => {
      void loadRoster();
      setReviewsTick((x) => x + 1);
    });
  }, [event.id, live, loadRoster]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRoster();
    await loadReviews();
    setRefreshing(false);
  }, [loadRoster, loadReviews]);

  const checkedInCount = roster.filter((r) => r.checkedInAt).length;

  const reviewAvg =
    reviews.length === 0
      ? null
      : reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length;

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.roundBtn} onPress={() => navigation.goBack()}>
          <FontAwesome name="arrow-left" size={18} color={DS.color.text} />
        </Pressable>
        <Text style={styles.topBadge}>HOST DASHBOARD</Text>
        {user?.masterControl ? (
          <Pressable
            style={styles.roundBtn}
            onPress={() => setMenuOpen(true)}
            accessibilityLabel="Event options"
          >
            <FontAwesome name="ellipsis-v" size={18} color={DS.color.text} />
          </Pressable>
        ) : (
          <Pressable
            style={styles.roundBtn}
            onPress={
              onShare ??
              (() =>
                void Share.share({
                  message: `${event.title} — Dalton Grant Sports`,
                }).catch(() => undefined))
            }
            accessibilityLabel="Share event"
          >
            <FontAwesome name="share-alt" size={16} color={DS.color.text} />
          </Pressable>
        )}
      </View>
      <OptionMenuModal
        visible={menuOpen}
        title="Event"
        onClose={() => setMenuOpen(false)}
        options={[
          {
            key: 'edit',
            label: 'Edit event',
            onPress: () => {
              if (onEdit) {
                onEdit();
                return;
              }
              navigation.navigate('EditEvent', { eventId: event.id });
            },
          },
          {
            key: 'share',
            label: 'Share event',
            onPress: () => {
              if (onShare) onShare();
              else {
                void Share.share({
                  message: `${event.title} — Dalton Grant Sports`,
                }).catch(() => undefined);
              }
            },
          },
          {
            key: 'delete',
            label: 'Delete event',
            destructive: true,
            onPress: () => {
              if (onDelete) onDelete();
              else {
                Alert.alert('Delete event', 'Delete is not available here yet.');
              }
            },
          },
        ]}
      />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
      >
        <Image source={{ uri: hero }} style={styles.hero} resizeMode="cover" />
        <View style={styles.pad}>
          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.schedule}>{formatSchedule(event)}</Text>
          {event.venue ? (
            <View style={styles.inlineMeta}>
              <FontAwesome name="map-marker" size={12} color={DS.color.gold} />
              <Text style={styles.venue}>{event.venue}</Text>
            </View>
          ) : null}

          <View style={[styles.surface, archived ? styles.surfaceMuted : null]}>
            <Text style={styles.surfaceKicker}>{archived ? 'ARCHIVE & REVIEWS' : 'DAY-OF CONTROL'}</Text>
            {!archived ? (
              <>
                <Text style={styles.surfaceBody}>
                  Use QR scan to verify arrivals in real time. This list refreshes when you check someone in —
                  pull down anytime to reload.
                </Text>
                <AppleHeroButton
                  onPress={() => navigation.navigate('HostAttendeeScan', { selectedEventId: event.id })}
                  style={{ marginTop: DS.space.md }}
                >
                  <Text style={styles.heroBtn}>SCAN QR CHECK-INS</Text>
                </AppleHeroButton>
              </>
            ) : (
              <Text style={styles.surfaceBody}>
                This event has ended — it stays in your host archive here and under Past filters. Sharing is
                read-only except for reviewing feedback below.
              </Text>
            )}
          </View>

          <View style={styles.surface}>
            <EventDetailSections
              parsed={resolveEventPresentation(event.description, event.event_details)}
              entryPaymentLine={formatEntryPaymentNotice(
                event.entry_payment_mode ?? 'none',
                event.entry_payment_amount,
                event.entry_payment_note,
              )}
            />
          </View>

          <Text style={styles.sectionK}>REGISTRATIONS</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{roster.length}</Text>
              <Text style={styles.statLbl}>signed up</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNum, { color: DS.color.onlineGreen }]}>{checkedInCount}</Text>
              <Text style={styles.statLbl}>checked in</Text>
            </View>
          </View>
          <View style={styles.surface}>
            {roster.length === 0 ? (
              <Text style={styles.muted}>No bookings yet. Share your event link to fill seats.</Text>
            ) : (
              roster.map((r, i) => (
                <View
                  key={r.bookingId}
                  style={[styles.rosterRow, i < roster.length - 1 ? styles.rosterDivider : null]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rosterName}>{r.attendeeDisplayName}</Text>
                    <Text style={styles.rosterRef}>{r.reference}</Text>
                  </View>
                  <View style={[styles.pill, r.checkedInAt ? styles.pillOn : null]}>
                    <Text style={[styles.pillTxt, r.checkedInAt ? styles.pillTxtOn : null]}>
                      {r.checkedInAt ? 'IN' : 'PENDING'}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          <Text style={styles.sectionK}>ATTENDEE REVIEWS</Text>
          <View style={styles.surface}>
            {!reviewsUnlocked ? (
              <>
                <Text style={styles.muted}>
                  Collecting feedback unlocks{' '}
                  <Text style={styles.bold}>one hour after the scheduled end </Text>
                  of this event (~{formatReviewsUnlock(endMs)}, then +1 hr).
                </Text>
                <View style={{ height: DS.space.sm }} />
                <View style={{ opacity: 0.35, alignSelf: 'center' }}>
                  <BrandLogo width={72} height={72} />
                </View>
              </>
            ) : reviews.length === 0 ? (
              <Text style={styles.muted}>
                No submissions yet — remind athletes to tap “Submit review” on their confirmation screen after they
                check in.
              </Text>
            ) : (
              <>
                <View style={styles.reviewBanner}>
                  <Text style={styles.reviewBannerNum}>{reviewAvg?.toFixed(1)}★</Text>
                  <Text style={styles.reviewBannerSub}>{reviews.length} review{reviews.length === 1 ? '' : 's'}</Text>
                </View>
                {reviews.map((rev, idx) => (
                  <View
                    key={rev.id}
                    style={[styles.reviewItem, idx < reviews.length - 1 ? styles.rosterDivider : null]}
                  >
                    <Text style={styles.reviewStars}>
                      {'★'.repeat(rev.rating)}
                      {'☆'.repeat(5 - rev.rating)}
                    </Text>
                    {rev.comment ? <Text style={styles.reviewNote}>{rev.comment}</Text> : null}
                  </View>
                ))}
              </>
            )}
          </View>

          <Pressable
            style={styles.hostHelp}
            onPress={() => {
              const q = encodeURIComponent(event.venue ?? '');
              void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
            }}
          >
            <FontAwesome5 name="location-arrow" size={14} color={DS.color.gold} />
            <Text style={styles.hostHelpTxt}>Open venue in Maps</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.color.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DS.space.base,
    marginBottom: 4,
  },
  roundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: DS.color.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBadge: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 11,
    color: DS.color.gold,
    letterSpacing: 3,
  },
  hero: { width: '100%', height: 180, opacity: 0.95 },
  pad: { paddingHorizontal: DS.space.lg },
  title: {
    marginTop: DS.space.lg,
    fontFamily: DS.font.heading,
    fontSize: 26,
    color: DS.color.gold,
    letterSpacing: 1,
    textAlign: 'center',
  },
  schedule: {
    marginTop: DS.space.sm,
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.textMuted,
    textAlign: 'center',
  },
  venue: {
    flex: 1,
    marginLeft: 6,
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.text,
  },
  inlineMeta: { flexDirection: 'row', alignItems: 'center', marginTop: DS.space.md, justifyContent: 'center' },
  sectionK: {
    marginTop: DS.space.xl,
    marginBottom: DS.space.sm,
    fontFamily: DS.font.bodyMedium,
    fontSize: 11,
    color: DS.color.screenTitle,
    letterSpacing: 3,
  },
  surface: {
    backgroundColor: DS.color.surface,
    borderRadius: DS.radius.lg,
    padding: DS.space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.borderWhite5,
  },
  surfaceMuted: { opacity: 0.98 },
  surfaceKicker: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 12,
    color: DS.color.gold,
    marginBottom: DS.space.sm,
    letterSpacing: 2,
  },
  surfaceBody: {
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.textMuted,
    lineHeight: 22,
  },
  heroBtn: {
    fontFamily: DS.font.bodyBold,
    fontSize: 14,
    color: DS.color.background,
    letterSpacing: 1,
  },
  agenda: { fontFamily: DS.font.body, fontSize: 14, color: DS.color.text, lineHeight: 22 },
  muted: { fontFamily: DS.font.body, fontSize: 14, color: DS.color.textMuted, lineHeight: 22 },
  bold: { fontFamily: DS.font.bodyMedium, color: DS.color.text },
  statsRow: { flexDirection: 'row', gap: DS.space.md, marginBottom: DS.space.md },
  statBox: {
    flex: 1,
    backgroundColor: DS.color.surface,
    borderRadius: DS.radius.md,
    padding: DS.space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.borderWhite5,
  },
  statNum: { fontFamily: DS.font.heading, fontSize: 22, color: DS.color.gold },
  statLbl: { fontFamily: DS.font.body, fontSize: 11, color: DS.color.textMuted, marginTop: 4 },
  rosterRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: DS.space.sm },
  rosterDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DS.color.borderHairline },
  rosterName: { fontFamily: DS.font.bodyMedium, fontSize: 15, color: DS.color.text },
  rosterRef: { fontFamily: DS.font.body, fontSize: 12, color: DS.color.textMuted, marginTop: 2 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: DS.color.surfaceAlt,
    borderWidth: 1,
    borderColor: DS.color.borderWhite5,
  },
  pillOn: { backgroundColor: `${DS.color.onlineGreen}22`, borderColor: DS.color.onlineGreen },
  pillTxt: { fontFamily: DS.font.bodyMedium, fontSize: 11, color: DS.color.textMuted },
  pillTxtOn: { color: DS.color.onlineGreen },
  reviewBanner: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: DS.space.md,
    marginBottom: DS.space.md,
  },
  reviewBannerNum: { fontFamily: DS.font.heading, fontSize: 24, color: DS.color.gold },
  reviewBannerSub: { fontFamily: DS.font.body, fontSize: 13, color: DS.color.textMuted },
  reviewItem: { paddingVertical: DS.space.sm },
  reviewStars: { fontFamily: DS.font.body, fontSize: 14, color: DS.color.gold, marginBottom: 4 },
  reviewNote: { fontFamily: DS.font.body, fontSize: 14, color: DS.color.text, lineHeight: 20 },
  hostHelp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    marginTop: DS.space.xl,
    justifyContent: 'center',
  },
  hostHelpTxt: { fontFamily: DS.font.body, fontSize: 14, color: DS.color.textMuted },
});
