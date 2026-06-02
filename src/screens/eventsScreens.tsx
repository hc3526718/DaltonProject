import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CommonActions, useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { saveTicketAsPdf, saveTicketAsPng } from '../lib/ticketExport';
import { useActionBanner } from '../actionBanner/ActionBannerContext';
import { useAuth } from '../auth/AuthContext';
import { signTicketPayload } from '../booking/ticketToken';
import {
  addRecentEventSearch,
  addSavedEventKey,
  getRecentEventSearches,
  getSavedEventKeys,
  isEventKeySaved,
  removeSavedEventKey,
  unifiedEventSlug,
} from '../lib/eventsStorage';
import { notifyBookingConfirmationEmail } from '../lib/bookingConfirmationEmail';
import { isSupabaseConfigured } from '../lib/env';
import { getSupabase } from '../lib/supabase';
import { AppLoadingIndicator } from '../components/AppLoadingIndicator';
import { ConfirmModal } from '../components/ConfirmModal';
import { AppleHeroButton } from '../components/AppleHeroButton';
import { BookingQrCode } from '../components/BookingQrCode';
import { OptionMenuModal } from '../components/OptionMenuModal';
import { PullRefreshRiveOverlay } from '../components/PullRefreshRiveOverlay';
import { DS, tabRootHeaderPadding, tabRootTitleText } from '../designSystem';
import type { IcsEventInput } from '../integrations/eventCalendar';
import { buildGoogleCalendarLink, shareEventAsIcs } from '../integrations/eventCalendar';
import type { HtmlEventCard } from '../data/upcomingEventsFromHtml';
import { UPCOMING_EVENTS_FROM_HTML } from '../data/upcomingEventsFromHtml';
import { useRefreshWithMinimum } from '../hooks/useRefreshWithMinimum';
import { pullRefreshControl } from '../lib/pullRefreshUi';
import { isEventArchivedForBrowse, reviewsUnlockAtMs } from '../lib/eventTiming';
import type { EventsBrowseFilterChip, EventsStackParamList } from '../navigation/types';
import {
  bookExistingEvent,
  createEventAndBooking,
  deleteCommunityEvent,
  fetchMyEventReview,
  findUserBookingForEvent,
  getEventById,
  subscribeEventById,
  invokeNotifyEventAttendees,
  listAllEvents,
  listBookingsWithEventsForUser,
  subscribeBookingByReference,
  upsertEventReview,
  type BookingWithEvent,
} from '../roadmap/liveDataService';
import { useSubscription } from '../subscriptions/SubscriptionContext';
import { hasPremiumOrAdminTier } from '../subscriptions/navigateToPremiumPaywall';
import { gatePremiumFeatureAccess } from '../subscriptions/premiumFeatureGate';
import { openEventCheckoutUrl, startEventStripeCheckout } from '../subscriptions/eventStripeCheckout';
import { formatEntryPaymentNotice } from '../lib/eventEntryPayment';
import { EventDetailSections } from '../components/EventDetailSections';
import {
  formatEventSpotsLabel,
  parseEventCapacity,
  resolveEventPresentation,
} from '../lib/eventDescriptionParse';
import { QR_SCAN_ICON } from './HostAttendeeScanScreen';
import { CreatorEventDetailView } from './CreatorEventDetailView';
import type { EventRow } from '../roadmap/types';
import { canCreateVerifiedContent } from '../creator/creatorAccess';

const eventCtaLabelStyle = {
  fontFamily: DS.font.bodyBold,
  fontSize: 15,
  color: DS.color.background,
  letterSpacing: 1,
  textTransform: 'uppercase' as const,
};

type EProps<K extends keyof EventsStackParamList> = NativeStackScreenProps<EventsStackParamList, K>;
type EventsNavigation = NativeStackNavigationProp<EventsStackParamList, keyof EventsStackParamList>;

const DEFAULT_HERO =
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=600&auto=format&fit=crop';

type EventBrowseFilter = EventsBrowseFilterChip;

/** Gold label for the active filter chip (ALL EVENTS, BOOKED, …). */
const FILTER_HEADING_LABEL: Record<EventBrowseFilter, string> = {
  all: 'ALL EVENTS',
  booked: 'BOOKINGS',
  saved: 'SAVED',
  past: 'PAST',
  my_events: 'My Events',
};

type BrowseEventRow = { kind: 'db'; row: EventRow } | { kind: 'html'; card: HtmlEventCard };

const HTML_MONTH: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function htmlCardApproxTs(card: HtmlEventCard): number {
  const head = card.date.split('•')[0]?.trim() ?? '';
  const [monRaw, dayRaw] = head.split(/\s+/);
  const mon = HTML_MONTH[monRaw?.slice(0, 3).toLowerCase() ?? ''];
  const day = Number.parseInt(dayRaw ?? '15', 10) || 15;
  if (mon === undefined) return Date.now() + 86400000;
  let y = new Date().getFullYear();
  let t = new Date(y, mon, day, 12, 0, 0, 0).getTime();
  while (t < Date.now() - 86400000 * 14) {
    y += 1;
    t = new Date(y, mon, day, 12, 0, 0, 0).getTime();
  }
  return t;
}

function formatDbScheduleLine(row: EventRow): string {
  const start = new Date(row.starts_at);
  if (Number.isNaN(start.getTime())) return row.title;
  const datePart = start.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const t0 = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const end = row.ends_at ? new Date(row.ends_at) : null;
  const t1 =
    end && !Number.isNaN(end.getTime())
      ? end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
      : '';
  return t1 ? `${datePart} • ${t0} - ${t1}` : `${datePart} • ${t0}`;
}

function browseRowStartsAt(row: BrowseEventRow): number {
  if (row.kind === 'db') return new Date(row.row.starts_at).getTime();
  return htmlCardApproxTs(row.card);
}

function browseRowIsArchived(row: BrowseEventRow, now: number): boolean {
  if (row.kind === 'db') return isEventArchivedForBrowse(row.row);
  return now >= htmlCardApproxTs(row.card) + 4 * 3600000;
}

function browseRowStorageKey(row: BrowseEventRow): string {
  if (row.kind === 'db') {
    return unifiedEventSlug({ source: 'db', id: row.row.id, title: row.row.title });
  }
  return unifiedEventSlug({ source: 'html', title: row.card.title, dateHint: row.card.date });
}

function mergeBrowseRows(db: EventRow[], html: HtmlEventCard[]): BrowseEventRow[] {
  const out: BrowseEventRow[] = [];
  const seen = new Set<string>();
  for (const row of db) {
    out.push({ kind: 'db', row });
    seen.add(row.title.trim().toLowerCase());
  }
  for (const card of html) {
    if (seen.has(card.title.trim().toLowerCase())) continue;
    out.push({ kind: 'html', card });
  }
  out.sort((a, b) => browseRowStartsAt(a) - browseRowStartsAt(b));
  return out;
}

/** Signed-in live sessions: DB-backed events only (no HTML demo cards). */
function browseRowsDbOnly(db: EventRow[]): BrowseEventRow[] {
  return [...db]
    .map((row) => ({ kind: 'db' as const, row }))
    .sort((a, b) => browseRowStartsAt(a) - browseRowStartsAt(b));
}

function rowMatchesBrowseFilter(
  row: BrowseEventRow,
  filter: EventBrowseFilter,
  ctx: {
    now: number;
    savedKeys: Set<string>;
    bookedEventIds: Set<string>;
    user: { id: string } | null | undefined;
  },
): boolean {
  const key = browseRowStorageKey(row);
  switch (filter) {
    case 'booked':
      return (
        row.kind === 'db' &&
        ctx.bookedEventIds.has(row.row.id) &&
        !browseRowIsArchived(row, ctx.now)
      );
    case 'saved':
      return ctx.savedKeys.has(key) && !browseRowIsArchived(row, ctx.now);
    case 'past':
      return browseRowIsArchived(row, ctx.now);
    case 'my_events':
      if (!ctx.user || row.kind !== 'db') return false;
      return (
        (row.row.created_by ?? '').trim() === ctx.user.id && !browseRowIsArchived(row, ctx.now)
      );
    case 'all':
    default:
      return !browseRowIsArchived(row, ctx.now);
  }
}

function splitUpcomingAndPast(
  rows: BrowseEventRow[],
  now: number,
): { upcoming: BrowseEventRow[]; past: BrowseEventRow[] } {
  const upcoming = rows.filter((r) => browseRowStartsAt(r) >= now);
  const past = rows.filter((r) => browseRowStartsAt(r) < now);
  upcoming.sort((a, b) => browseRowStartsAt(a) - browseRowStartsAt(b));
  past.sort((a, b) => browseRowStartsAt(b) - browseRowStartsAt(a));
  return { upcoming, past };
}

function openBrowseRow(navigation: EventsNavigation, row: BrowseEventRow) {
  if (row.kind === 'db') {
    const r = row.row;
    navigation.navigate('EventDetails', {
      title: r.title,
      imageUri: r.hero_image_url?.trim() || DEFAULT_HERO,
      dateShort: formatDbScheduleLine(r),
      sub: r.venue?.trim() || 'Dalton Sports',
      eventStorageKey: browseRowStorageKey(row),
      supabaseEventId: r.id,
    });
    return;
  }
  const c = row.card;
  navigation.navigate('EventDetails', {
    title: c.title,
    imageUri: c.uri,
    dateShort: c.date,
    sub: c.sub,
    eventStorageKey: browseRowStorageKey(row),
  });
}

function bookingToConfirmParams(b: BookingWithEvent) {
  const ev = b.event;
  const title = ev?.title ?? 'Your event';
  const imageUri = ev?.hero_image_url?.trim() || DEFAULT_HERO;
  const venue = ev?.venue?.trim() || 'Venue TBA';
  let recapDate = '';
  let recapTime = '';
  if (ev?.starts_at) {
    const start = new Date(ev.starts_at);
    if (!Number.isNaN(start.getTime())) {
      recapDate = start.toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      const end = ev.ends_at ? new Date(ev.ends_at) : null;
      const t0 = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      const t1 =
        end && !Number.isNaN(end.getTime())
          ? end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
          : '';
      recapTime = t1 ? `${t0} - ${t1}` : t0;
    }
  }
  return {
    reference: b.reference,
    bookingId: b.bookingId,
    eventId: b.eventId,
    title,
    imageUri,
    recapDate: recapDate || undefined,
    recapTime: recapTime || undefined,
    venue,
  };
}

function BrowseEventRowCell({
  row,
  onPress,
  ribbon,
}: {
  row: BrowseEventRow;
  onPress: () => void;
  ribbon?: string;
}) {
  const title = row.kind === 'db' ? row.row.title : row.card.title;
  const img = row.kind === 'db' ? row.row.hero_image_url?.trim() || DEFAULT_HERO : row.card.uri;
  const meta = row.kind === 'db' ? formatDbScheduleLine(row.row) : row.card.date;
  const sub = row.kind === 'db' ? row.row.venue?.trim() || '' : row.card.sub;
  return (
    <Pressable style={styles.evListCell} onPress={onPress}>
      <Image source={{ uri: img }} style={styles.evListThumb} />
      <View style={styles.evListTextCol}>
        <Text style={styles.evListTitle} numberOfLines={2}>
          {title.toUpperCase()}
        </Text>
        <Text style={styles.evListMeta} numberOfLines={2}>
          {meta}
        </Text>
        <Text style={styles.evListVenue} numberOfLines={2}>
          {sub.trim() ? sub : ' '}
        </Text>
        {ribbon ? <Text style={styles.evListRibbon}>{ribbon}</Text> : null}
      </View>
      <View style={styles.evListChevronCol}>
        <FontAwesome name="chevron-right" size={14} color={DS.color.textMuted} />
      </View>
    </Pressable>
  );
}

function BrowseEventRowsList({
  rows,
  navigation,
  browseFilter,
}: {
  rows: BrowseEventRow[];
  navigation: EventsNavigation;
  browseFilter?: EventBrowseFilter;
}) {
  const now = Date.now();
  return (
    <View style={styles.evListGap}>
      {rows.map((row) => {
        const ribbon =
          browseFilter === 'my_events' && row.kind === 'db'
            ? browseRowStartsAt(row) < now
              ? 'Your event · Past'
              : 'Your event · Current / upcoming'
            : undefined;
        return (
          <BrowseEventRowCell
            key={browseRowStorageKey(row)}
            row={row}
            ribbon={ribbon}
            onPress={() => openBrowseRow(navigation, row)}
          />
        );
      })}
    </View>
  );
}

export function UpcomingEventsScreen({ navigation }: EProps<'UpcomingEvents'>) {
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteProp<EventsStackParamList, 'UpcomingEvents'>>();
  const { user } = useAuth();
  const { isPro, refresh: refreshSubscription, notifyNewPremiumFromPaywall } = useSubscription();
  const premiumEventTools = Boolean(user?.masterControl) || user?.role === 'admin' || user?.role === 'super_admin';
  const canCreate = canCreateVerifiedContent(isPro, user);
  const demoSession = !user || user.id.startsWith('demo-');
  const liveListing =
    !demoSession && isSupabaseConfigured() && !!user && !user.id.startsWith('demo-');

  const [filter, setFilter] = useState<EventBrowseFilter>('all');
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [dbEvents, setDbEvents] = useState<EventRow[]>([]);
  const [bookings, setBookings] = useState<BookingWithEvent[]>([]);

  const refreshSavedKeys = useCallback(async () => {
    setSavedKeys(await getSavedEventKeys());
  }, []);

  const reloadData = useCallback(async () => {
    await refreshSavedKeys();
    if (demoSession || !isSupabaseConfigured() || !user) {
      setDbEvents([]);
      setBookings([]);
      return;
    }
    try {
      const [evs, bks] = await Promise.all([
        listAllEvents(100),
        listBookingsWithEventsForUser(user.id),
      ]);
      setDbEvents(evs);
      setBookings(bks);
      const { cacheBookedEvents } = await import('../lib/offline/eventsOffline');
      await cacheBookedEvents(user.id, bks);
    } catch {
      const { loadCachedBookedEvents } = await import('../lib/offline/eventsOffline');
      const cached = await loadCachedBookedEvents(user.id);
      if (cached?.length) setBookings(cached);
    }
  }, [demoSession, user, refreshSavedKeys]);

  const { refreshing, onRefresh } = useRefreshWithMinimum(reloadData, 4000);

  useFocusEffect(
    useCallback(() => {
      void reloadData();
    }, [reloadData]),
  );

  useEffect(() => {
    const f = route.params?.initialFilter;
    if (f) setFilter(f);
  }, [route.params?.initialFilter]);

  const showBanner = useActionBanner();
  useEffect(() => {
    const title = route.params?.createdEventTitle?.trim();
    if (!title) return;
    showBanner('Event published', title);
    navigation.setParams({ createdEventTitle: undefined });
  }, [route.params?.createdEventTitle, navigation, showBanner]);

  const mergedRows = useMemo(() => {
    if (isSupabaseConfigured()) return browseRowsDbOnly(dbEvents);
    return mergeBrowseRows(dbEvents, UPCOMING_EVENTS_FROM_HTML);
  }, [dbEvents]);

  const bookedEventIds = useMemo(() => new Set(bookings.map((b) => b.eventId)), [bookings]);

  const upcomingBookingsAnchored = useMemo(() => {
    const now = Date.now();
    return bookings
      .filter((b) => b.event && new Date(b.event.starts_at).getTime() >= now - 60000)
      .sort((a, b) => new Date(a.event!.starts_at).getTime() - new Date(b.event!.starts_at).getTime());
  }, [bookings]);

  const filterChips: { key: EventBrowseFilter }[] = useMemo(() => {
    const base: { key: EventBrowseFilter }[] = [
      { key: 'all' },
      { key: 'booked' },
      { key: 'saved' },
      { key: 'past' },
    ];
    if (user?.masterControl || user?.role === 'admin' || user?.role === 'super_admin') base.push({ key: 'my_events' });
    return base;
  }, [isPro, user?.masterControl]);

  const { upcoming: upcomingRows, past: pastRows } = useMemo(() => {
    const now = Date.now();
    const ctx = {
      now,
      savedKeys,
      bookedEventIds,
      user,
    };
    const qualified = mergedRows.filter((row) => rowMatchesBrowseFilter(row, filter, ctx));
    return splitUpcomingAndPast(qualified, now);
  }, [mergedRows, filter, savedKeys, bookedEventIds, user]);

  const listsEmpty = upcomingRows.length === 0 && pastRows.length === 0;
  const showUpcomingHeading = upcomingRows.length > 0 && filter !== 'past';
  const showPastHeading = pastRows.length > 0 && filter !== 'past';

  const firstAnchor = upcomingBookingsAnchored[0];

  return (
    <View style={styles.root}>
      <PullRefreshRiveOverlay visible={refreshing} topInset={insets.top} />
      <View
        style={[
          styles.eventsHeader,
          tabRootHeaderPadding,
          { paddingTop: insets.top + DS.space.md },
        ]}
      >
        <Text style={styles.eventsTitle}>EVENTS</Text>
        <View style={styles.eventsHeaderActions}>
          {canCreateVerifiedContent(isPro, user) ? (
            <Pressable
              style={styles.eventsIconBtnSm}
              hitSlop={8}
              onPress={() => navigation.navigate('CreateEvent')}
              accessibilityLabel="Create event"
            >
              <FontAwesome name="plus" size={15} color={DS.color.text} />
            </Pressable>
          ) : null}
          {premiumEventTools && canCreateVerifiedContent(isPro, user) ? (
            <Pressable
              style={styles.eventsIconBtnSm}
              hitSlop={8}
              onPress={() => navigation.navigate('HostScanPickEvent')}
            >
              <Image
                source={QR_SCAN_ICON}
                style={{ width: 22, height: 22 }}
                resizeMode="contain"
                tintColor={DS.color.text}
              />
            </Pressable>
          ) : null}
          <Pressable
            style={styles.eventsIconBtnSearch}
            hitSlop={8}
            onPress={() => navigation.navigate('EventsSearch')}
            accessibilityRole="button"
            accessibilityLabel="Search events"
          >
            <FontAwesome name="search" size={18} color={DS.color.text} />
          </Pressable>
        </View>
      </View>
      <ScrollView
        style={styles.eventsScroll}
        contentContainerStyle={[styles.eventsBody, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={pullRefreshControl(refreshing, onRefresh)}
      >
        {firstAnchor ? (
          <View style={styles.evAnchorBlock}>
            <View style={styles.evAnchorHeadRow}>
              <Text style={styles.evAnchorKicker}>UPCOMING</Text>
              {upcomingBookingsAnchored.length > 1 ? (
                <Pressable
                  onPress={() => navigation.navigate('UpcomingEvents', { initialFilter: 'booked' })}
                  hitSlop={8}
                >
                  <Text style={styles.evSeeAll}>See all</Text>
                </Pressable>
              ) : (
                <View style={{ width: 8 }} />
              )}
            </View>
            <Pressable
              style={styles.evListCell}
              onPress={() =>
                navigation.navigate('BookingConfirm', bookingToConfirmParams(firstAnchor))
              }
            >
              <Image
                source={{ uri: firstAnchor.event?.hero_image_url?.trim() || DEFAULT_HERO }}
                style={styles.evListThumb}
              />
              <View style={styles.evListTextCol}>
                <Text style={styles.evListTitle} numberOfLines={2}>
                  {(firstAnchor.event?.title ?? 'Booking').toUpperCase()}
                </Text>
                <Text style={styles.evListMeta} numberOfLines={2}>
                  {firstAnchor.event ? formatDbScheduleLine(firstAnchor.event) : 'Tap for ticket & QR'}
                </Text>
                <Text style={styles.evListVenue} numberOfLines={2}>
                  Ref {firstAnchor.reference}
                  {firstAnchor.checkedInAt ? ' · Checked in' : ''}
                </Text>
              </View>
              <View style={styles.evListChevronCol}>
                <FontAwesome name="chevron-right" size={14} color={DS.color.textMuted} />
              </View>
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.evDiscoverKicker}>DISCOVER</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.evFilterRow}
        >
          {filterChips.map((c) => {
            const on = filter === c.key;
            return (
              <Pressable
                key={c.key}
                style={[styles.evFilterChip, on && styles.evFilterChipOn]}
                onPress={() => setFilter(c.key)}
              >
                <Text style={[styles.evFilterChipTxt, on && styles.evFilterChipTxtOn]}>
                  {FILTER_HEADING_LABEL[c.key]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {listsEmpty ? (
          <Text style={styles.evEmpty}>No events match this filter.</Text>
        ) : filter === 'past' ? (
          <>
            <Text style={styles.evSectionGold}>PAST</Text>
            <BrowseEventRowsList rows={pastRows} navigation={navigation} browseFilter={filter} />
          </>
        ) : (
          <>
            {showUpcomingHeading ? (
              <View style={styles.evSectionBlock}>
                <Text style={styles.evSectionGold}>UPCOMING</Text>
                <BrowseEventRowsList rows={upcomingRows} navigation={navigation} browseFilter={filter} />
              </View>
            ) : null}
            {showPastHeading ? (
              <View style={[styles.evSectionBlock, showUpcomingHeading && styles.evSectionBlockSpaced]}>
                <Text style={styles.evSectionGold}>PAST</Text>
                <BrowseEventRowsList rows={pastRows} navigation={navigation} browseFilter={filter} />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

export function EventsSearchScreen({ navigation }: EProps<'EventsSearch'>) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const demoSession = !user || user.id.startsWith('demo-');
  const liveListing =
    !demoSession && isSupabaseConfigured() && !!user && !user.id.startsWith('demo-');

  const [draft, setDraft] = useState('');
  const [applied, setApplied] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [dbEvents, setDbEvents] = useState<EventRow[]>([]);

  const reloadRecent = useCallback(async () => {
    setRecentSearches(await getRecentEventSearches());
  }, []);

  const reloadSearchData = useCallback(async () => {
    await reloadRecent();
    if (demoSession || !isSupabaseConfigured() || !user) {
      setDbEvents([]);
      return;
    }
    const evs = await listAllEvents(120);
    setDbEvents(evs);
  }, [demoSession, user, reloadRecent]);

  const { refreshing, onRefresh } = useRefreshWithMinimum(reloadSearchData, 4000);

  useFocusEffect(
    useCallback(() => {
      void reloadSearchData();
    }, [reloadSearchData]),
  );

  const mergedRows = useMemo(() => {
    if (isSupabaseConfigured()) return browseRowsDbOnly(dbEvents);
    return mergeBrowseRows(dbEvents, UPCOMING_EVENTS_FROM_HTML);
  }, [dbEvents]);

  const searchResults = useMemo(() => {
    const q = applied.trim().toLowerCase();
    if (q.length < 2) return [];
    return mergedRows.filter((row) => {
      if (row.kind === 'db') {
        const r = row.row;
        return `${r.title} ${r.venue ?? ''}`.toLowerCase().includes(q);
      }
      const c = row.card;
      return `${c.title} ${c.sub}`.toLowerCase().includes(q);
    });
  }, [mergedRows, applied]);

  const { upcoming: searchUpcoming, past: searchPast } = useMemo(() => {
    const now = Date.now();
    return splitUpcomingAndPast(searchResults, now);
  }, [searchResults]);

  const commitSearch = useCallback(() => {
    const t = draft.trim();
    setApplied(t);
    if (t.length >= 2) void addRecentEventSearch(t).then(() => reloadRecent());
    else void reloadRecent();
  }, [draft, reloadRecent]);

  return (
    <View style={styles.root}>
      <PullRefreshRiveOverlay visible={refreshing} topInset={insets.top} />
      <View style={[styles.rowHeader, { paddingTop: insets.top + DS.space.md }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <FontAwesome name="arrow-left" size={22} color={DS.color.text} />
        </Pressable>
        <Text style={styles.rowTitle}>SEARCH EVENTS</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.eventsBody, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={pullRefreshControl(refreshing, onRefresh)}
      >
        <View style={styles.evSearchWrap}>
          <FontAwesome name="search" size={14} color={DS.color.textMuted} style={styles.evSearchIcon} />
          <TextInput
            style={styles.evSearchInput}
            placeholder="Search events…"
            placeholderTextColor={DS.color.textMuted}
            value={draft}
            onChangeText={setDraft}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            onSubmitEditing={() => commitSearch()}
          />
          {draft.length > 0 ? (
            <Pressable
              onPress={() => {
                setDraft('');
                setApplied('');
              }}
              hitSlop={8}
            >
              <FontAwesome name="times-circle" size={16} color={DS.color.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.evRecentHeadingGold}>RECENT SEARCHES</Text>
        {recentSearches.length === 0 ? (
          <Text style={styles.evMutedHint}>Your recent event searches appear here.</Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.evRecentRow}
          >
            {recentSearches.map((r) => (
              <Pressable
                key={r}
                style={styles.evRecentChip}
                onPress={() => {
                  setDraft(r);
                  setApplied(r);
                  void addRecentEventSearch(r).then(() => reloadRecent());
                }}
              >
                <Text style={styles.evRecentChipTxt}>{r}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {applied.trim().length >= 2 ? (
          searchResults.length === 0 ? (
            <Text style={styles.evEmpty}>{`No matches for "${applied.trim()}".`}</Text>
          ) : (
            <>
              {searchUpcoming.length > 0 ? (
                <View style={styles.evSectionBlock}>
                  <Text style={styles.evSectionGold}>UPCOMING</Text>
                  <BrowseEventRowsList rows={searchUpcoming} navigation={navigation} />
                </View>
              ) : null}
              {searchPast.length > 0 ? (
                <View
                  style={[styles.evSectionBlock, searchUpcoming.length > 0 && styles.evSectionBlockSpaced]}
                >
                  <Text style={styles.evSectionGold}>PAST</Text>
                  <BrowseEventRowsList rows={searchPast} navigation={navigation} />
                </View>
              ) : null}
            </>
          )
        ) : (
          <Text style={styles.evMutedHint}>Enter at least 2 characters to search the event catalog.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const AGENDA = [
  { n: '1', title: 'Warm-up & Movement Assessment', time: '10:00 - 10:15 AM' },
  { n: '2', title: 'Compound Movement Masterclass', time: '10:15 - 11:15 AM' },
  { n: '3', title: 'Power & Conditioning Circuit', time: '11:15 - 11:50 AM' },
  { n: '4', title: 'Cool Down & Q&A', time: '11:50 - 12:00 PM' },
] as const;

const BRING = ['Water bottle', 'Gym shoes', 'Workout clothes', 'Towel'] as const;

const FAQS = [
  {
    q: 'Is this suitable for beginners?',
    a: 'This session is designed for intermediate level. We recommend completing our Foundation course first.',
  },
  {
    q: 'What if I need to cancel?',
    a: 'Free cancellation up to 24 hours before the event. After that, 50% refund applies.',
  },
  {
    q: 'Will there be video recording?',
    a: 'Yes, all attendees receive access to session recordings for 30 days after the event.',
  },
] as const;

function splitScheduleLine(line: string): { datePart: string; timePart: string } {
  const sep = ' • ';
  const i = line.indexOf(sep);
  if (i === -1) return { datePart: line, timePart: '' };
  return { datePart: line.slice(0, i), timePart: line.slice(i + sep.length) };
}

function icsInputFromSchedule(
  title: string,
  venue: string,
  scheduleLine: string,
  refHint: string,
): IcsEventInput {
  const { datePart, timePart } = splitScheduleLine(scheduleLine);
  const recapTime = timePart || '10:00 AM - 12:00 PM';
  const timeStart = recapTime.split('-')[0]?.trim() ?? '10:00 AM';
  const timeEnd = recapTime.split('-')[1]?.trim() ?? timeStart;
  const start = new Date(`${datePart} ${timeStart}`);
  const end = new Date(`${datePart} ${timeEnd}`);
  if (Number.isNaN(start.getTime())) {
    const s = new Date();
    return {
      uid: refHint,
      title,
      location: venue,
      start: s,
      end: new Date(s.getTime() + 2 * 3600000),
      description: refHint,
    };
  }
  return {
    uid: refHint.replace(/\s+/g, '-'),
    title,
    location: venue,
    start,
    end: Number.isNaN(end.getTime()) ? new Date(start.getTime() + 2 * 3600000) : end,
    description: refHint,
  };
}

async function shareEventCalendar(
  title: string,
  venue: string,
  scheduleLine: string,
  refHint: string,
) {
  try {
    await shareEventAsIcs(icsInputFromSchedule(title, venue, scheduleLine, refHint));
  } catch (e) {
    Alert.alert('Calendar', e instanceof Error ? e.message : 'Could not create calendar file');
  }
}

function openGoogleCalendarLink(
  title: string,
  venue: string,
  scheduleLine: string,
  refHint: string,
) {
  try {
    const input = icsInputFromSchedule(title, venue, scheduleLine, refHint);
    const url = buildGoogleCalendarLink(input);
    void Linking.openURL(url);
  } catch {
    /* ignore */
  }
}

function formatEventSchedule(ev: EventRow): string {
  const start = new Date(ev.starts_at);
  const end = ev.ends_at ? new Date(ev.ends_at) : null;
  const dateFmt: Intl.DateTimeFormatOptions = {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  };
  const timeFmt: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  const d = start.toLocaleDateString(undefined, dateFmt);
  const t1 = start.toLocaleTimeString(undefined, timeFmt);
  const t2 =
    end && !Number.isNaN(end.getTime()) ? end.toLocaleTimeString(undefined, timeFmt) : null;
  return t2 ? `${d} · ${t1} – ${t2}` : `${d} · ${t1}`;
}

export function EventDetailsScreen({ navigation, route }: EProps<'EventDetails'>) {
  const insets = useSafeAreaInsets();
  const showBanner = useActionBanner();
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [masterMenuOpen, setMasterMenuOpen] = useState(false);
  const title = route.params?.title ?? 'STRENGTH CAMP';
  const heroUri = route.params?.imageUri ?? DEFAULT_HERO;
  const dateShort = route.params?.dateShort;
  const heroScheduleLine =
    dateShort ?? 'October 15, 2024 • 10:00 AM - 12:00 PM';
  const sub = route.params?.sub;
  const supabaseEventId = route.params?.supabaseEventId;
  const [dbEvent, setDbEvent] = useState<EventRow | null>(null);
  const [deleteEventConfirmOpen, setDeleteEventConfirmOpen] = useState(false);
  const [deleteEventBusy, setDeleteEventBusy] = useState(false);
  const [viewerBooking, setViewerBooking] = useState<BookingWithEvent | null>(null);

  const storageKeyEarly =
    route.params?.eventStorageKey ??
    unifiedEventSlug({
      source: route.params?.supabaseEventId ? 'db' : 'html',
      id: route.params?.supabaseEventId,
      title: route.params?.title ?? 'event',
      dateHint: route.params?.dateShort ?? '',
    });

  const reloadDbEvent = useCallback(async () => {
    if (!supabaseEventId) {
      setDbEvent(null);
      return;
    }
    const row = await getEventById(supabaseEventId);
    setDbEvent(row);
  }, [supabaseEventId]);

  useFocusEffect(
    useCallback(() => {
      if (!supabaseEventId) {
        setDbEvent(null);
        return undefined;
      }
      void reloadDbEvent();
      return subscribeEventById(supabaseEventId, () => {
        void reloadDbEvent();
      });
    }, [supabaseEventId, reloadDbEvent]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return undefined;
      void (async () => {
        const { rememberSeenEvent } = await import('../lib/offline/eventsOffline');
        await rememberSeenEvent(user.id, {
          eventStorageKey: storageKeyEarly,
          title: route.params?.title ?? 'Event',
          imageUri: route.params?.imageUri,
          seenAt: Date.now(),
        });
      })();
      return undefined;
    }, [user?.id, storageKeyEarly, route.params?.title, route.params?.imageUri]),
  );

  const displayTitle = dbEvent?.title ?? title;
  const displayHero = dbEvent?.hero_image_url?.trim() || heroUri;
  const displaySchedule = dbEvent ? formatEventSchedule(dbEvent) : heroScheduleLine;
  const displayVenue = dbEvent?.venue?.trim() || sub?.trim() || 'Elite Fitness Center';
  const eventPresentation = dbEvent
    ? resolveEventPresentation(dbEvent.description, dbEvent.event_details)
    : null;
  const entryPaymentLine = dbEvent
    ? formatEntryPaymentNotice(
        dbEvent.entry_payment_mode ?? 'none',
        dbEvent.entry_payment_amount,
        dbEvent.entry_payment_note,
      )
    : null;
  const eventCapacity = dbEvent
    ? parseEventCapacity(dbEvent.description, dbEvent.event_details)
    : null;
  const registeredCount = dbEvent?.registered_count ?? 0;
  const spotsLabel = dbEvent ? formatEventSpotsLabel(registeredCount, eventCapacity) : null;
  const isAttending = Boolean(viewerBooking);

  const storageKey = useMemo(
    () =>
      route.params?.eventStorageKey ??
      unifiedEventSlug({
        source: route.params?.supabaseEventId ? 'db' : 'html',
        id: route.params?.supabaseEventId,
        title: displayTitle,
        dateHint: dateShort ?? '',
      }),
    [route.params?.eventStorageKey, route.params?.supabaseEventId, displayTitle, dateShort],
  );

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        const on = await isEventKeySaved(storageKey);
        if (alive) setSaved(on);
      })();
      return () => {
        alive = false;
      };
    }, [storageKey]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!supabaseEventId || !user?.id || user.id.startsWith('demo-') || !isSupabaseConfigured()) {
        setViewerBooking(null);
        return undefined;
      }
      let alive = true;
      void (async () => {
        const bk = await findUserBookingForEvent(user.id, supabaseEventId);
        if (alive) setViewerBooking(bk);
      })();
      return () => {
        alive = false;
      };
    }, [supabaseEventId, user?.id]),
  );

  const toggleSaved = useCallback(async () => {
    const next = !saved;
    setSaved(next);
    try {
      if (next) await addSavedEventKey(storageKey);
      else await removeSavedEventKey(storageKey);
      showBanner(next ? 'Event saved' : 'Removed from saved');
    } catch {
      setSaved(!next);
    }
  }, [saved, storageKey, showBanner]);

  const goConfirm = () =>
    navigation.navigate('ConfirmAttend', {
      title: displayTitle,
      imageUri: displayHero,
      scheduleLine: displaySchedule,
      supabaseEventId,
      requiresPayment: dbEvent?.requires_payment ?? false,
      stripePriceId: dbEvent?.stripe_price_id ?? null,
    });

  const addCal = () =>
    void shareEventCalendar(displayTitle, displayVenue, displaySchedule, displayTitle);

  const confirmDeleteEvent = useCallback(async () => {
    if (!supabaseEventId || deleteEventBusy) return;
    setDeleteEventBusy(true);
    const ok = await deleteCommunityEvent(supabaseEventId);
    setDeleteEventBusy(false);
    setDeleteEventConfirmOpen(false);
    if (ok) {
      showBanner('Event deleted');
      navigation.goBack();
    } else {
      Alert.alert('Could not delete', 'Check permissions and try again.');
    }
  }, [deleteEventBusy, navigation, showBanner, supabaseEventId]);

  const isEventHost = Boolean(
    user?.id && dbEvent?.created_by && String(dbEvent.created_by).trim() === String(user.id),
  );
  const eventArchivedGuest = dbEvent ? isEventArchivedForBrowse(dbEvent) : false;
  const { datePart: recapDatePart, timePart: recapTimePart } = splitScheduleLine(displaySchedule);

  if (isEventHost && dbEvent) {
    return (
      <>
        <CreatorEventDetailView
          navigation={navigation}
          event={dbEvent}
          onShare={() =>
            void Share.share({
              message: `${displayTitle} — Dalton Grant Sports`,
            }).catch(() => undefined)
          }
          onEdit={() => navigation.navigate('EditEvent', { eventId: dbEvent.id })}
          onDelete={() => setDeleteEventConfirmOpen(true)}
        />
        <ConfirmModal
          visible={deleteEventConfirmOpen}
          title="Delete event?"
          message="This removes the event for everyone."
          confirmLabel="Delete"
          destructive
          busy={deleteEventBusy}
          onCancel={() => !deleteEventBusy && setDeleteEventConfirmOpen(false)}
          onConfirm={() => void confirmDeleteEvent()}
        />
      </>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.detailNavHeader, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.headerRoundBtn} onPress={() => navigation.goBack()}>
          <FontAwesome name="arrow-left" size={18} color={DS.color.text} />
        </Pressable>
        {user?.masterControl ? (
          <Pressable
            style={styles.headerRoundBtn}
            onPress={() => setMasterMenuOpen(true)}
            accessibilityLabel="Event options"
          >
            <FontAwesome name="ellipsis-v" size={18} color={DS.color.text} />
          </Pressable>
        ) : (
          <Pressable
            style={styles.headerRoundBtn}
            onPress={() =>
              Share.share({
                message: `${displayTitle} — Dalton Grant Sports`,
              }).catch(() => undefined)
            }
            accessibilityLabel="Share event"
          >
            <FontAwesome name="share-alt" size={16} color={DS.color.text} />
          </Pressable>
        )}
      </View>
      <OptionMenuModal
        visible={masterMenuOpen}
        title="Event"
        onClose={() => setMasterMenuOpen(false)}
        options={[
          {
            key: 'edit',
            label: 'Edit event',
            onPress: () => {
              if (!supabaseEventId) {
                Alert.alert('Not available', 'Only live events can be edited right now.');
                return;
              }
              setMasterMenuOpen(false);
              navigation.navigate('EditEvent', { eventId: supabaseEventId });
            },
          },
          {
            key: 'share',
            label: 'Share event',
            onPress: () =>
              void Share.share({
                message: `${displayTitle} — Dalton Grant Sports`,
              }).catch(() => undefined),
          },
          {
            key: 'delete',
            label: 'Delete event',
            destructive: true,
            onPress: () => {
              setMasterMenuOpen(false);
              setDeleteEventConfirmOpen(true);
            },
          },
        ]}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 220 + insets.bottom }}
      >
        <View style={styles.detailHeroTall}>
          <Image source={{ uri: displayHero }} style={styles.detailHeroFill} resizeMode="cover" />
          <View style={styles.detailHeroScrimTop} />
          <View style={styles.detailHeroScrimBottom} />
          <View style={styles.detailHeroTextWrap}>
            <Text style={styles.detailHeroDate}>{displaySchedule}</Text>
            <Text style={[styles.detailHeroTitle, styles.detailHeroTitleGold]}>
              {displayTitle.toUpperCase()}
            </Text>
            <View style={styles.detailHeroMetaRowSpread}>
              <View style={styles.detailHeroMetaGroup}>
                <FontAwesome name="map-marker" size={12} color={DS.color.gold} />
                <Text style={styles.detailHeroMeta}>{displayVenue}</Text>
              </View>
              <View style={styles.detailHeroMetaGroup}>
                <FontAwesome name="users" size={12} color={DS.color.gold} />
                <Text style={styles.detailHeroMeta}>{spotsLabel ?? '—'}</Text>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.detailPad}>
          {!dbEvent ? (
            <>
              <View style={styles.coachCard}>
                <Image
                  source={{
                    uri: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg',
                  }}
                  style={styles.coachAvatar}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.coachName}>David Miller</Text>
                  <View style={styles.coachVerifiedRow}>
                    <FontAwesome name="check-circle" size={10} color={DS.color.gold} />
                    <Text style={styles.coachVerified}> Venue Master</Text>
                  </View>
                  <Text style={styles.coachBio}>
                    Elite strength & conditioning specialist with 10+ years experience
                  </Text>
                </View>
              </View>
              <View style={styles.quickStatsRow}>
                <View style={styles.quickStat}>
                  <FontAwesome name="clock-o" size={20} color={DS.color.gold} />
                  <Text style={styles.quickStatLabel}>Duration</Text>
                  <Text style={styles.quickStatVal}>2 Hours</Text>
                </View>
                <View style={styles.quickStat}>
                  <FontAwesome name="signal" size={20} color={DS.color.gold} />
                  <Text style={styles.quickStatLabel}>Level</Text>
                  <Text style={styles.quickStatVal}>Intermediate</Text>
                </View>
              </View>
            </>
          ) : null}
          {dbEvent && eventPresentation ? (
            <EventDetailSections parsed={eventPresentation} entryPaymentLine={entryPaymentLine} />
          ) : dbEvent ? null : (
            <>
              <Text style={styles.detailSectionKicker}>OVERVIEW</Text>
              <Text style={styles.detailBody}>
                Elite performance training session designed to build functional strength and power. This
                intensive workshop combines compound movements, progressive overload techniques, and
                sport-specific conditioning.
              </Text>
              <Text style={styles.detailBody}>
                Perfect for athletes looking to break through plateaus and take their strength training to
                the next level. All equipment provided.
              </Text>
              <Text style={styles.detailSectionKicker}>AGENDA</Text>
              {AGENDA.map((a) => (
                <View key={a.n} style={styles.agendaRow}>
                  <View style={styles.agendaNum}>
                    <Text style={styles.agendaNumText}>{a.n}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.agendaTitle}>{a.title}</Text>
                    <Text style={styles.agendaTime}>{a.time}</Text>
                  </View>
                </View>
              ))}
              <Text style={styles.detailSectionKicker}>WHAT TO BRING</Text>
              <View style={styles.bringGrid}>
                {BRING.map((b) => (
                  <View key={b} style={styles.bringGridCell}>
                    <FontAwesome name="check" size={14} color={DS.color.gold} />
                    <Text style={styles.bringText}>{b}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.detailSectionKicker}>FREQUENTLY ASKED</Text>
              {FAQS.map((f, idx) => (
                <View
                  key={f.q}
                  style={[styles.faqBlock, idx < FAQS.length - 1 && styles.faqBlockBorder]}
                >
                  <Text style={styles.faqQ}>{f.q}</Text>
                  <Text style={styles.faqA}>{f.a}</Text>
                </View>
              ))}
            </>
          )}
          {user?.masterControl && supabaseEventId ? (
            <Pressable
              style={styles.masterDeleteEventBtn}
              onPress={() => setDeleteEventConfirmOpen(true)}
            >
              <Text style={styles.masterDeleteEventLabel}>Delete event (master)</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
      <View style={[styles.eventStickyFooter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {eventArchivedGuest ? (
          <>
            <Text
              style={{
                fontFamily: DS.font.body,
                fontSize: 14,
                color: DS.color.textMuted,
                textAlign: 'center',
                marginBottom: DS.space.base,
              }}
            >
              This event has finished. Browse it anytime under Past events; your ticket stays available if you
              registered.
            </Text>
            {viewerBooking ? (
              <AppleHeroButton
                style={{ marginBottom: DS.space.sm }}
                onPress={() =>
                  navigation.navigate('BookingConfirm', {
                    reference: viewerBooking.reference,
                    bookingId: viewerBooking.bookingId,
                    eventId: viewerBooking.eventId,
                    title: displayTitle,
                    imageUri: displayHero,
                    recapDate: recapDatePart,
                    recapTime: recapTimePart || displaySchedule,
                    venue: displayVenue,
                    attendeeName: user?.email?.split('@')[0] ?? 'Member',
                    attendeeEmail: user?.email ?? '',
                    fitnessLevel: 'Intermediate',
                  })
                }
              >
                <Text style={eventCtaLabelStyle}>Ticket & reviews</Text>
              </AppleHeroButton>
            ) : null}
            <AppleHeroButton variant="ghost" onPress={() => navigation.navigate('UpcomingEvents', { initialFilter: 'past' })}>
              <Text
                style={{
                  fontFamily: DS.font.bodyBold,
                  fontSize: 13,
                  color: DS.color.gold,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                Open past events
              </Text>
            </AppleHeroButton>
          </>
        ) : isAttending ? (
          <AppleHeroButton
            style={styles.attendingCombinedBtn}
            onPress={() =>
              navigation.navigate('BookingConfirm', {
                reference: viewerBooking!.reference,
                bookingId: viewerBooking!.bookingId,
                eventId: viewerBooking!.eventId,
                title: displayTitle,
                imageUri: displayHero,
                recapDate: recapDatePart,
                recapTime: recapTimePart || displaySchedule,
                venue: displayVenue,
                attendeeName: user?.email?.split('@')[0] ?? 'Member',
                attendeeEmail: user?.email ?? '',
                fitnessLevel: 'Intermediate',
              })
            }
          >
            <Text style={styles.attendingCombinedLabel}>Attending</Text>
          </AppleHeroButton>
        ) : (
          <>
            <AppleHeroButton onPress={goConfirm} style={{ marginBottom: DS.space.sm }}>
              <Text style={eventCtaLabelStyle}>Attend now</Text>
            </AppleHeroButton>
            <Pressable
              style={[styles.saveLaterOutlineBtn, saved && styles.saveLaterOutlineBtnSaved]}
              onPress={() => void toggleSaved()}
            >
              <Text style={[styles.saveLaterOutlineText, saved && styles.saveLaterOutlineTextSaved]}>
                {saved ? 'SAVED' : 'SAVE FOR LATER'}
              </Text>
            </Pressable>
          </>
        )}
      </View>
      <ConfirmModal
        visible={deleteEventConfirmOpen}
        title="Delete event?"
        message="This removes the event for everyone."
        confirmLabel="Delete"
        destructive
        busy={deleteEventBusy}
        onCancel={() => !deleteEventBusy && setDeleteEventConfirmOpen(false)}
        onConfirm={() => void confirmDeleteEvent()}
      />
    </View>
  );
}

const FITNESS_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert/Athlete'] as const;

export function ConfirmAttendScreen({ navigation, route }: EProps<'ConfirmAttend'>) {
  const insets = useSafeAreaInsets();
  const showBanner = useActionBanner();
  const { sessionEmail, user } = useAuth();
  const title = route.params?.title ?? 'STRENGTH CAMP';
  const heroUri = route.params?.imageUri ?? DEFAULT_HERO;
  const scheduleLine = route.params?.scheduleLine ?? 'October 15, 2024 • 10:00 AM - 12:00 PM';
  const supabaseEventId = route.params?.supabaseEventId;
  const requiresPayment = route.params?.requiresPayment ?? false;
  const stripePriceId = route.params?.stripePriceId?.trim() ?? '';
  const { datePart, timePart } = splitScheduleLine(scheduleLine);

  const [fullName, setFullName] = useState('Alex Johnson');
  const [email, setEmail] = useState(sessionEmail ?? 'alex.johnson@email.com');
  const [phone, setPhone] = useState('+1 (555) 123-4567');
  const [level, setLevel] = useState<(typeof FITNESS_LEVELS)[number]>('Intermediate');
  const [notes, setNotes] = useState('');
  const [consent, setConsent] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !supabaseEventId || !user?.id) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('stripe_checkout') !== 'success' || params.get('event_id') !== supabaseEventId) return;
    void (async () => {
      const existing = await findUserBookingForEvent(user.id, supabaseEventId);
      if (!existing) return;
      const url = new URL(window.location.href);
      url.searchParams.delete('stripe_checkout');
      url.searchParams.delete('event_id');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      navigation.navigate('BookingConfirm', {
        reference: existing.reference,
        eventId: existing.eventId,
        title,
        imageUri: heroUri,
        recapDate: datePart,
        recapTime: timePart || '10:00 AM - 12:00 PM',
        venue: 'Elite Fitness Center',
        attendeeName: fullName,
        attendeeEmail: email,
        fitnessLevel: level,
      });
    })();
  }, [supabaseEventId, user?.id, navigation, title, heroUri, datePart, timePart, fullName, email, level]);

  const goBookingConfirm = useCallback(async () => {
    const demoSession = !user || user.id.startsWith('demo-');
    let reference = `SC-${Date.now().toString(36).toUpperCase().slice(-10)}`;
    let eventId: string | undefined = supabaseEventId;
    let bookingId: string | undefined;
    if (!demoSession && isSupabaseConfigured()) {
      if (requiresPayment && !stripePriceId) {
        Alert.alert(
          'Payment not configured',
          'This event requires payment but the host has not linked a Stripe price yet. Contact the organizer.',
        );
        return;
      }
      if (requiresPayment && stripePriceId && supabaseEventId) {
        setBookingBusy(true);
        try {
          const checkout = await startEventStripeCheckout(supabaseEventId);
          if (!checkout.ok) {
            Alert.alert('Checkout unavailable', checkout.error);
            return;
          }
          openEventCheckoutUrl(checkout.url);
        } finally {
          setBookingBusy(false);
        }
        return;
      }
      setBookingBusy(true);
      try {
        if (supabaseEventId) {
          const booked = await bookExistingEvent(user.id, supabaseEventId);
          if (!booked) {
            Alert.alert(
              'Booking failed',
              'Could not save your booking. You may already be registered, or the event is full.',
            );
            return;
          }
          reference = booked.reference;
          eventId = booked.eventId;
          bookingId = booked.bookingId;
        } else {
          const created = await createEventAndBooking(user.id, {
            title,
            scheduleLine,
            heroImageUrl: heroUri,
            venue: 'Elite Fitness Center',
          });
          if (!created) {
            Alert.alert(
              'Booking failed',
              'Could not save your booking. Check Supabase (events RLS + profile row) and try again.',
            );
            return;
          }
          reference = created.reference;
          eventId = created.eventId;
          bookingId = created.bookingId;
        }
      } finally {
        setBookingBusy(false);
      }
    }
    if (bookingId) {
      void notifyBookingConfirmationEmail({ bookingId, reference });
    }
    showBanner(`Signed up · ${title}`, `Reference ${reference}`);
    navigation.navigate('BookingConfirm', {
      reference,
      bookingId,
      eventId,
      title,
      imageUri: heroUri,
      recapDate: datePart,
      recapTime: timePart || '10:00 AM - 12:00 PM',
      venue: 'Elite Fitness Center',
      attendeeName: fullName,
      attendeeEmail: email,
      fitnessLevel: level,
    });
  }, [
    user,
    title,
    scheduleLine,
    heroUri,
    navigation,
    datePart,
    timePart,
    fullName,
    email,
    level,
    showBanner,
    supabaseEventId,
    requiresPayment,
    stripePriceId,
  ]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.rowHeader, { paddingTop: insets.top + DS.space.md }]}>
        <Pressable onPress={() => navigation.goBack()}>
          <FontAwesome name="arrow-left" size={22} color={DS.color.text} />
        </Pressable>
        <Text style={styles.rowTitle}>CONFIRM ATTENDANCE</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.padded, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.detailSectionKicker}>EVENT SUMMARY</Text>
        <View style={styles.confirmEventCard}>
          <View style={styles.confirmEventCardInner}>
            <Image source={{ uri: heroUri }} style={styles.confirmThumbLg} />
            <View style={{ flex: 1 }}>
              <Text style={styles.confirmEventTitle}>{title.toUpperCase()}</Text>
              <View style={styles.confirmMetaRow}>
                <FontAwesome name="calendar" size={10} color={DS.color.gold} />
                <Text style={styles.confirmMetaText}>{datePart}</Text>
              </View>
              {timePart ? (
                <View style={styles.confirmMetaRow}>
                  <FontAwesome name="clock-o" size={10} color={DS.color.gold} />
                  <Text style={styles.confirmMetaText}>{timePart}</Text>
                </View>
              ) : null}
              <View style={styles.confirmMetaRow}>
                <FontAwesome name="map-marker" size={10} color={DS.color.gold} />
                <Text style={styles.confirmMetaText}>Elite Fitness Center</Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.detailSectionKicker}>YOUR DETAILS</Text>
        <Text style={styles.confirmFieldLabel}>Full Name</Text>
        <TextInput
          style={styles.textIn}
          value={fullName}
          onChangeText={setFullName}
          placeholderTextColor={DS.color.textMuted}
        />
        <Text style={styles.confirmFieldLabel}>Email Address</Text>
        <TextInput
          style={styles.textIn}
          value={email}
          onChangeText={setEmail}
          placeholderTextColor={DS.color.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Text style={styles.confirmFieldLabel}>Phone Number</Text>
        <TextInput
          style={styles.textIn}
          value={phone}
          onChangeText={setPhone}
          placeholderTextColor={DS.color.textMuted}
          keyboardType="phone-pad"
        />

        <Text style={styles.detailSectionKicker}>FITNESS LEVEL</Text>
        <View style={styles.levelList}>
          {FITNESS_LEVELS.map((l) => (
            <Pressable
              key={l}
              style={[styles.levelPill, level === l && styles.levelPillOn]}
              onPress={() => setLevel(l)}
            >
              <Text style={[styles.levelPillTxt, level === l && styles.levelPillTxtOn]}>{l}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.detailSectionKicker}>
          ADDITIONAL NOTES <Text style={styles.optionalMuted}>(OPTIONAL)</Text>
        </Text>
        <TextInput
          style={[styles.textIn, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Any injuries, dietary restrictions, or special requirements..."
          placeholderTextColor={DS.color.textMuted}
          multiline
        />

        <View style={styles.consentCard}>
          <Pressable style={styles.consentRow} onPress={() => setConsent((c) => !c)}>
            <View style={[styles.checkboxMd, consent && styles.checkboxSmOn]}>
              {consent ? <FontAwesome name="check" size={10} color={DS.color.background} /> : null}
            </View>
            <Text style={styles.consentText}>
              I acknowledge that I have read and agree to the{' '}
              <Text style={styles.consentLink}>terms and conditions</Text>,{' '}
              <Text style={styles.consentLink}>waiver of liability</Text>, and understand the risks
              involved in this fitness activity.
            </Text>
          </Pressable>
        </View>

        <View style={styles.policyBoxStrong}>
          <FontAwesome name="info-circle" size={14} color={DS.color.gold} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.policyTitle}>Cancellation Policy</Text>
            <Text style={styles.policyTextStrong}>
              Free cancellation up to 24 hours before the event. Cancellations within 24 hours are
              subject to a 50% cancellation fee.{' '}
              <Text style={styles.consentLink}>View full policy</Text>
            </Text>
          </View>
        </View>

        <AppleHeroButton disabled={!consent || bookingBusy} onPress={() => void goBookingConfirm()}>
          <Text style={eventCtaLabelStyle}>{bookingBusy ? 'Saving…' : 'Confirm booking'}</Text>
        </AppleHeroButton>
        <Pressable style={styles.cancelOutlineBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelOutlineBtnText}>CANCEL</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function resetEventsToUpcoming(navigation: EProps<'BookingConfirm'>['navigation']) {
  navigation.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: 'UpcomingEvents' }],
    }),
  );
}

export function BookingConfirmScreen({ navigation, route }: EProps<'BookingConfirm'>) {
  const insets = useSafeAreaInsets();
  const showBanner = useActionBanner();
  const { user } = useAuth();
  const p = route.params;
  const refCode = p?.reference ?? 'SC-2024-1015';
  const bookingId = p?.bookingId;
  const eventId = p?.eventId;
  const evTitle = p?.title ?? 'STRENGTH CAMP';
  const evImg = p?.imageUri ?? DEFAULT_HERO;
  const recapDate = p?.recapDate ?? 'October 15, 2024';
  const recapTime = p?.recapTime ?? '10:00 AM - 12:00 PM';
  const venue = p?.venue ?? 'Elite Fitness Center';
  const attendeeName = p?.attendeeName ?? 'Alex Johnson';
  const attendeeEmail = p?.attendeeEmail ?? 'alex.johnson@email.com';
  const fitnessLevel = p?.fitnessLevel ?? 'Intermediate';
  const scheduleForIcs = `${recapDate} • ${recapTime}`;

  const [qrToken, setQrToken] = useState<string | null>(null);
  const [checkedInAt, setCheckedInAt] = useState<string | null>(null);
  const [eventEndTs, setEventEndTs] = useState<number | null>(null);
  const [reviewGateTs, setReviewGateTs] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [reviewStars, setReviewStars] = useState(0);
  const [reviewNote, setReviewNote] = useState('');
  const ticketShotRef = useRef<View>(null);
  const checkInBannerSent = useRef(false);
  /** Stable pick so copy does not flicker each render */
  const [motivateIx] = useState(() => (refCode.charCodeAt(0) ?? 0) % 2);
  const motivateLine =
    motivateIx === 0 ? 'Enjoy the event.' : 'Work hard and win — make every rep count.';

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!eventId || !isSupabaseConfigured()) return;
    void getEventById(eventId).then((ev) => {
      if (!ev) return;
      const startMs = new Date(ev.starts_at).getTime();
      const endParsed = ev.ends_at ? new Date(ev.ends_at).getTime() : NaN;
      const endMs = Number.isFinite(endParsed)
        ? endParsed
        : Number.isFinite(startMs)
          ? startMs + 3 * 60 * 60 * 1000
          : null;
      if (endMs !== null && Number.isFinite(endMs)) {
        setEventEndTs(endMs);
        setReviewGateTs(reviewsUnlockAtMs(ev));
      }
    });
  }, [eventId]);

  const eventHasEnded =
    eventEndTs !== null && Number.isFinite(eventEndTs) && nowTick >= eventEndTs;
  const reviewWindowOpen =
    reviewGateTs !== null && Number.isFinite(reviewGateTs) && nowTick >= reviewGateTs;
  const hideInteractionRail = Boolean(checkedInAt) || eventHasEnded;
  const hideQr = Boolean(checkedInAt);

  const loadCheckedIn = useCallback(async (): Promise<string | null> => {
    if (!isSupabaseConfigured() || !user || user.id.startsWith('demo-')) {
      return null;
    }
    const s = getSupabase();
    if (!s) return null;
    const { data } = await s
      .from('bookings')
      .select('checked_in_at')
      .eq('reference', refCode)
      .maybeSingle();
    return (data as { checked_in_at?: string | null } | null)?.checked_in_at ?? null;
  }, [refCode, user]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        const v = await loadCheckedIn();
        if (!alive) return;
        setCheckedInAt(v);
        if (v && !checkInBannerSent.current) {
          checkInBannerSent.current = true;
          showBanner(`Signed in — your attendance for ${evTitle} is confirmed.`, undefined, {
            category: 'eventAttendance',
          });
        }
      })();
      return () => {
        alive = false;
      };
    }, [evTitle, loadCheckedIn, showBanner]),
  );

  useEffect(() => {
    if (!isSupabaseConfigured() || !user || user.id.startsWith('demo-')) return undefined;
    return subscribeBookingByReference(refCode, () => {
      void loadCheckedIn().then((v) => {
        setCheckedInAt(v);
        if (v && !checkInBannerSent.current) {
          checkInBannerSent.current = true;
          showBanner(`Signed in — your attendance for ${evTitle} is confirmed.`, undefined, {
            category: 'eventAttendance',
          });
        }
      });
    });
  }, [evTitle, loadCheckedIn, refCode, showBanner, user]);

  useEffect(() => {
    if (!eventId || !user?.id || user.id.startsWith('demo-')) return;
    void fetchMyEventReview(eventId, user.id).then((r) => {
      if (r) {
        setReviewStars(r.rating);
        setReviewNote(r.comment ?? '');
      }
    });
  }, [eventId, user?.id]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      // Never block ticket rendering on async signing: show a deterministic QR immediately.
      if (alive) setQrToken(refCode);
      const payload = {
        v: 1 as const,
        ref: refCode,
        uid: user?.id ?? attendeeEmail,
        ...(eventId ? { eventId } : {}),
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
      };
      try {
        const t = await signTicketPayload(payload);
        if (alive) setQrToken(t);
      } catch {
        if (alive) setQrToken(refCode);
      }
    })();
    return () => {
      alive = false;
    };
  }, [refCode, user?.id, attendeeEmail, eventId]);

  const addCal = () => void shareEventCalendar(evTitle, venue, scheduleForIcs, refCode);

  const saveTicketPng = useCallback(async () => {
    await saveTicketAsPng(ticketShotRef, refCode);
  }, [refCode]);

  const saveTicketPdf = useCallback(async () => {
    await saveTicketAsPdf(ticketShotRef, refCode);
  }, [refCode]);

  const qrExportSteps =
    qrToken
      ? [
          {
            key: 'png',
            title: 'Save ticket as PNG',
            subtitle: 'Save QR to Photos (mobile) or download as image',
            icon: <FontAwesome name="file-image-o" size={14} color={DS.color.gold} />,
            onPress: () => void saveTicketPng(),
          },
          {
            key: 'pdf',
            title: 'Save ticket as PDF',
            subtitle: 'Download or save via the system share sheet',
            icon: <FontAwesome name="file-pdf-o" size={14} color={DS.color.gold} />,
            onPress: () => void saveTicketPdf(),
          },
        ]
      : [];

  const walletStep =
    Platform.OS === 'ios'
      ? [
          {
            key: 'wallet',
            title: 'Add to Apple Wallet',
            subtitle: 'Add your event pass',
            icon: <FontAwesome name="apple" size={14} color={DS.color.gold} />,
            onPress: () => {
              if (!bookingId) {
                Alert.alert('Apple Wallet', 'This booking is missing an id. Re-open the confirmation screen.');
                return;
              }
              void import('../lib/walletPass')
                .then(({ addEventPassToAppleWallet }) =>
                  addEventPassToAppleWallet({ bookingId, reference: refCode }),
                )
                .catch(() =>
                  Alert.alert('Apple Wallet', 'Could not load the Wallet module. Please try again.'),
                );
            },
          },
        ]
      : [];

  const steps = [
    ...walletStep,
    ...qrExportSteps,
    {
      key: 'cal',
      title: 'Add to Calendar (ICS)',
      subtitle: 'Works on Apple Calendar + others',
      icon: <FontAwesome name="calendar-plus-o" size={14} color={DS.color.gold} />,
      onPress: addCal,
    },
    {
      key: 'gcal',
      title: 'Add to Google Calendar',
      subtitle: 'One-click calendar link',
      icon: <FontAwesome name="google" size={14} color={DS.color.gold} />,
      onPress: () => openGoogleCalendarLink(evTitle, venue, scheduleForIcs, refCode),
    },
    {
      key: 'dir',
      title: 'Get Directions',
      subtitle: 'Navigate to venue',
      icon: <FontAwesome5 name="location-arrow" size={14} color={DS.color.gold} />,
      onPress: () => {
        const q = encodeURIComponent(venue);
        void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
      },
    },
    {
      key: 'book',
      title: 'View My Bookings',
      subtitle: 'See all your events',
      icon: <FontAwesome name="ticket" size={14} color={DS.color.gold} />,
      onPress: () => navigation.navigate('UpcomingEvents', { initialFilter: 'booked' }),
    },
    {
      key: 'inv',
      title: 'Invite a Friend',
      subtitle: 'Share this event',
      icon: <FontAwesome name="user-plus" size={14} color={DS.color.gold} />,
      onPress: () =>
        Share.share({
          message: `Join me for ${evTitle} on The Dalton Grant Academy.`,
        }).catch(() => undefined),
    },
  ];

  return (
    <View style={styles.root}>
      <View style={[styles.bookingConfirmHeader, { paddingTop: insets.top + DS.space.md }]}>
        <Pressable style={styles.headerRoundBtn} onPress={() => resetEventsToUpcoming(navigation)}>
          <FontAwesome name="times" size={22} color={DS.color.textMuted} />
        </Pressable>
        <Text style={styles.rowTitle}>{checkedInAt ? 'ATTENDANCE CONFIRMED' : 'BOOKING CONFIRMED'}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.bookingConfirmBody, { paddingBottom: insets.bottom + 32 }]}
      >
        <View style={styles.successHero}>
          <View
            style={[
              styles.successCircleLg,
              checkedInAt ? { backgroundColor: DS.color.onlineGreen } : null,
            ]}
          >
            <FontAwesome name="check" size={32} color={DS.color.background} />
          </View>
          <Text style={styles.successHeadLg}>{checkedInAt ? 'YOU’RE CHECKED IN!' : "YOU'RE ALL SET!"}</Text>
          <Text style={styles.bodyCenterTight}>
            {checkedInAt ? 'Your attendance has been confirmed' : 'Your spot has been reserved'}
          </Text>
        </View>

        <View ref={ticketShotRef} collapsable={false} style={styles.refGradientCard}>
          <Text style={styles.refLabel}>BOOKING REFERENCE</Text>
          <Text style={styles.refCodeLg}>{refCode}</Text>
          {hideQr ? (
            <>
              <Text style={styles.checkedInQrBlurb}>{motivateLine}</Text>
              <Text style={styles.qrHintDim}>Reservation code stays on file for organisers.</Text>
            </>
          ) : (
            <>
              <View style={styles.qrWhiteWrap}>
                {qrToken ? (
                  <BookingQrCode value={qrToken} />
                ) : (
                  <View style={styles.qrInner}>
                    <AppLoadingIndicator />
                  </View>
                )}
              </View>
              <Text style={styles.qrHint}>Show this QR code at check-in</Text>
            </>
          )}
        </View>

        {hideQr ? null : (
          <View style={styles.dayOfReminderCard}>
            <FontAwesome name="battery-three-quarters" size={18} color={DS.color.gold} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.dayOfReminderTitle}>Before you arrive</Text>
              <Text style={styles.dayOfReminderBody}>
                • Keep your phone charged — you&apos;ll scan this QR at the door.
                {'\n'}• Save a PNG or PDF of your ticket (Next steps below) plus a screenshot, just in case other
                options fail offline.
                {'\n'}• On iPhone, Wallet passes still need power when organisers scan your code.
              </Text>
            </View>
          </View>
        )}

        <Text style={styles.detailSectionKicker}>EVENT DETAILS</Text>
        <View style={styles.confirmEventCard}>
          <View style={styles.confirmEventCardInner}>
            <Image source={{ uri: evImg }} style={styles.confirmThumbLg} />
            <View style={{ flex: 1 }}>
              <Text style={styles.confirmEventTitle}>{evTitle.toUpperCase()}</Text>
              <View style={styles.confirmMetaRow}>
                <FontAwesome name="calendar" size={10} color={DS.color.gold} />
                <Text style={styles.confirmMetaText}>{recapDate}</Text>
              </View>
              <View style={styles.confirmMetaRow}>
                <FontAwesome name="clock-o" size={10} color={DS.color.gold} />
                <Text style={styles.confirmMetaText}>{recapTime}</Text>
              </View>
              <View style={styles.confirmMetaRow}>
                <FontAwesome name="map-marker" size={10} color={DS.color.gold} />
                <Text style={styles.confirmMetaText}>{venue}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.attendeeCard}>
          <View style={styles.attendeeRow}>
            <Text style={styles.attendeeLabel}>Attendee</Text>
            <Text style={styles.attendeeVal}>{attendeeName}</Text>
          </View>
          <View style={styles.attendeeRow}>
            <Text style={styles.attendeeLabel}>Email</Text>
            <Text style={[styles.attendeeVal, styles.attendeeValEmail]}>{attendeeEmail}</Text>
          </View>
          <View style={styles.attendeeRow}>
            <Text style={styles.attendeeLabel}>Fitness Level</Text>
            <Text style={styles.attendeeVal}>{fitnessLevel}</Text>
          </View>
        </View>

        <View style={styles.emailSentCard}>
          <FontAwesome name="envelope" size={18} color={DS.color.gold} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.emailSentTitle}>Confirmation Email Sent</Text>
            <Text style={styles.emailSentBody}>
              We&apos;ve sent a confirmation email with all event details and your QR code to{' '}
              <Text style={styles.consentLink}>{attendeeEmail}</Text>
            </Text>
          </View>
        </View>

        {hideInteractionRail ? null : (
          <>
            <Text style={styles.detailSectionKicker}>NEXT STEPS</Text>
            {steps.map((s) => (
              <Pressable key={s.key} style={styles.nextStepRich} onPress={s.onPress}>
                <View style={styles.nextStepIconCircle}>{s.icon}</View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nextStepTitle}>{s.title}</Text>
                  <Text style={styles.nextStepSub}>{s.subtitle}</Text>
                </View>
                <FontAwesome name="chevron-right" size={12} color="rgba(212,208,200,0.35)" />
              </Pressable>
            ))}
          </>
        )}

        {reviewWindowOpen ? (
          <View style={styles.eventReviewCard}>
            <Text style={styles.detailSectionKicker}>HOW WAS IT?</Text>
            <Text style={styles.reviewHint}>
              Reviews unlock one hour after the scheduled end. You must have checked in to submit feedback — results
              show on the host&apos;s dashboard once published.
            </Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Pressable key={s} onPress={() => setReviewStars(s)} hitSlop={6}>
                  <FontAwesome
                    name={s <= reviewStars ? 'star' : 'star-o'}
                    size={26}
                    color={s <= reviewStars ? DS.color.gold : DS.color.textMuted}
                  />
                </Pressable>
              ))}
            </View>
            <TextInput
              value={reviewNote}
              onChangeText={setReviewNote}
              placeholder="Optional notes (privacy-respecting summaries may be shown to hosts)"
              placeholderTextColor={DS.color.textMuted}
              multiline
              style={styles.reviewNotes}
            />
            <AppleHeroButton
              style={{ marginTop: DS.space.md }}
              onPress={() => {
                if (!eventId || !user?.id || user.id.startsWith('demo-')) {
                  Alert.alert('Reviews', 'Sign in with a live account to submit.');
                  return;
                }
                if (reviewStars < 1) {
                  Alert.alert('Rating', 'Tap a star rating first.');
                  return;
                }
                void (async () => {
                  const res = await upsertEventReview(eventId, user.id, reviewStars, reviewNote);
                  if (res.ok) {
                    Alert.alert('Thanks', 'Your review was saved.');
                  } else {
                    Alert.alert(
                      'Could not save',
                      res.error?.includes('violates') || res.error?.includes('policy')
                        ? 'Make sure you checked in and waited one hour after the event end (server rules).'
                        : (res.error ?? 'Try again later.'),
                    );
                  }
                })();
              }}
            >
              <Text style={eventCtaLabelStyle}>Submit review</Text>
            </AppleHeroButton>
          </View>
        ) : null}

        <AppleHeroButton style={{ marginTop: DS.space.lg }} onPress={() => resetEventsToUpcoming(navigation)}>
          <Text style={eventCtaLabelStyle}>Done</Text>
        </AppleHeroButton>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: DS.color.background,
  },
  eventsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: DS.color.background,
  },
  eventsTitle: {
    ...tabRootTitleText,
  },
  eventsHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
  },
  eventsIconBtnSm: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: DS.color.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventsIconBtnSearch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DS.color.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DS.color.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sponsorBell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DS.color.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventsScroll: {
    flex: 1,
  },
  eventsBody: {
    paddingHorizontal: DS.space.base,
    paddingTop: DS.space.md,
    flexGrow: 1,
  },
  sectionKicker: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 11,
    fontWeight: '600',
    color: DS.color.gold,
    letterSpacing: 3,
    marginBottom: DS.space.base,
  },
  eventGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DS.space.base,
    marginBottom: DS.space.xl,
  },
  eventCell: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.borderWhite5,
    backgroundColor: DS.color.surface,
  },
  eventImg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  eventGrad: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  eventCopy: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: DS.space.base,
  },
  eventDate: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 12,
    color: DS.color.gold,
    marginBottom: 4,
  },
  eventName: {
    fontFamily: DS.font.heading,
    fontSize: 18,
    color: DS.color.text,
    letterSpacing: 0.5,
  },
  eventSub: {
    fontFamily: DS.font.body,
    fontSize: 10,
    color: DS.color.textMuted,
    marginTop: 4,
  },
  eventsFlowLinks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: DS.space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DS.color.borderWhite5,
  },
  eventsFlowLink: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 14,
    color: DS.color.gold,
  },
  evAnchorBlock: {
    marginBottom: DS.space.lg,
  },
  evAnchorHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: DS.space.sm,
  },
  evAnchorKicker: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 11,
    fontWeight: '600',
    color: DS.color.gold,
    letterSpacing: 2,
  },
  evSeeAll: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 13,
    fontWeight: '600',
    color: DS.color.gold,
  },
  evSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    paddingLeft: 36,
    paddingRight: DS.space.md,
    minHeight: 48,
    marginBottom: DS.space.md,
    position: 'relative',
  },
  evSearchIcon: {
    position: 'absolute',
    left: DS.space.base,
  },
  evSearchInput: {
    flex: 1,
    fontFamily: DS.font.body,
    fontSize: 15,
    color: DS.color.text,
    paddingVertical: DS.space.md,
  },
  evRecentBlock: {
    marginBottom: DS.space.md,
  },
  evRecentLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: DS.color.textMuted,
    letterSpacing: 1,
    marginBottom: DS.space.sm,
  },
  evRecentHeadingGold: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 11,
    fontWeight: '600',
    color: DS.color.gold,
    letterSpacing: 2,
    marginBottom: DS.space.sm,
  },
  evMutedHint: {
    fontSize: 14,
    color: DS.color.textMuted,
    lineHeight: 20,
    marginBottom: DS.space.lg,
  },
  evRecentRow: {
    gap: DS.space.sm,
    paddingRight: DS.space.lg,
  },
  evRecentChip: {
    paddingHorizontal: DS.space.md,
    paddingVertical: DS.space.sm,
    borderRadius: DS.radius.pill,
    backgroundColor: DS.color.surface,
    borderWidth: 1,
    borderColor: DS.color.borderWhite5,
  },
  evRecentChipTxt: {
    fontSize: 13,
    color: DS.color.text,
  },
  evFilterRow: {
    gap: DS.space.sm,
    paddingBottom: DS.space.md,
    flexDirection: 'row',
  },
  evFilterChip: {
    paddingHorizontal: DS.space.lg,
    paddingVertical: DS.space.sm + 2,
    borderRadius: DS.radius.pill,
    backgroundColor: DS.color.surfaceAlt,
    borderWidth: 1,
    borderColor: DS.color.borderHairlineLight,
    marginRight: DS.space.sm,
    alignSelf: 'flex-start',
  },
  evFilterChipOn: {
    backgroundColor: DS.color.gold,
    borderColor: DS.color.gold,
  },
  evFilterChipTxt: {
    color: DS.color.text,
    fontWeight: '600',
    fontSize: 14,
  },
  evFilterChipTxtOn: {
    color: DS.color.background,
  },
  evDiscoverKicker: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 11,
    fontWeight: '600',
    color: DS.color.gold,
    letterSpacing: 2,
    marginBottom: DS.space.sm,
    marginTop: DS.space.sm,
  },
  evSectionGold: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 11,
    fontWeight: '600',
    color: DS.color.gold,
    letterSpacing: 2,
    marginBottom: DS.space.sm,
  },
  evSectionBlock: {
    width: '100%',
  },
  evSectionBlockSpaced: {
    marginTop: DS.space.xl,
  },
  evEmpty: {
    fontSize: 14,
    color: DS.color.textMuted,
    paddingVertical: DS.space.xl,
    textAlign: 'center',
  },
  evListGap: {
    gap: DS.space.md,
  },
  evListCell: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: DS.space.md,
    paddingVertical: DS.space.md,
    paddingHorizontal: DS.space.base,
    minHeight: 108,
    borderRadius: DS.radius.xl,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  evListTextCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    minHeight: 72,
    paddingVertical: 2,
  },
  evListThumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: DS.color.surface,
    alignSelf: 'center',
  },
  evListTitle: {
    fontFamily: DS.font.heading,
    fontSize: 21,
    fontWeight: '600',
    color: DS.color.text,
    letterSpacing: 0.4,
    lineHeight: 26,
  },
  evListMeta: {
    fontSize: 14,
    lineHeight: 20,
    color: DS.color.gold,
    marginTop: 4,
    fontFamily: DS.font.bodyMedium,
  },
  evListVenue: {
    fontSize: 13,
    lineHeight: 18,
    color: DS.color.textMuted,
    marginTop: 4,
    fontFamily: DS.font.body,
  },
  evListRibbon: {
    marginTop: 6,
    fontSize: 11,
    letterSpacing: 0.6,
    color: DS.color.gold,
    fontFamily: DS.font.bodyMedium,
    textTransform: 'uppercase',
  },
  evListChevronCol: {
    justifyContent: 'center',
    paddingLeft: 2,
  },
  linkText: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 16,
    color: DS.color.text,
    fontWeight: '600',
  },
  padded: {
    padding: DS.space.lg,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: DS.space.lg,
  },
  gold: {
    color: DS.color.gold,
    fontWeight: '600',
  },
  detailHero: {
    width: '100%',
    height: 200,
    borderRadius: DS.radius.xl,
    marginBottom: DS.space.lg,
  },
  detailTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: DS.color.text,
    letterSpacing: 1,
    marginBottom: DS.space.sm,
  },
  muted: {
    color: DS.color.textMuted,
    fontSize: 14,
    marginBottom: DS.space.lg,
  },
  body: {
    fontSize: 15,
    lineHeight: 24,
    color: DS.color.text,
    marginBottom: DS.space.xl,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: DS.space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.color.borderHairline,
  },
  rowTitle: {
    ...tabRootTitleText,
    flex: 1,
    textAlign: 'center',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: DS.space.xl,
  },
  bookingCard: {
    backgroundColor: DS.color.surface,
    padding: DS.space.lg,
    borderRadius: DS.radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.cardBorder,
    marginBottom: DS.space.lg,
  },
  detailNavHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: DS.space.lg,
    paddingBottom: DS.space.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.color.borderWhite5,
    backgroundColor: DS.color.background,
  },
  headerRoundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailHeroTall: {
    height: 280,
    position: 'relative',
    marginBottom: DS.space.lg,
  },
  detailHeroFill: {
    width: '100%',
    height: '100%',
  },
  detailHeroScrimTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '42%',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  detailHeroScrimBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '62%',
    backgroundColor: 'rgba(0,0,0,0.82)',
  },
  detailHeroTextWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: DS.space.lg,
  },
  detailHeroDate: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 14,
    color: DS.color.gold,
    marginBottom: DS.space.sm,
  },
  detailHeroTitle: {
    fontFamily: DS.font.heading,
    fontSize: 42,
    color: DS.color.white,
    letterSpacing: 1,
    lineHeight: 44,
  },
  detailHeroTitleGold: {
    color: DS.color.gold,
  },
  detailHeroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  detailHeroMetaRowSpread: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: DS.space.md,
  },
  detailHeroMetaGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  detailHeroMeta: {
    fontFamily: DS.font.body,
    fontSize: 12,
    color: DS.color.text,
  },
  detailHeroMetaDim: {
    fontFamily: DS.font.body,
    fontSize: 12,
    color: DS.color.textMuted,
  },
  detailPad: {
    paddingHorizontal: DS.space.lg,
  },
  coachCard: {
    flexDirection: 'row',
    gap: DS.space.base,
    backgroundColor: DS.color.surfaceAlt,
    borderRadius: 12,
    padding: DS.space.base,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.borderWhite5,
    marginBottom: DS.space.lg,
  },
  coachAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: DS.color.goldTint30,
  },
  coachName: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 16,
    color: DS.color.white,
  },
  coachVerifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 6,
  },
  coachVerified: {
    fontFamily: DS.font.body,
    fontSize: 11,
    color: DS.color.gold,
  },
  coachBio: {
    fontFamily: DS.font.body,
    fontSize: 12,
    color: DS.color.textMuted,
    lineHeight: 18,
  },
  quickStatsRow: {
    flexDirection: 'row',
    gap: DS.space.base,
    marginBottom: DS.space.xl,
  },
  quickStat: {
    flex: 1,
    backgroundColor: DS.color.surfaceAlt,
    borderRadius: 10,
    padding: DS.space.base,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.borderWhite5,
  },
  quickStatLabel: {
    fontFamily: DS.font.body,
    fontSize: 12,
    color: DS.color.textMuted,
    marginTop: DS.space.sm,
  },
  quickStatVal: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 14,
    color: DS.color.white,
    marginTop: 4,
  },
  detailSectionKicker: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 11,
    color: DS.color.gold,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: DS.space.md,
    marginTop: DS.space.md,
  },
  entryPaymentCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: DS.space.sm,
    padding: DS.space.md,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,168,75,0.35)',
    backgroundColor: 'rgba(200,168,75,0.08)',
    marginBottom: DS.space.md,
  },
  entryPaymentText: {
    flex: 1,
    fontFamily: DS.font.bodyMedium,
    fontSize: 14,
    color: DS.color.text,
    lineHeight: 20,
  },
  detailBody: {
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.textMuted,
    lineHeight: 22,
    marginBottom: DS.space.md,
  },
  agendaRow: {
    flexDirection: 'row',
    gap: DS.space.md,
    marginBottom: DS.space.md,
  },
  agendaNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: DS.color.goldTint10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agendaNumText: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 12,
    color: DS.color.gold,
  },
  agendaTitle: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 14,
    color: DS.color.text,
  },
  agendaTime: {
    fontFamily: DS.font.body,
    fontSize: 11,
    color: DS.color.textMuted,
    marginTop: 2,
  },
  bringGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DS.space.md,
    marginBottom: DS.space.sm,
  },
  bringGridCell: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
  },
  faqBlock: {
    paddingBottom: DS.space.md,
    marginBottom: DS.space.md,
  },
  faqBlockBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  faqQ: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 14,
    color: DS.color.white,
    marginBottom: DS.space.sm,
  },
  faqA: {
    fontFamily: DS.font.body,
    fontSize: 12,
    color: DS.color.textMuted,
    lineHeight: 18,
  },
  bringText: {
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.text,
  },
  eventStickyFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: DS.space.lg,
    paddingTop: DS.space.md,
    backgroundColor: DS.color.scrimBottom,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DS.color.borderWhite5,
  },
  saveLaterOutlineBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: DS.space.base,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    borderColor: DS.color.gold,
    backgroundColor: 'transparent',
  },
  saveLaterOutlineText: {
    fontFamily: DS.font.heading,
    fontSize: 16,
    color: DS.color.gold,
    letterSpacing: 1,
  },
  saveLaterOutlineBtnSaved: {
    backgroundColor: 'rgba(200,169,126,0.18)',
    borderWidth: 2,
  },
  saveLaterOutlineTextSaved: {
    opacity: 0.95,
  },
  attendingCombinedBtn: {
    minHeight: DS.apple.controlHeight + DS.space.sm + DS.apple.controlHeight,
    justifyContent: 'center',
  },
  attendingCombinedLabel: {
    fontFamily: DS.font.heading,
    fontSize: 22,
    color: DS.color.background,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  masterDeleteEventBtn: {
    marginTop: DS.space.xl,
    paddingVertical: DS.space.md,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(220,80,80,0.6)',
    alignItems: 'center',
  },
  masterDeleteEventLabel: {
    fontFamily: DS.font.bodyBold,
    fontSize: 14,
    color: 'rgba(220,80,80,0.95)',
    letterSpacing: 0.5,
  },
  confirmSummary: {
    flexDirection: 'row',
    gap: DS.space.md,
    marginBottom: DS.space.xl,
    backgroundColor: DS.color.surface,
    padding: DS.space.md,
    borderRadius: DS.radius.lg,
  },
  confirmEventCard: {
    backgroundColor: DS.color.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.borderWhite5,
    padding: DS.space.base,
    marginBottom: DS.space.xl,
  },
  confirmEventCardInner: {
    flexDirection: 'row',
    gap: DS.space.base,
  },
  confirmThumb: {
    width: 72,
    height: 72,
    borderRadius: DS.radius.md,
  },
  confirmThumbLg: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  confirmEventTitle: {
    fontFamily: DS.font.heading,
    fontSize: 20,
    color: DS.color.white,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  confirmMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  confirmMetaText: {
    fontFamily: DS.font.body,
    fontSize: 11,
    color: DS.color.text,
    flex: 1,
  },
  confirmFieldLabel: {
    fontFamily: DS.font.body,
    fontSize: 12,
    color: DS.color.textMuted,
    marginBottom: DS.space.sm,
    marginTop: DS.space.sm,
  },
  levelList: {
    gap: DS.space.sm,
  },
  levelPill: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: DS.color.input,
    paddingVertical: DS.space.md,
    paddingHorizontal: DS.space.base,
  },
  levelPillOn: {
    borderColor: DS.color.gold,
    backgroundColor: DS.color.goldTint10,
  },
  levelPillTxt: {
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.textMuted,
  },
  levelPillTxtOn: {
    color: DS.color.gold,
    fontWeight: '600',
  },
  optionalMuted: {
    color: 'rgba(212,208,200,0.45)',
    fontWeight: '400',
  },
  consentCard: {
    backgroundColor: DS.color.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.borderWhite5,
    padding: DS.space.base,
    marginTop: DS.space.lg,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: DS.space.md,
  },
  checkboxMd: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  consentText: {
    flex: 1,
    fontFamily: DS.font.body,
    fontSize: 12,
    color: DS.color.text,
    lineHeight: 18,
  },
  consentLink: {
    color: DS.color.gold,
    textDecorationLine: 'underline',
  },
  policyBoxStrong: {
    flexDirection: 'row',
    gap: DS.space.md,
    backgroundColor: DS.color.borderWhite5,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.borderWhite5,
    padding: DS.space.base,
    marginTop: DS.space.lg,
    marginBottom: DS.space.lg,
  },
  policyTitle: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 12,
    color: DS.color.white,
    marginBottom: 4,
  },
  policyTextStrong: {
    fontFamily: DS.font.body,
    fontSize: 11,
    color: DS.color.textMuted,
    lineHeight: 17,
  },
  cancelOutlineBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: DS.space.base,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: DS.space.xl,
  },
  cancelOutlineBtnText: {
    fontFamily: DS.font.heading,
    fontSize: 16,
    color: DS.color.white,
    letterSpacing: 1,
  },
  inputLabel: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 11,
    color: DS.color.gold,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: DS.space.sm,
    marginTop: DS.space.sm,
  },
  textIn: {
    backgroundColor: DS.color.input,
    borderRadius: DS.radius.lg,
    padding: DS.space.base,
    fontFamily: DS.font.body,
    fontSize: 16,
    color: DS.color.text,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
    marginTop: DS.space.lg,
  },
  checkboxSm: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: DS.color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSmOn: {
    backgroundColor: DS.color.gold,
    borderColor: DS.color.gold,
  },
  policyBox: {
    flexDirection: 'row',
    gap: DS.space.md,
    backgroundColor: DS.color.surface,
    padding: DS.space.md,
    borderRadius: DS.radius.lg,
    marginTop: DS.space.lg,
    marginBottom: DS.space.lg,
  },
  policyText: {
    flex: 1,
    fontFamily: DS.font.body,
    fontSize: 13,
    color: DS.color.textMuted,
    lineHeight: 20,
  },
  cancelTextBtn: {
    alignItems: 'center',
    paddingVertical: DS.space.md,
  },
  bookingTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DS.space.lg,
    paddingBottom: DS.space.md,
  },
  successCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: DS.color.gold,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: DS.space.lg,
  },
  successHead: {
    fontFamily: DS.font.heading,
    fontSize: 28,
    color: DS.color.gold,
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: DS.space.sm,
  },
  bodyCenter: {
    fontFamily: DS.font.body,
    fontSize: 15,
    color: DS.color.textMuted,
    textAlign: 'center',
    marginBottom: DS.space.xl,
  },
  refLabel: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 11,
    color: DS.color.gold,
    letterSpacing: 2,
    textAlign: 'center',
  },
  refCode: {
    fontFamily: DS.font.bodyBold,
    fontSize: 22,
    color: DS.color.text,
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: DS.space.lg,
  },
  qrPlaceholder: {
    alignSelf: 'center',
    width: 200,
    height: 200,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.border,
    borderRadius: DS.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: DS.space.xl,
    backgroundColor: DS.color.surface,
  },
  nextStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: DS.space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.color.borderWhite5,
  },
  bookingConfirmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DS.space.lg,
    paddingBottom: DS.space.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.color.borderWhite5,
    backgroundColor: DS.color.background,
  },
  bookingConfirmBody: {
    paddingHorizontal: DS.space.lg,
    paddingTop: DS.space.lg,
  },
  successHero: {
    alignItems: 'center',
    paddingVertical: DS.space.xl,
  },
  successCircleLg: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: DS.color.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: DS.space.lg,
  },
  successHeadLg: {
    fontFamily: DS.font.heading,
    fontSize: 32,
    color: DS.color.white,
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: DS.space.sm,
  },
  bodyCenterTight: {
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.textMuted,
    textAlign: 'center',
  },
  refGradientCard: {
    borderRadius: 16,
    padding: DS.space.lg,
    marginBottom: DS.space.xl,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    backgroundColor: 'rgba(212,175,55,0.08)',
    alignItems: 'center',
  },
  refCodeLg: {
    fontFamily: DS.font.heading,
    fontSize: 28,
    color: DS.color.white,
    letterSpacing: 2,
    marginBottom: DS.space.lg,
  },
  qrWhiteWrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: DS.space.base,
  },
  qrInner: {
    width: 128,
    height: 128,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrHint: {
    fontFamily: DS.font.body,
    fontSize: 11,
    color: DS.color.textMuted,
    marginTop: DS.space.md,
    textAlign: 'center',
  },
  qrHintDim: {
    fontFamily: DS.font.body,
    fontSize: 11,
    color: DS.color.textMuted,
    marginTop: DS.space.sm,
    textAlign: 'center',
    opacity: 0.85,
  },
  checkedInQrBlurb: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 15,
    color: DS.color.text,
    textAlign: 'center',
    marginTop: DS.space.md,
    lineHeight: 22,
    paddingHorizontal: DS.space.sm,
  },
  eventReviewCard: {
    marginTop: DS.space.xl,
    padding: DS.space.base,
    borderRadius: DS.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.borderHairline,
    backgroundColor: DS.color.surface,
  },
  reviewHint: {
    fontFamily: DS.font.body,
    fontSize: 13,
    color: DS.color.textMuted,
    lineHeight: 20,
    marginBottom: DS.space.md,
  },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: 220,
    marginBottom: DS.space.md,
    gap: DS.space.sm,
  },
  reviewNotes: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.borderHairline,
    borderRadius: DS.radius.md,
    padding: DS.space.sm,
    minHeight: 88,
    color: DS.color.text,
    fontFamily: DS.font.body,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  attendeeCard: {
    backgroundColor: DS.color.borderWhite5,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.borderWhite5,
    padding: DS.space.base,
    marginBottom: DS.space.lg,
  },
  attendeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  attendeeLabel: {
    fontFamily: DS.font.body,
    fontSize: 12,
    color: DS.color.textMuted,
  },
  attendeeVal: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 13,
    color: DS.color.white,
    maxWidth: '62%',
    textAlign: 'right',
  },
  attendeeValEmail: {
    fontWeight: '400',
  },
  dayOfReminderCard: {
    flexDirection: 'row',
    gap: DS.space.md,
    backgroundColor: DS.color.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.goldTint10,
    padding: DS.space.base,
    marginBottom: DS.space.lg,
  },
  dayOfReminderTitle: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 13,
    color: DS.color.gold,
    marginBottom: 6,
  },
  dayOfReminderBody: {
    fontFamily: DS.font.body,
    fontSize: 12,
    color: DS.color.textMuted,
    lineHeight: 20,
  },
  emailSentCard: {
    flexDirection: 'row',
    gap: DS.space.md,
    backgroundColor: DS.color.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.borderWhite5,
    padding: DS.space.base,
    marginBottom: DS.space.xl,
  },
  emailSentTitle: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 13,
    color: DS.color.white,
    marginBottom: 4,
  },
  emailSentBody: {
    fontFamily: DS.font.body,
    fontSize: 11,
    color: DS.color.textMuted,
    lineHeight: 17,
  },
  nextStepRich: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
    backgroundColor: DS.color.borderWhite5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingVertical: DS.space.md,
    paddingHorizontal: DS.space.base,
    marginBottom: DS.space.sm,
  },
  nextStepIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DS.color.goldTint10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextStepTitle: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 13,
    color: DS.color.white,
  },
  nextStepSub: {
    fontFamily: DS.font.body,
    fontSize: 11,
    color: DS.color.textMuted,
    marginTop: 2,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DS.color.borderWhite5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedScrollPad: {
    paddingHorizontal: DS.space.lg,
    paddingTop: DS.space.lg,
  },
  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: DS.color.surface,
    borderRadius: 12,
    padding: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.borderWhite5,
    marginBottom: DS.space.lg,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentBtnOn: {
    backgroundColor: DS.color.gold,
  },
  segmentTxt: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 12,
    color: DS.color.textMuted,
  },
  segmentTxtOn: {
    color: DS.color.background,
  },
  savedSearchField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DS.color.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 12,
    paddingHorizontal: DS.space.md,
    paddingLeft: 40,
    marginBottom: DS.space.lg,
    position: 'relative',
  },
  savedSearchIcon: {
    position: 'absolute',
    left: 14,
  },
  savedSearchInput: {
    flex: 1,
    fontFamily: DS.font.body,
    fontSize: 15,
    color: DS.color.text,
    paddingVertical: 0,
  },
  savedListGap: {
    gap: DS.space.base,
  },
  savedListCard: {
    backgroundColor: DS.color.surface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.borderWhite5,
    padding: DS.space.base,
  },
  savedListRow: {
    flexDirection: 'row',
    gap: DS.space.base,
  },
  savedListThumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
  savedListTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  savedListDateGold: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 11,
    color: DS.color.gold,
    letterSpacing: 2,
    marginBottom: 4,
  },
  savedListTitle: {
    fontFamily: DS.font.heading,
    fontSize: 18,
    color: DS.color.white,
    letterSpacing: 0.5,
  },
  savedBookmarkMini: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: DS.color.borderWhite5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedListMeta: {
    flexDirection: 'row',
    gap: DS.space.lg,
    marginTop: DS.space.sm,
  },
  savedMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  savedMetaTxt: {
    fontFamily: DS.font.body,
    fontSize: 11,
    color: DS.color.textMuted,
  },
  savedListActions: {
    flexDirection: 'row',
    gap: DS.space.sm,
    marginTop: DS.space.md,
  },
  savedAttendSm: {
    flex: 1,
    backgroundColor: DS.color.gold,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  savedAttendSmTxt: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 11,
    color: DS.color.background,
    fontWeight: '700',
  },
  savedUnsaveBtn: {
    paddingHorizontal: DS.space.base,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: DS.color.borderWhite5,
  },
  savedUnsaveTxt: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 11,
    color: DS.color.textMuted,
  },
  emptyStateWrap: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: DS.space.lg,
  },
  emptyStateCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: DS.color.borderWhite5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: DS.space.lg,
  },
  emptyStateTitle: {
    fontFamily: DS.font.heading,
    fontSize: 24,
    color: DS.color.white,
    marginBottom: DS.space.sm,
  },
  emptyStateBody: {
    fontFamily: DS.font.body,
    fontSize: 13,
    color: DS.color.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: DS.space.lg,
  },
  emptyStateCta: {
    backgroundColor: DS.color.gold,
    paddingHorizontal: DS.space.lg,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyStateCtaTxt: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 13,
    color: DS.color.background,
    fontWeight: '600',
  },
  bookingBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  badgeBooked: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeBookedTxt: {
    fontFamily: DS.font.bodyBold,
    fontSize: 9,
    color: DS.color.background,
    letterSpacing: 0.5,
  },
  badgeWait: {
    backgroundColor: '#f97316',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeWaitTxt: {
    fontFamily: DS.font.bodyBold,
    fontSize: 9,
    color: DS.color.background,
    letterSpacing: 0.5,
  },
  qrMini: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: DS.color.goldTint10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingGhostBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: DS.color.borderWhite5,
    alignItems: 'center',
  },
  bookingGhostBtnTxt: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 11,
    color: DS.color.text,
  },
  bookingGhostBtnTxtDim: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 11,
    color: 'rgba(212,208,200,0.55)',
  },
  bookingCancelBtn: {
    paddingHorizontal: DS.space.md,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.2)',
  },
  bookingCancelTxt: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 11,
    color: '#f87171',
  },
  bookingWaitlistBtn: {
    paddingHorizontal: DS.space.md,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(249,115,22,0.2)',
  },
  bookingWaitlistTxt: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 11,
    color: '#fb923c',
  },
  pastCardMuted: {
    opacity: 0.92,
  },
  pastThumbDim: {
    opacity: 0.6,
  },
  savedListDateDim: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 11,
    color: 'rgba(212,208,200,0.45)',
    letterSpacing: 2,
    marginBottom: 4,
  },
  savedListTitleDim: {
    fontFamily: DS.font.heading,
    fontSize: 18,
    color: 'rgba(212,208,200,0.65)',
    letterSpacing: 0.5,
  },
  savedMetaTxtDim: {
    fontFamily: DS.font.body,
    fontSize: 11,
    color: 'rgba(212,208,200,0.45)',
  },
  badgeCompleted: {
    backgroundColor: '#6b7280',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeCompletedTxt: {
    fontFamily: DS.font.bodyBold,
    fontSize: 9,
    color: '#fff',
    letterSpacing: 0.5,
  },
  badgeCancelled: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeCancelledTxt: {
    fontFamily: DS.font.bodyBold,
    fontSize: 9,
    color: '#fff',
    letterSpacing: 0.5,
  },
  browseMoreWrap: {
    marginTop: DS.space.xl,
    alignItems: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: DS.space.lg,
    marginBottom: DS.space.md,
    gap: DS.space.sm,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: DS.space.sm,
    borderRadius: DS.radius.lg,
    backgroundColor: DS.color.surface,
    alignItems: 'center',
  },
  tabBtnOn: {
    backgroundColor: DS.color.goldTint10,
    borderWidth: 1,
    borderColor: DS.color.gold,
  },
  tabTxt: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 13,
    color: DS.color.textMuted,
    textTransform: 'capitalize',
  },
  tabTxtOn: {
    color: DS.color.gold,
  },
  savedSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
    backgroundColor: DS.color.input,
    borderRadius: DS.radius.lg,
    padding: DS.space.md,
    marginBottom: DS.space.lg,
  },
  savedSearchPh: {
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.textMuted,
  },
  savedCard: {
    flexDirection: 'row',
    gap: DS.space.md,
    backgroundColor: DS.color.surface,
    borderRadius: DS.radius.xl,
    padding: DS.space.md,
    marginBottom: DS.space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.borderWhite5,
  },
  savedThumb: {
    width: 88,
    height: 88,
    borderRadius: DS.radius.md,
  },
  savedDate: {
    fontFamily: DS.font.body,
    fontSize: 12,
    color: DS.color.gold,
    marginBottom: 4,
  },
  savedActions: {
    flexDirection: 'row',
    gap: DS.space.sm,
    marginTop: DS.space.md,
  },
  savedAttend: {
    flex: 1,
    backgroundColor: DS.color.gold,
    paddingVertical: DS.space.sm,
    borderRadius: DS.radius.md,
    alignItems: 'center',
  },
  savedAttendTxt: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 13,
    color: DS.color.background,
    fontWeight: '700',
  },
  savedRemove: {
    flex: 1,
    borderWidth: 1,
    borderColor: DS.color.border,
    paddingVertical: DS.space.sm,
    borderRadius: DS.radius.md,
    alignItems: 'center',
  },
  savedRemoveTxt: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 13,
    color: DS.color.textMuted,
  },
  attendingBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(34,197,94,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: DS.space.sm,
  },
  attendingBadgeTxt: {
    fontFamily: DS.font.bodyBold,
    fontSize: 10,
    color: '#22c55e',
    letterSpacing: 1,
  },
  savedOutline: {
    flex: 1,
    borderWidth: 1,
    borderColor: DS.color.gold,
    paddingVertical: DS.space.sm,
    borderRadius: DS.radius.md,
    alignItems: 'center',
  },
  savedOutlineTxt: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 13,
    color: DS.color.gold,
  },
  thumbTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DS.color.text,
  },
});
