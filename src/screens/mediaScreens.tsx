import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ResizeMode, Video } from 'expo-av';
import {
  allowMediaSearchDemoFallback,
  isAppStoreScreenshotMode,
  isSupabaseConfigured,
} from '../lib/env';
import { isMediaIdSaved, listSavedMediaIds, toggleSavedMediaId } from '../lib/savedMediaPrefs';
import { useRoute, type RouteProp, useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PullRefreshRiveOverlay } from '../components/PullRefreshRiveOverlay';
import { OptionMenuModal } from '../components/OptionMenuModal';
import { useAuth } from '../auth/AuthContext';
import { useSubscription } from '../subscriptions/SubscriptionContext';
import { gatePremiumFeatureAccess } from '../subscriptions/premiumFeatureGate';
import { useActionBanner } from '../actionBanner/ActionBannerContext';
import {
  listContinueWatching,
  listFullyWatchedIds,
  setMediaWatchProgress,
} from '../lib/mediaWatchProgress';
import { DS, tabRootHeaderPadding, tabRootTitleText } from '../designSystem';
import type { MediaStackParamList } from '../navigation/types';
import {
  deleteMediaAsset,
  getMediaAssetById,
  listBrowseMediaAssets,
} from '../roadmap/liveDataService';
import type { MediaAssetRow } from '../roadmap/types';
import { useRefreshWithMinimum } from '../hooks/useRefreshWithMinimum';
import { pullRefreshControl } from '../lib/pullRefreshUi';

type MProps<K extends keyof MediaStackParamList> = NativeStackScreenProps<MediaStackParamList, K>;
type MediaResultsRoute = RouteProp<MediaStackParamList, 'MediaSearchResults'>;

const HERO_LIB =
  'https://storage.googleapis.com/uxpilot-auth.appspot.com/1a75224564-2a540432ce03b03b0b14.png';
const PLAYER_STILL =
  'https://storage.googleapis.com/uxpilot-auth.appspot.com/93d0cf48f4-ce5f5c9499d653769bad.png';
const THUMB =
  'https://storage.googleapis.com/uxpilot-auth.appspot.com/31c2b75d62-cdb79732e3d7fcb5be97.png';

type SavedBadgeVariant = 'gold' | 'blue' | 'accent' | 'green' | 'purple';

type SavedMediaItem = {
  id: string;
  uri: string;
  duration: string;
  category: string;
  badgeVariant: SavedBadgeVariant;
  title: string;
  meta: string;
  rating: string;
  savedAgo: string;
};

const SAVED_MEDIA_ITEMS: SavedMediaItem[] = [
  {
    id: '1',
    uri: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/93d0cf48f4-b07ec3effab34b8b4823.png',
    duration: '12:34',
    category: 'Training',
    badgeVariant: 'gold',
    title: 'Advanced Boxing Combinations for Power',
    meta: 'Elite Boxing • 2.5M views',
    rating: '4.8',
    savedAgo: 'Saved 2 days ago',
  },
  {
    id: '2',
    uri: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/38b2a2e045-c26783c963eb5075007d.png',
    duration: '8:45',
    category: 'Technique',
    badgeVariant: 'blue',
    title: 'Footwork Fundamentals',
    meta: 'Boxing Academy • 1.8M views',
    rating: '4.9',
    savedAgo: 'Saved 5 days ago',
  },
  {
    id: '3',
    uri: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/2572604e70-b3accbebf8e9f8c3e982.png',
    duration: '9:33',
    category: 'Mindset',
    badgeVariant: 'accent',
    title: 'Mental Boxing Preparation',
    meta: 'Mind Sports • 780K views',
    rating: '4.7',
    savedAgo: 'Saved 1 week ago',
  },
  {
    id: '4',
    uri: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/7489c70a33-7d4015e50e92f0416ddf.png',
    duration: '18:07',
    category: 'Fitness',
    badgeVariant: 'green',
    title: 'Boxing Conditioning Workout',
    meta: 'Fitness Boxing • 3.1M views',
    rating: '4.6',
    savedAgo: 'Saved 1 week ago',
  },
  {
    id: '5',
    uri: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/99b51df8b7-bc6f62877ea60ce487cb.png',
    duration: '15:22',
    category: 'Defense',
    badgeVariant: 'purple',
    title: 'Defensive Boxing Mastery',
    meta: 'Boxing Academy • 1.4M views',
    rating: '4.8',
    savedAgo: 'Saved 2 weeks ago',
  },
  {
    id: '6',
    uri: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/e9a57029f3-262dd61d023d943237ff.png',
    duration: '14:55',
    category: 'Training',
    badgeVariant: 'gold',
    title: 'Speed Training Fundamentals',
    meta: 'Quick Boxing • 1.2M views',
    rating: '4.7',
    savedAgo: 'Saved 3 weeks ago',
  },
];

const SAVED_FILTER_CHIPS = ['All', 'Training', 'Technique', 'Mindset', 'Fitness', 'Defense'] as const;

function playerMeta(title: string) {
  const t = title.toLowerCase();
  if (t.includes('footwork'))
    return {
      badge: 'Training',
      duration: '8:45',
      channelLine: 'Elite Boxing • 1.8M views',
      desc: 'Dial in stance, rhythm, and defensive movement with drills used by elite coaches.',
    };
  if (t.includes('defensive') || t.includes('defense'))
    return {
      badge: 'Training',
      duration: '15:22',
      channelLine: 'Boxing Academy • 950K views',
      desc: 'Block, slip, and counter with structured progressions for live situations.',
    };
  if (t.includes('mental') || t.includes('visualization'))
    return {
      badge: 'Mindset',
      duration: '9:33',
      channelLine: 'Mind Sports • 780K views',
      desc: 'Visualization and breathing protocols to stay composed before the bell.',
    };
  return {
    badge: 'Training',
    duration: '12:34',
    channelLine: 'Champion Training • 2.1M views',
    desc: 'Master the art of powerful boxing combinations with this comprehensive training session. Learn proper form, timing, and technique to maximize your striking power.',
  };
}

const UP_NEXT_ITEMS = [
  {
    title: 'Footwork Fundamentals',
    channel: 'Elite Boxing',
    duration: '8:45',
    uri: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/38b2a2e045-566bd50dd7ade8850f92.png',
  },
  {
    title: 'Defensive Boxing',
    channel: 'Boxing Academy',
    duration: '15:22',
    uri: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/99b51df8b7-817bb84e9fd20a41ab2c.png',
  },
  {
    title: 'Sparring Strategies',
    channel: 'Pro Boxing',
    duration: '22:18',
    uri: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/a6bf06ab69-e4b020b342fade24340e.png',
  },
] as const;

const RELATED_ITEMS = [
  {
    title: 'Boxing Conditioning',
    meta: 'Fitness Boxing • 2.5M views',
    duration: '18:07',
    uri: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/7489c70a33-f137e7f5db66644a0808.png',
    rating: '4.8',
  },
  {
    title: 'Mental Boxing Prep',
    meta: 'Mind Sports • 890K views',
    duration: '11:02',
    uri: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/2572604e70-24280542fbd1badb649c.png',
    rating: '4.9',
  },
] as const;

const BROWSE = ['All Media', 'Training', 'Mindset', 'Nutrition', 'Recovery', 'Career'] as const;

export function MediaLibraryScreen({ navigation, route }: MProps<'MediaLibrary'>) {
  const insets = useSafeAreaInsets();
  const showBanner = useActionBanner();
  const { user } = useAuth();
  const { isPro, refresh: refreshSubscription, notifyNewPremiumFromPaywall } = useSubscription();

  useEffect(() => {
    const t = route.params?.createdMediaTitle?.trim();
    if (!t) return;
    showBanner('Media published', t);
    navigation.setParams({ createdMediaTitle: undefined });
  }, [route.params?.createdMediaTitle, navigation, showBanner]);
  const [b, setB] = useState(0);
  const [browseAssets, setBrowseAssets] = useState<MediaAssetRow[]>([]);
  const [continueItems, setContinueItems] = useState<Awaited<ReturnType<typeof listContinueWatching>>>([]);
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());
  const loadBrowse = useCallback(async () => {
    const [rows, cont, watched] = await Promise.all([
      listBrowseMediaAssets(80),
      listContinueWatching(),
      listFullyWatchedIds(),
    ]);
    setBrowseAssets(rows);
    setContinueItems(cont);
    setWatchedIds(watched);
  }, []);
  const { refreshing, onRefresh } = useRefreshWithMinimum(
    useCallback(async () => {
      await loadBrowse();
    }, [loadBrowse]),
    4000,
  );

  useFocusEffect(
    useCallback(() => {
      void loadBrowse();
    }, [loadBrowse]),
  );
  return (
    <View style={styles.root}>
      <PullRefreshRiveOverlay visible={refreshing} topInset={insets.top} />
      <View style={[styles.mediaTop, tabRootHeaderPadding, { paddingTop: insets.top + DS.space.md }]}>
        <Text style={styles.mediaTitle}>MEDIA</Text>
        <View style={styles.mediaHeaderActions}>
          {user?.masterControl ? (
            <>
              <Pressable
                style={styles.roundIconBtnSm}
                hitSlop={8}
                onPress={() => navigation.navigate('MediaProposalWizard')}
                accessibilityLabel="Upload media"
              >
                <FontAwesome name="plus" size={15} color={DS.color.text} />
              </Pressable>
              <Pressable
                style={styles.roundIconBtnSm}
                hitSlop={8}
                onPress={() => navigation.navigate('SavedMedia')}
                accessibilityLabel="Saved library"
              >
                <FontAwesome name="bookmark" size={16} color={DS.color.text} />
              </Pressable>
              <Pressable
                style={styles.roundIconBtn}
                onPress={() => navigation.navigate('MediaSearch')}
                accessibilityLabel="Search media"
              >
                <FontAwesome name="search" size={18} color={DS.color.text} />
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                style={styles.roundIconBtnSm}
                hitSlop={8}
                onPress={() => navigation.navigate('SavedMedia')}
                accessibilityLabel="Saved library"
              >
                <FontAwesome name="bookmark" size={16} color={DS.color.text} />
              </Pressable>
              <Pressable
                style={styles.roundIconBtn}
                onPress={() => navigation.navigate('MediaSearch')}
                accessibilityLabel="Search media"
              >
                <FontAwesome name="search" size={18} color={DS.color.text} />
              </Pressable>
            </>
          )}
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={pullRefreshControl(refreshing, onRefresh)}
      >
        <Pressable
          style={styles.hero}
          onPress={() => navigation.navigate('MediaPlayer', { title: "The Champion's Mindset" })}
        >
          <Image source={{ uri: HERO_LIB }} style={styles.heroImage} />
          <View style={styles.heroPlay}>
            <View style={styles.playCircle}>
              <FontAwesome name="play" size={22} color={DS.color.background} />
            </View>
          </View>
          <View style={styles.heroBottom}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroKicker}>Featured Series</Text>
              <Text style={styles.heroHead}>THE CHAMPION&apos;S MINDSET</Text>
            </View>
            <View style={styles.durationPill}>
              <Text style={styles.durationPillText}>45:20</Text>
            </View>
          </View>
        </Pressable>
        <Text style={styles.browseLabel}>BROWSE</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.browseRow}
        >
          {BROWSE.map((label, i) => (
            <Pressable
              key={label}
              onPress={() => setB(i)}
              style={[styles.browseChip, b === i && styles.browseChipOn]}
            >
              <Text style={[styles.browseChipText, b === i && styles.browseChipTextOn]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={[styles.grid2, browseAssets.length === 0 ? { width: '100%' } : null]}>
          {browseAssets.length === 0 ? (
            <Text style={[styles.muted, { paddingHorizontal: DS.space.base, width: '100%' }]}>
              No media published yet. Creators with access can upload from the + button.
            </Text>
          ) : (
            browseAssets.map((asset) => {
              const thumb = asset.thumbnail_url || asset.public_url || THUMB;
              const label =
                asset.title?.trim() ||
                asset.storage_path?.split('/').pop() ||
                asset.kind.toUpperCase();
              const open = () =>
                navigation.navigate('MediaPlayer', {
                  title: label,
                  mediaId: asset.id,
                });
              const promptDelete = () => {
                if (!user?.masterControl) return;
                Alert.alert('Delete media?', 'Removes this asset for everyone.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                      void (async () => {
                        const ok = await deleteMediaAsset(asset.id);
                        if (ok) await loadBrowse();
                        else Alert.alert('Could not delete', 'Check permissions and try again.');
                      })();
                    },
                  },
                ]);
              };
              return (
                <Pressable
                  key={asset.id}
                  style={styles.gridCell}
                  onPress={open}
                  onLongPress={user?.masterControl ? promptDelete : undefined}
                >
                  <View style={styles.thumbWrap}>
                    <Image source={{ uri: thumb }} style={styles.thumbImg} />
                    <View style={styles.thumbDur}>
                      <Text style={styles.thumbDurText}>{asset.kind}</Text>
                    </View>
                  </View>
                  <Text style={styles.thumbTag}>{asset.visibility}</Text>
                  <Text style={styles.thumbTitle} numberOfLines={2}>
                    {label}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
        {continueItems.length > 0 ? (
          <>
            <Text style={styles.browseLabel}>Continue Watching</Text>
            {continueItems.map((item) => (
              <Pressable
                key={item.mediaId}
                style={styles.continueCard}
                onPress={() =>
                  navigation.navigate('MediaPlayer', {
                    title: item.title,
                    mediaId: item.mediaId,
                  })
                }
              >
                <Image
                  source={{ uri: item.thumb || THUMB }}
                  style={styles.continueThumb}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.continueTitle}>{item.title}</Text>
                  <Text style={styles.muted}>
                    {Math.round((1 - item.progress) * 100)}% remaining
                  </Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${item.progress * 100}%` }]} />
                  </View>
                </View>
              </Pressable>
            ))}
          </>
        ) : browseAssets.length > 0 && watchedIds.size >= browseAssets.length ? (
          <>
            <Text style={styles.browseLabel}>Recommended for you</Text>
            <View style={styles.grid2}>
              {browseAssets.slice(0, 4).map((asset) => {
                const thumb = asset.thumbnail_url || asset.public_url || THUMB;
                const label =
                  asset.storage_path?.split('/').pop() || asset.kind.toUpperCase();
                return (
                  <Pressable
                    key={`rec-${asset.id}`}
                    style={styles.gridCell}
                    onPress={() =>
                      navigation.navigate('MediaPlayer', {
                        title: label,
                        mediaId: asset.id,
                      })
                    }
                  >
                    <View style={styles.thumbWrap}>
                      <Image source={{ uri: thumb }} style={styles.thumbImg} />
                    </View>
                    <Text style={styles.thumbTitle} numberOfLines={2}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const CAT_ICONS = [
  { label: 'All Media', icon: 'play-circle' as const },
  { label: 'Training', icon: 'heartbeat' as const },
  { label: 'Mindset', icon: 'lightbulb-o' as const },
  { label: 'Nutrition', icon: 'apple' as const },
  { label: 'Recovery', icon: 'leaf' as const },
  { label: 'Career', icon: 'briefcase' as const },
];

export function MediaSearchScreen({ navigation }: MProps<'MediaSearch'>) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  return (
    <View style={styles.root}>
      <View style={[styles.mediaSearchTop, { paddingTop: insets.top + DS.space.md }]}>
        <View style={styles.mediaSearchBar}>
          <Pressable onPress={() => navigation.goBack()}>
            <FontAwesome name="arrow-left" size={20} color={DS.color.text} />
          </Pressable>
          <Text style={styles.mediaSearchTitle}>SEARCH</Text>
          <View style={{ width: 20 }} />
        </View>
        <TextInput
          style={styles.mediaSearchInputFull}
          placeholder="Search videos, training, tips..."
          placeholderTextColor={DS.color.textMuted}
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() =>
            navigation.navigate('MediaSearchResults', {
              query: q.trim() || 'boxing techniques',
            })
          }
        />
      </View>
      <ScrollView
        contentContainerStyle={[styles.padded, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.browseLabel}>Browse Categories</Text>
        <View style={styles.catGrid}>
          {CAT_ICONS.map((c) => (
            <Pressable
              key={c.label}
              style={styles.catCell}
              onPress={() =>
                navigation.navigate('MediaSearchResults', {
                  query: q.trim() || 'boxing techniques',
                })
              }
            >
              <FontAwesome name={c.icon} size={22} color={DS.color.gold} />
              <Text style={styles.catLabel}>{c.label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          style={styles.mediaSearchGo}
          onPress={() =>
            navigation.navigate('MediaSearchResults', {
              query: q.trim() || 'boxing techniques',
            })
          }
        >
          <Text style={styles.linkGold}>Search</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const SORT_LABELS = ['Relevance', 'Newest', 'Duration', 'Most Viewed'] as const;

type ResultRow = {
  id: string;
  uri: string;
  duration: string;
  badge: string;
  badgeVariant: 'gold' | 'accent';
  title: string;
  meta: string;
  rating: string;
};

const SEARCH_DEMO_RESULTS: ResultRow[] = [
  {
    id: '1',
    uri: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/93d0cf48f4-a5cea2538cdb2fa62a17.png',
    duration: '12:34',
    badge: 'Training',
    badgeVariant: 'gold',
    title: 'Advanced Boxing Combinations for Power',
    meta: 'Champion Training • 2.1M views',
    rating: '4.8',
  },
  {
    id: '2',
    uri: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/38b2a2e045-8b3de2140e5664ce87de.png',
    duration: '8:45',
    badge: 'Training',
    badgeVariant: 'gold',
    title: 'Footwork Fundamentals: Moving Like a Pro',
    meta: 'Elite Boxing • 1.8M views',
    rating: '4.9',
  },
  {
    id: '3',
    uri: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/99b51df8b7-f98b1760c36b12a9d324.png',
    duration: '15:22',
    badge: 'Training',
    badgeVariant: 'gold',
    title: 'Defensive Boxing: Block, Slip, and Counter',
    meta: 'Boxing Academy • 950K views',
    rating: '4.7',
  },
  {
    id: '4',
    uri: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/a6bf06ab69-efbb06f2fd9c2cd73640.png',
    duration: '22:18',
    badge: 'Training',
    badgeVariant: 'gold',
    title: 'Sparring Strategies for Competition',
    meta: 'Pro Boxing • 1.3M views',
    rating: '4.6',
  },
  {
    id: '5',
    uri: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/7489c70a33-ab35b5f349626c86682c.png',
    duration: '18:07',
    badge: 'Training',
    badgeVariant: 'gold',
    title: 'Boxing Conditioning: Build Power & Endurance',
    meta: 'Fitness Boxing • 2.5M views',
    rating: '4.8',
  },
  {
    id: '6',
    uri: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/2572604e70-46425f8aaca7e7df2f16.png',
    duration: '9:33',
    badge: 'Mindset',
    badgeVariant: 'accent',
    title: 'Mental Boxing: Visualization Techniques',
    meta: 'Mind Sports • 780K views',
    rating: '4.9',
  },
];

function mediaAssetToResultRow(r: MediaAssetRow): ResultRow {
  const uri = r.thumbnail_url?.trim() || r.public_url?.trim() || THUMB;
  const label = r.kind === 'video' ? 'Video' : r.kind === 'image' ? 'Image' : 'Media';
  const name = r.storage_path?.split('/').pop() || 'Media asset';
  return {
    id: r.id,
    uri,
    duration: label,
    badge: label,
    badgeVariant: r.kind === 'video' ? 'accent' : 'gold',
    title: name,
    meta: new Date(r.created_at).toLocaleDateString(),
    rating: '—',
  };
}

export function MediaSearchResultsScreen({ navigation }: MProps<'MediaSearchResults'>) {
  const insets = useSafeAreaInsets();
  const route = useRoute<MediaResultsRoute>();
  const paramQ = route.params?.query?.trim();
  const initialQ = paramQ && paramQ.length > 0 ? paramQ : '';
  const [searchText, setSearchText] = useState(initialQ);
  const [sortBy, setSortBy] = useState<(typeof SORT_LABELS)[number]>('Relevance');
  const [sortOpen, setSortOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [trainingFilter, setTrainingFilter] = useState(true);
  const [loadMoreDone, setLoadMoreDone] = useState(false);
  const [liveMedia, setLiveMedia] = useState<MediaAssetRow[]>([]);
  const liveMediaMode = isSupabaseConfigured();

  useEffect(() => {
    if (!liveMediaMode) return;
    void listBrowseMediaAssets(120).then(setLiveMedia);
  }, [liveMediaMode]);

  const results = useMemo(() => {
    let base: ResultRow[] = liveMediaMode
      ? liveMedia.map(mediaAssetToResultRow)
      : allowMediaSearchDemoFallback()
        ? [...SEARCH_DEMO_RESULTS]
        : [];
    const q = searchText.trim().toLowerCase();
    if (q) {
      base = base.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.meta.toLowerCase().includes(q) ||
          r.badge.toLowerCase().includes(q),
      );
    }
    if (loadMoreDone && !liveMediaMode && allowMediaSearchDemoFallback() && !isAppStoreScreenshotMode()) {
      base.push(
        {
          id: '7',
          uri: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/93d0cf48f4-a5cea2538cdb2fa62a17.png',
          duration: '11:02',
          badge: 'Training',
          badgeVariant: 'gold',
          title: 'Heavy Bag: Power Sessions',
          meta: 'Champion Training • 640K views',
          rating: '4.7',
        },
        {
          id: '8',
          uri: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/38b2a2e045-8b3de2140e5664ce87de.png',
          duration: '6:15',
          badge: 'Training',
          badgeVariant: 'gold',
          title: 'Speed Ladder for Fighters',
          meta: 'Elite Boxing • 420K views',
          rating: '4.8',
        },
      );
    }
    if (trainingFilter) {
      base = base.filter((r) => r.badge === 'Training');
    }
    return base;
  }, [loadMoreDone, trainingFilter, liveMedia, liveMediaMode, searchText]);

  const openPlayer = (title: string, mediaId?: string) =>
    navigation.navigate('MediaPlayer', { title, mediaId });

  return (
    <View style={styles.root}>
      <View style={[styles.resultsStickyHeader, { paddingTop: insets.top + DS.space.md }]}>
        <View style={styles.resultsTopRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.resultsBackCircle}
            hitSlop={8}
          >
            <FontAwesome name="arrow-left" size={18} color={DS.color.text} />
          </Pressable>
          <Text style={styles.resultsHeroTitle}>RESULTS</Text>
        </View>
        <View style={styles.resultsSearchWrap}>
          <TextInput
            style={styles.resultsSearchInput}
            placeholder="Search videos, training, tips..."
            placeholderTextColor={DS.color.textMuted}
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={() => setSearchText((t) => t.trim() || 'boxing techniques')}
          />
          <View style={styles.resultsSearchIcons}>
            <Pressable style={styles.resultsIconCircle}>
              <FontAwesome name="microphone" size={14} color={DS.color.gold} />
            </Pressable>
            <Pressable style={styles.resultsIconCircleMuted} onPress={() => setSearchText('')}>
              <FontAwesome name="times" size={14} color={DS.color.textMuted} />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.resultsScrollPad, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {trainingFilter ? (
          <View style={styles.filterRow}>
            <View style={styles.filterChip}>
              <FontAwesome name="heartbeat" size={12} color={DS.color.gold} />
              <Text style={styles.filterChipText}> Training</Text>
              <Pressable
                hitSlop={8}
                onPress={() => setTrainingFilter(false)}
                style={styles.filterChipX}
              >
                <FontAwesome name="times" size={10} color={DS.color.gold} />
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.resultsMetaRow}>
          <Text style={styles.resultsCount}>
            Found {results.length} result{results.length === 1 ? '' : 's'}
            {searchText.trim() || initialQ ? ` for "${searchText.trim() || initialQ}"` : ''}
          </Text>
          <View style={styles.resultsTools}>
            <Pressable style={styles.sortTrigger} onPress={() => setSortOpen(true)}>
              <Text style={styles.sortTriggerText}>{sortBy}</Text>
              <FontAwesome name="chevron-down" size={11} color={DS.color.textMuted} />
            </Pressable>
            <Pressable
              style={[styles.viewToggle, viewMode === 'grid' && styles.viewToggleOn]}
              onPress={() => setViewMode('grid')}
            >
              <FontAwesome name="th" size={14} color={viewMode === 'grid' ? DS.color.gold : DS.color.textMuted} />
            </Pressable>
            <Pressable
              style={[styles.viewToggle, viewMode === 'list' && styles.viewToggleOn]}
              onPress={() => setViewMode('list')}
            >
              <FontAwesome name="list" size={14} color={viewMode === 'list' ? DS.color.gold : DS.color.textMuted} />
            </Pressable>
          </View>
        </View>

        {viewMode === 'grid' ? (
          <View style={styles.resultsGrid}>
            {results.map((item) => (
              <Pressable
                key={item.id}
                style={styles.mediaCard}
                onPress={() => openPlayer(item.title, item.id)}
              >
                <View style={styles.mediaCardImageWrap}>
                  <Image source={{ uri: item.uri }} style={styles.mediaCardImage} />
                  <View style={styles.mediaCardPlay}>
                    <View style={styles.mediaCardPlayBtn}>
                      <FontAwesome name="play" size={16} color={DS.color.background} style={{ marginLeft: 3 }} />
                    </View>
                  </View>
                  <Text style={styles.mediaCardDuration}>{item.duration}</Text>
                  <View
                    style={[
                      styles.mediaCardBadge,
                      item.badgeVariant === 'accent' ? styles.mediaCardBadgeAccent : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.mediaCardBadgeText,
                        item.badgeVariant === 'accent' ? styles.mediaCardBadgeTextAccent : null,
                      ]}
                    >
                      {item.badge}
                    </Text>
                  </View>
                </View>
                <View style={styles.mediaCardBody}>
                  <Text style={styles.mediaCardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.mediaCardMeta}>{item.meta}</Text>
                  <View style={styles.mediaCardFooter}>
                    <View style={styles.mediaCardActions}>
                      <FontAwesome name="heart-o" size={14} color={DS.color.textMuted} />
                      <FontAwesome name="bookmark-o" size={14} color={DS.color.textMuted} />
                    </View>
                    <View style={styles.mediaCardRating}>
                      <FontAwesome name="star" size={11} color={DS.color.gold} />
                      <Text style={styles.mediaCardRatingText}>{item.rating}</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.resultsListCol}>
            {results.map((item) => (
              <Pressable
                key={item.id}
                style={styles.resultLine}
                onPress={() => openPlayer(item.title, item.id)}
              >
                <Image source={{ uri: item.uri }} style={styles.resultThumb} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.thumbTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.muted}>{item.meta}</Text>
                  <View style={styles.listRatingRow}>
                    <FontAwesome name="star" size={11} color={DS.color.gold} />
                    <Text style={styles.mediaCardRatingText}>{item.rating}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        <Pressable
          style={styles.loadMoreBtn}
          onPress={() => setLoadMoreDone(true)}
          disabled={loadMoreDone}
        >
          <Text style={[styles.loadMoreBtnText, loadMoreDone && styles.loadMoreBtnTextDone]}>
            {loadMoreDone ? 'All results loaded' : 'Load More Results'}
          </Text>
        </Pressable>
      </ScrollView>

      <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
        <View style={styles.sortModalRoot}>
          <Pressable
            style={styles.sortModalBackdrop}
            onPress={() => setSortOpen(false)}
            accessibilityLabel="Close sort options"
          />
          <View style={styles.sortModalSheet}>
            <Text style={styles.sortModalTitle}>Sort by</Text>
            {SORT_LABELS.map((label) => (
              <Pressable
                key={label}
                style={styles.sortModalRow}
                onPress={() => {
                  setSortBy(label);
                  setSortOpen(false);
                }}
              >
                <Text style={[styles.sortModalRowText, sortBy === label && styles.sortModalRowTextOn]}>
                  {label}
                </Text>
                {sortBy === label ? (
                  <FontAwesome name="check" size={16} color={DS.color.gold} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

export function MediaPlayerScreen({ navigation, route }: MProps<'MediaPlayer'>) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const title = route.params?.title ?? 'Advanced Boxing Combinations for Power';
  const mediaId = route.params?.mediaId ?? `demo:${title}`;
  const paramPlayback = route.params?.playbackUrl?.trim() || '';
  const meta = playerMeta(title);
  const playerNotice = (msg: string) => Alert.alert('The Dalton Grant Academy', msg);
  const [asset, setAsset] = useState<MediaAssetRow | null>(null);
  const [saved, setSaved] = useState(false);
  const [progress, setProgress] = useState(0.35);
  const [menuOpen, setMenuOpen] = useState(false);
  const [webFullscreenOpen, setWebFullscreenOpen] = useState(false);
  const videoRef = useRef<Video | null>(null);
  const playbackUrl = paramPlayback || asset?.public_url?.trim() || '';
  const thumb = asset?.thumbnail_url?.trim() || asset?.public_url?.trim() || PLAYER_STILL;
  const isVideo = asset?.kind === 'video' || (!!playbackUrl && !playbackUrl.match(/\.(png|jpe?g|webp|gif)(\?|$)/i));
  const displayTitle = useMemo(() => {
    const raw = (asset?.title?.trim() || title || '').trim();
    if (!raw) return 'Media';
    // If title looks like an uploaded filename, make it human-friendly.
    if (raw.match(/\.(mp4|mov|m4v|webm)$/i) || raw.match(/^\d{10,}-/)) {
      const base = raw.replace(/\.(mp4|mov|m4v|webm)$/i, '');
      return base.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
    }
    return raw;
  }, [asset?.title, title]);
  const displayDesc = asset?.description?.trim() || meta.desc;
  const displayTags =
    Array.isArray(asset?.tags) && asset.tags.length ? asset.tags.join(', ') : null;
  const parsedCategory = useMemo(() => {
    const desc = asset?.description?.trim() || '';
    const m = desc.match(/(?:^|\n)Category:\s*([^\n]+)\s*(?:\n|$)/i);
    return m?.[1]?.trim() || null;
  }, [asset?.description]);
  const cleanedDesc = useMemo(() => {
    const desc = (asset?.description?.trim() || displayDesc).trim();
    return desc.replace(/\n*Category:\s*[^\n]+\s*/gi, '\n').trim();
  }, [asset?.description, displayDesc]);
  const onFullscreen = useCallback(() => {
    if (Platform.OS === 'web') {
      setWebFullscreenOpen(true);
      return;
    }
    try {
      void videoRef.current?.presentFullscreenPlayerAsync();
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!mediaId || mediaId.startsWith('demo:')) return;
    void getMediaAssetById(mediaId).then(setAsset);
  }, [mediaId]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id || user.id.startsWith('demo-') || mediaId.startsWith('demo:')) return;
      void isMediaIdSaved(user.id, mediaId).then(setSaved);
    }, [user?.id, mediaId]),
  );

  useEffect(() => {
    void setMediaWatchProgress({
      mediaId,
      title,
      thumb,
      progress,
    });
    return () => {
      void setMediaWatchProgress({
        mediaId,
        title,
        thumb,
        progress,
      });
    };
  }, [mediaId, title, thumb, progress]);

  const toggleSave = useCallback(() => {
    if (!user?.id || user.id.startsWith('demo-')) {
      playerNotice('Sign in to save videos.');
      return;
    }
    void (async () => {
      const ok = await toggleSavedMediaId(user.id, mediaId);
      if (ok) setSaved((s) => !s);
    })();
  }, [user?.id, mediaId]);

  const goEditMedia = useCallback(() => {
    const id = asset?.id || (mediaId && !mediaId.startsWith('demo:') ? mediaId : '');
    if (!id) return;
    try {
      navigation.navigate('EditMedia', { mediaId: id });
      return;
    } catch {
      // ignore
    }
    // Fallback for nested navigation contexts
    try {
      navigation
        .getParent()
        ?.navigate('Media' as never, { screen: 'EditMedia', params: { mediaId: id } } as never);
    } catch {
      Alert.alert('Media', 'Could not open the editor.');
    }
  }, [asset?.id, mediaId, navigation]);

  const doDeleteMedia = useCallback(() => {
    const id = asset?.id || (mediaId && !mediaId.startsWith('demo:') ? mediaId : '');
    if (!id) return;
    Alert.alert('Delete media?', 'Removes this media for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const ok = await deleteMediaAsset(id);
            if (ok) {
              Alert.alert('Deleted', 'This media has been removed.');
              navigation.goBack();
            } else {
              Alert.alert('Could not delete', 'You may not have permission to delete this media.');
            }
          })();
        },
      },
    ]);
  }, [asset?.id, mediaId, navigation]);

  return (
    <View style={styles.root}>
      <View style={[styles.playerTop, { paddingTop: insets.top + DS.space.sm }]}>
        <Pressable style={styles.playerChromeBtn} onPress={() => navigation.goBack()}>
          <FontAwesome name="arrow-left" size={18} color={DS.color.text} />
        </Pressable>
        {user?.masterControl ? (
          <Pressable style={styles.playerChromeBtn} onPress={() => setMenuOpen(true)} accessibilityLabel="Media options">
            <FontAwesome name="ellipsis-v" size={18} color={DS.color.text} />
          </Pressable>
        ) : (
          <View style={styles.playerChromeBtn} />
        )}
      </View>
      <OptionMenuModal
        visible={menuOpen}
        title="Media"
        onClose={() => setMenuOpen(false)}
        options={[
          {
            key: 'edit',
            label: 'Edit media',
            onPress: () => {
              setMenuOpen(false);
              goEditMedia();
            },
          },
          {
            key: 'share',
            label: 'Share media',
            onPress: () => playerNotice('Share is not available in this preview.'),
          },
          {
            key: 'delete',
            label: 'Delete media',
            destructive: true,
            onPress: () => {
              setMenuOpen(false);
              doDeleteMedia();
            },
          },
        ]}
      />
      <View style={styles.playerStage}>
        {isVideo && playbackUrl ? (
          <Video
            ref={videoRef}
            source={{ uri: playbackUrl }}
            style={styles.playerImg}
            resizeMode={ResizeMode.CONTAIN}
            useNativeControls
            shouldPlay
            onPlaybackStatusUpdate={(st) => {
              if (!st.isLoaded) return;
              const p = st.durationMillis ? st.positionMillis / st.durationMillis : 0;
              if (Number.isFinite(p)) setProgress(Math.min(0.99, Math.max(0, p)));
            }}
          />
        ) : (
          <Image source={{ uri: thumb }} style={styles.playerImg} />
        )}
        {isVideo && playbackUrl ? (
          <Pressable style={styles.fullscreenBtn} onPress={onFullscreen} accessibilityLabel="Fullscreen video">
            <FontAwesome name="expand" size={16} color={DS.color.white} />
          </Pressable>
        ) : null}
      </View>
      <Modal visible={webFullscreenOpen} transparent animationType="fade" onRequestClose={() => setWebFullscreenOpen(false)}>
        <Pressable style={styles.webFullscreenBackdrop} onPress={() => setWebFullscreenOpen(false)}>
          <Pressable style={styles.webFullscreenSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.webFullscreenTop}>
              <Text style={styles.webFullscreenTitle} numberOfLines={1}>
                {displayTitle}
              </Text>
              <Pressable style={styles.playerChromeBtn} onPress={() => setWebFullscreenOpen(false)}>
                <FontAwesome name="times" size={18} color={DS.color.text} />
              </Pressable>
            </View>
            <View style={styles.webFullscreenStage}>
              {isVideo && playbackUrl ? (
                <Video
                  source={{ uri: playbackUrl }}
                  style={styles.webFullscreenVideo}
                  resizeMode={ResizeMode.CONTAIN}
                  useNativeControls
                  shouldPlay
                />
              ) : (
                <Image source={{ uri: thumb }} style={styles.webFullscreenVideo} />
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <ScrollView
        contentContainerStyle={[styles.padded, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.playerBadgeRow}>
          <View style={styles.playerBadgePill}>
            <Text style={styles.playerBadgeText}>{parsedCategory ?? meta.badge}</Text>
          </View>
          <Text style={styles.playerDurationLabel}>{meta.duration}</Text>
        </View>
        <Text style={styles.playerTitle}>{displayTitle}</Text>
        {!mediaId.startsWith('demo:') ? null : <Text style={styles.muted}>{meta.channelLine}</Text>}
        <Text style={styles.body}>{cleanedDesc}</Text>
        {parsedCategory ? <Text style={styles.muted}>Category: {parsedCategory}</Text> : null}
        {displayTags ? <Text style={styles.muted}>Tags: {displayTags}</Text> : null}

        <View style={styles.playerActionsRow}>
          <Pressable style={styles.playerActionGhost} onPress={toggleSave}>
            <FontAwesome name={saved ? 'bookmark' : 'bookmark-o'} size={14} color={saved ? DS.color.gold : DS.color.text} />
            <Text style={styles.playerActionGhostText}> {saved ? 'Saved' : 'Save'}</Text>
          </Pressable>
          <Pressable
            style={styles.playerActionGhost}
            onPress={() => playerNotice('Share is not available in this preview.')}
          >
            <FontAwesome name="share" size={14} color={DS.color.text} />
            <Text style={styles.playerActionGhostText}> Share</Text>
          </Pressable>
        </View>

        <Text style={styles.playerSectionTitle}>Up Next</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.upNextScroll}
        >
          {UP_NEXT_ITEMS.map((u) => (
            <Pressable
              key={u.title}
              style={styles.upNextCard}
              onPress={() => navigation.replace('MediaPlayer', { title: u.title })}
            >
              <View style={styles.upNextThumbWrap}>
                <Image source={{ uri: u.uri }} style={styles.upNextThumb} />
                <Text style={styles.upNextDur}>{u.duration}</Text>
              </View>
              <Text style={styles.upNextCardTitle} numberOfLines={2}>
                {u.title}
              </Text>
              <Text style={styles.upNextChannel}>{u.channel}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.playerSectionTitle}>Related Videos</Text>
        <View style={styles.relatedGrid}>
          {RELATED_ITEMS.map((r) => (
            <Pressable
              key={r.title}
              style={styles.relatedCard}
              onPress={() => navigation.replace('MediaPlayer', { title: r.title })}
            >
              <View style={styles.relatedImageWrap}>
                <Image source={{ uri: r.uri }} style={styles.relatedImage} />
                <Text style={styles.relatedDur}>{r.duration}</Text>
                <View style={styles.relatedBadge}>
                  <Text style={styles.relatedBadgeText}>Training</Text>
                </View>
              </View>
              <View style={styles.relatedBody}>
                <Text style={styles.relatedTitle} numberOfLines={2}>
                  {r.title}
                </Text>
                <Text style={styles.relatedMeta}>{r.meta}</Text>
                <View style={styles.relatedFooter}>
                  <View style={styles.mediaCardActions}>
                    <FontAwesome name="heart-o" size={12} color={DS.color.textMuted} />
                    <FontAwesome name="bookmark-o" size={12} color={DS.color.textMuted} />
                  </View>
                  <View style={styles.mediaCardRating}>
                    <FontAwesome name="star" size={11} color={DS.color.gold} />
                    <Text style={styles.mediaCardRatingText}>{r.rating}</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate('SavedMedia')}>
          <Text style={styles.secondaryBtnText}>Open saved library</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function savedBadgeStyles(v: SavedBadgeVariant) {
  switch (v) {
    case 'blue':
      return {
        bg: 'rgba(59, 130, 246, 0.2)',
        border: 'rgba(59, 130, 246, 0.35)',
        text: '#60a5fa',
      };
    case 'accent':
      return {
        bg: 'rgba(249, 90, 30, 0.2)',
        border: 'rgba(249, 90, 30, 0.35)',
        text: DS.color.accentOrange,
      };
    case 'green':
      return {
        bg: 'rgba(34, 197, 94, 0.2)',
        border: 'rgba(34, 197, 94, 0.35)',
        text: '#4ade80',
      };
    case 'purple':
      return {
        bg: 'rgba(168, 85, 247, 0.2)',
        border: 'rgba(168, 85, 247, 0.35)',
        text: '#c084fc',
      };
    default:
      return {
        bg: DS.color.goldTint10,
        border: DS.color.goldTint30,
        text: DS.color.gold,
      };
  }
}

export function SavedMediaScreen({ navigation }: MProps<'SavedMedia'>) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const live = isSupabaseConfigured() && user && !user.id.startsWith('demo-');
  const [filter, setFilter] = useState<(typeof SAVED_FILTER_CHIPS)[number]>('All');
  const [gridView, setGridView] = useState(true);
  const [items, setItems] = useState<SavedMediaItem[]>([]);

  const loadSaved = useCallback(async () => {
    if (!live || !user?.id) {
      setItems(isAppStoreScreenshotMode() ? SAVED_MEDIA_ITEMS : []);
      return;
    }
    const ids = await listSavedMediaIds(user.id);
    if (ids.length === 0) {
      setItems([]);
      return;
    }
    const assets = await Promise.all(ids.map((id) => getMediaAssetById(id)));
    const rows: SavedMediaItem[] = assets
      .filter((a): a is MediaAssetRow => !!a)
      .map((a) => {
        const label = a.storage_path?.split('/').pop() || a.kind.toUpperCase();
        return {
          id: a.id,
          uri: a.thumbnail_url?.trim() || a.public_url?.trim() || THUMB,
          duration: a.kind === 'video' ? 'Video' : 'Media',
          category: 'Training',
          badgeVariant: 'gold' as SavedBadgeVariant,
          title: label,
          meta: new Date(a.created_at).toLocaleDateString(),
          rating: '—',
          savedAgo: 'Saved',
        };
      });
    setItems(rows);
  }, [live, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadSaved();
    }, [loadSaved]),
  );

  const filtered = useMemo(() => {
    if (filter === 'All') return items;
    return items.filter((i) => i.category === filter);
  }, [filter, items]);

  const toggleSaved = (id: string) => {
    if (!user?.id) return;
    void (async () => {
      await toggleSavedMediaId(user.id, id);
      await loadSaved();
    })();
  };

  const openPlayer = (t: string, mediaId: string) =>
    navigation.navigate('MediaPlayer', { title: t, mediaId });

  return (
    <View style={styles.root}>
      <View style={[styles.savedHeader, { paddingTop: insets.top + DS.space.md }]}>
        <Pressable style={styles.savedIconBtn} onPress={() => navigation.navigate('MediaLibrary')} accessibilityLabel="Back to media">
          <FontAwesome name="arrow-left" size={16} color={DS.color.text} />
        </Pressable>
        <Text style={styles.savedTitle}>Saved</Text>
        <View style={styles.savedHeaderActions}>
          <Pressable
            style={styles.savedIconBtn}
            onPress={() => Alert.alert('The Dalton Grant Academy', 'Search for saved videos is not available yet.')}
          >
            <FontAwesome name="search" size={16} color={DS.color.text} />
          </Pressable>
          <Pressable style={styles.savedIconBtn} onPress={() => setGridView((g) => !g)}>
            <FontAwesome name={gridView ? 'th' : 'list'} size={16} color={DS.color.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.savedChipScroll}
      >
        {SAVED_FILTER_CHIPS.map((c) => (
          <Pressable
            key={c}
            onPress={() => setFilter(c)}
            style={[styles.savedChip, filter === c && styles.savedChipOn]}
          >
            <Text style={[styles.savedChipText, filter === c && styles.savedChipTextOn]}>{c}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.savedCount}>12 saved videos</Text>

      {filtered.length === 0 ? (
        <View style={styles.savedEmpty}>
          <View style={styles.savedEmptyIcon}>
            <FontAwesome name="bookmark-o" size={28} color={DS.color.textMuted} />
          </View>
          <Text style={styles.savedEmptyTitle}>No Saved Videos</Text>
          <Text style={styles.savedEmptyBody}>
            Start saving videos you want to watch later by tapping the bookmark icon.
          </Text>
          <Pressable style={styles.savedBrowseBtn} onPress={() => navigation.navigate('MediaLibrary')}>
            <Text style={styles.savedBrowseBtnText}>Browse Media</Text>
          </Pressable>
        </View>
      ) : gridView ? (
        <ScrollView
          contentContainerStyle={[styles.savedGridPad, { paddingBottom: 100 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.savedGrid}>
            {filtered.map((item) => {
              const b = savedBadgeStyles(item.badgeVariant);
              return (
                <View key={item.id} style={styles.savedCard}>
                  <Pressable onPress={() => openPlayer(item.title, item.id)}>
                    <View style={styles.savedCardImageWrap}>
                      <Image source={{ uri: item.uri }} style={styles.savedCardImage} />
                      <View style={styles.savedCardPlay}>
                        <View style={styles.savedPlayCircle}>
                          <FontAwesome name="play" size={12} color={DS.color.background} style={{ marginLeft: 2 }} />
                        </View>
                      </View>
                      <Text style={styles.savedCardDuration}>{item.duration}</Text>
                      <View style={[styles.savedCatBadge, { backgroundColor: b.bg, borderColor: b.border }]}>
                        <Text style={[styles.savedCatBadgeText, { color: b.text }]}>{item.category}</Text>
                      </View>
                    </View>
                    <View style={styles.savedCardBody}>
                      <Text style={styles.savedCardTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <Text style={styles.savedCardMeta}>{item.meta}</Text>
                      <View style={styles.savedCardFooter}>
                        <View style={styles.mediaCardRating}>
                          <FontAwesome name="star" size={11} color={DS.color.gold} />
                          <Text style={styles.mediaCardRatingText}>{item.rating}</Text>
                        </View>
                        <Text style={styles.savedAgo}>{item.savedAgo}</Text>
                      </View>
                    </View>
                  </Pressable>
                  <Pressable style={styles.savedBookmarkFab} onPress={() => toggleSaved(item.id)}>
                    <FontAwesome name="bookmark" size={14} color={DS.color.gold} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.padded, { paddingBottom: 100 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          {filtered.map((item) => (
            <Pressable key={item.id} style={styles.resultLine} onPress={() => openPlayer(item.title, item.id)}>
              <Image source={{ uri: item.uri }} style={styles.resultThumb} />
              <View style={{ flex: 1 }}>
                <Text style={styles.thumbTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.muted}>{item.meta}</Text>
                <Text style={styles.savedAgo}>{item.savedAgo}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

export function MediaCommunityFeedScreen({ navigation }: MProps<'MediaCommunityFeed'>) {
  return (
    <View style={styles.root}>
      <View style={styles.rowHeader}>
        <Pressable onPress={() => navigation.goBack()}>
          <FontAwesome name="arrow-left" size={22} color={DS.color.text} />
        </Pressable>
        <Text style={styles.rowTitle}>COMMUNITY CLIPS</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={styles.padded}>
        <Text style={styles.muted}>Cross-promo from media — opens same feed as Community tab.</Text>
        <Pressable
          onPress={() =>
            navigation.getParent()?.navigate('Community', { screen: 'CommunityFeed' })
          }
        >
          <Text style={styles.linkGold}>Open community feed</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: DS.color.background,
  },
  mediaTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mediaTitle: {
    ...tabRootTitleText,
  },
  mediaHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
  },
  roundIconBtnSm: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: DS.color.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DS.color.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    alignSelf: 'stretch',
    width: '100%',
    marginHorizontal: 0,
    aspectRatio: 4 / 3,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: DS.color.surface,
    marginBottom: DS.space.lg,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  heroPlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: DS.color.goldTint90,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
  },
  heroBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: DS.space.lg,
    backgroundColor: DS.color.scrimBottom,
  },
  heroKicker: {
    fontFamily: DS.font.bodyBold,
    fontSize: 11,
    color: DS.color.gold,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  heroHead: {
    fontFamily: DS.font.heading,
    fontSize: 28,
    color: DS.color.white,
    letterSpacing: 1,
  },
  durationPill: {
    backgroundColor: DS.color.surfaceFloating92,
    paddingHorizontal: DS.space.md,
    paddingVertical: 6,
    borderRadius: DS.radius.pill,
  },
  durationPillText: {
    fontSize: 12,
    color: DS.color.text,
    fontWeight: '600',
  },
  browseLabel: {
    fontFamily: DS.font.bodyBold,
    fontSize: 14,
    color: DS.color.gold,
    letterSpacing: 3,
    marginLeft: DS.space.lg,
    marginBottom: DS.space.md,
  },
  browseRow: {
    paddingHorizontal: DS.space.lg,
    gap: DS.space.md,
    marginBottom: DS.space.lg,
  },
  browseChip: {
    paddingHorizontal: DS.space.lg,
    paddingVertical: DS.space.sm + 2,
    borderRadius: DS.radius.pill,
    backgroundColor: DS.color.surfaceAlt,
    borderWidth: 1,
    borderColor: DS.color.borderHairlineLight,
    marginRight: DS.space.sm,
  },
  browseChipOn: {
    backgroundColor: DS.color.gold,
    borderColor: DS.color.gold,
  },
  browseChipText: {
    color: DS.color.text,
    fontWeight: '600',
    fontSize: 14,
  },
  browseChipTextOn: {
    color: DS.color.background,
  },
  grid2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: DS.space.base,
  },
  gridCell: {
    width: '48%',
    marginBottom: DS.space.lg,
  },
  thumbWrap: {
    aspectRatio: 16 / 9,
    borderRadius: DS.radius.xxl,
    overflow: 'hidden',
    backgroundColor: DS.color.surface,
    marginBottom: DS.space.sm,
  },
  thumbImg: {
    width: '100%',
    height: '100%',
    opacity: 0.85,
  },
  thumbDur: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: DS.color.overlayDark80,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  thumbDurText: {
    fontSize: 10,
    color: DS.color.white,
    fontWeight: '600',
  },
  thumbTag: {
    fontSize: 10,
    fontWeight: '700',
    color: DS.color.gold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  thumbTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: DS.color.text,
    lineHeight: 18,
  },
  continueCard: {
    flexDirection: 'row',
    gap: DS.space.md,
    marginHorizontal: DS.space.base,
    marginBottom: DS.space.xl,
    backgroundColor: DS.color.surface,
    borderRadius: DS.radius.xl,
    padding: DS.space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.borderWhite5,
  },
  continueThumb: {
    width: 120,
    height: 68,
    borderRadius: DS.radius.md,
  },
  continueTitle: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 15,
    color: DS.color.text,
    marginBottom: 4,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: DS.color.input,
    marginTop: DS.space.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: DS.color.gold,
  },
  mediaSearchTop: {
    paddingBottom: DS.space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.color.borderWhite5,
  },
  mediaSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DS.space.lg,
    marginBottom: DS.space.md,
  },
  mediaSearchTitle: {
    ...tabRootTitleText,
  },
  mediaSearchInputFull: {
    marginHorizontal: DS.space.lg,
    backgroundColor: DS.color.input,
    borderRadius: DS.radius.lg,
    padding: DS.space.md,
    color: DS.color.text,
    fontSize: 16,
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  catCell: {
    width: '31%',
    aspectRatio: 1,
    backgroundColor: DS.color.surface,
    borderRadius: DS.radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: DS.space.sm,
    marginBottom: DS.space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.borderHairlineLight,
  },
  catLabel: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 11,
    color: DS.color.text,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  mediaSearchGo: {
    marginTop: DS.space.xl,
    alignItems: 'center',
  },
  mediaSearchInput: {
    flex: 1,
    backgroundColor: DS.color.input,
    borderRadius: DS.radius.lg,
    padding: DS.space.md,
    color: DS.color.text,
    fontSize: 16,
  },
  padded: {
    padding: DS.space.lg,
  },
  linkGold: {
    color: DS.color.gold,
    fontWeight: '600',
    fontSize: 16,
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
  resultLine: {
    flexDirection: 'row',
    gap: DS.space.md,
    marginTop: DS.space.lg,
    alignItems: 'center',
  },
  resultThumb: {
    width: 120,
    height: 68,
    borderRadius: DS.radius.md,
  },
  muted: {
    color: DS.color.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: DS.space.sm,
  },
  playerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: DS.space.base,
    paddingBottom: DS.space.sm,
  },
  playerStage: {
    height: 280,
    backgroundColor: DS.color.black,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerImg: {
    width: '100%',
    height: '100%',
    alignSelf: 'center',
  },
  playerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: DS.color.overlayLight35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playHuge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: DS.color.goldTint90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerControls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: DS.space.base,
  },
  trackBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    marginBottom: DS.space.md,
  },
  trackFill: {
    height: 4,
    backgroundColor: DS.color.gold,
    borderRadius: 2,
    position: 'relative',
  },
  trackKnob: {
    position: 'absolute',
    right: -6,
    top: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: DS.color.gold,
  },
  playerScrubWrap: {
    marginBottom: DS.space.md,
  },
  ctrlLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
  },
  ctrlRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
  },
  playerChromeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(28, 28, 28, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenBtn: {
    position: 'absolute',
    right: DS.space.base,
    bottom: DS.space.base,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(28, 28, 28, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webFullscreenBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    padding: DS.space.base,
    justifyContent: 'center',
  },
  webFullscreenSheet: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    backgroundColor: DS.color.background,
    borderRadius: DS.radius.xl,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.borderWhite5,
  },
  webFullscreenTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DS.space.base,
    paddingVertical: DS.space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.color.borderWhite5,
  },
  webFullscreenTitle: {
    flex: 1,
    marginRight: DS.space.md,
    color: DS.color.text,
    fontFamily: DS.font.bodyMedium,
    fontSize: 14,
  },
  webFullscreenStage: {
    backgroundColor: DS.color.black,
    width: '100%',
    aspectRatio: 16 / 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webFullscreenVideo: {
    width: '100%',
    height: '100%',
  },
  ctrlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeText: {
    color: DS.color.white,
    fontSize: 14,
  },
  playerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: DS.color.text,
    marginTop: DS.space.md,
  },
  body: {
    marginTop: DS.space.lg,
    fontSize: 15,
    lineHeight: 24,
    color: DS.color.text,
  },
  secondaryBtn: {
    marginTop: DS.space.xl,
    borderWidth: 1,
    borderColor: DS.color.gold,
    paddingVertical: DS.space.md,
    borderRadius: DS.radius.lg,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: DS.color.gold,
    fontWeight: '700',
  },
  resultsStickyHeader: {
    paddingHorizontal: DS.space.lg,
    paddingBottom: DS.space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.color.borderWhite5,
    backgroundColor: DS.color.background,
  },
  resultsTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
    marginBottom: DS.space.md,
  },
  resultsBackCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DS.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsHeroTitle: {
    ...tabRootTitleText,
  },
  resultsSearchWrap: {
    position: 'relative',
  },
  resultsSearchInput: {
    backgroundColor: DS.color.surface,
    borderWidth: 1,
    borderColor: DS.color.borderWhite5,
    borderRadius: DS.radius.xxl,
    paddingVertical: DS.space.md,
    paddingHorizontal: DS.space.lg,
    paddingRight: 88,
    color: DS.color.text,
    fontSize: 15,
  },
  resultsSearchIcons: {
    position: 'absolute',
    right: DS.space.md,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
  },
  resultsIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: DS.color.goldTint10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsIconCircleMuted: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(212, 208, 200, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsScrollPad: {
    paddingHorizontal: DS.space.lg,
    paddingTop: DS.space.lg,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DS.space.sm,
    marginBottom: DS.space.lg,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: DS.space.md,
    borderRadius: DS.radius.pill,
    backgroundColor: DS.color.goldTint10,
    borderWidth: 1,
    borderColor: DS.color.goldTint30,
  },
  filterChipText: {
    fontSize: 13,
    color: DS.color.gold,
    fontWeight: '600',
  },
  filterChipX: {
    marginLeft: 6,
    padding: 4,
  },
  resultsMetaRow: {
    marginBottom: DS.space.lg,
    gap: DS.space.md,
  },
  resultsCount: {
    fontSize: 13,
    color: DS.color.textMuted,
    lineHeight: 18,
  },
  resultsTools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
    flexWrap: 'wrap',
  },
  sortTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: DS.color.surface,
    borderWidth: 1,
    borderColor: DS.color.borderWhite5,
    borderRadius: DS.radius.xl,
    paddingVertical: 8,
    paddingHorizontal: DS.space.md,
    paddingRight: DS.space.base,
  },
  sortTriggerText: {
    fontSize: 13,
    color: DS.color.text,
    fontWeight: '500',
  },
  viewToggle: {
    width: 40,
    height: 40,
    borderRadius: DS.radius.xl,
    backgroundColor: DS.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: DS.color.borderWhite5,
  },
  viewToggleOn: {
    backgroundColor: DS.color.goldTint10,
    borderColor: DS.color.goldTint30,
  },
  resultsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: DS.space.md,
  },
  mediaCard: {
    width: '47.5%',
    backgroundColor: DS.color.surface,
    borderRadius: DS.radius.xxl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: DS.color.borderWhite5,
    marginBottom: DS.space.sm,
  },
  mediaCardImageWrap: {
    position: 'relative',
    height: 120,
    backgroundColor: DS.color.surfaceAlt,
  },
  mediaCardImage: {
    width: '100%',
    height: '100%',
  },
  mediaCardPlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  mediaCardPlayBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(200, 168, 75, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaCardDuration: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: DS.color.overlayDark80,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    color: DS.color.white,
    fontSize: 11,
    fontWeight: '600',
  },
  mediaCardBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: DS.radius.pill,
    backgroundColor: DS.color.goldTint10,
    borderWidth: 1,
    borderColor: DS.color.goldTint30,
  },
  mediaCardBadgeAccent: {
    backgroundColor: 'rgba(249, 90, 30, 0.2)',
    borderColor: 'rgba(249, 90, 30, 0.35)',
  },
  mediaCardBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: DS.color.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mediaCardBadgeTextAccent: {
    color: DS.color.accentOrange,
  },
  mediaCardBody: {
    padding: DS.space.md,
  },
  mediaCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: DS.color.text,
    lineHeight: 18,
    marginBottom: 6,
  },
  mediaCardMeta: {
    fontSize: 11,
    color: DS.color.textMuted,
    marginBottom: DS.space.sm,
  },
  mediaCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mediaCardActions: {
    flexDirection: 'row',
    gap: DS.space.md,
  },
  mediaCardRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mediaCardRatingText: {
    fontSize: 11,
    fontWeight: '600',
    color: DS.color.gold,
  },
  resultsListCol: {
    gap: 0,
  },
  listRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  loadMoreBtn: {
    alignSelf: 'center',
    marginTop: DS.space.xl,
    marginBottom: DS.space.lg,
    paddingVertical: DS.space.md,
    paddingHorizontal: DS.space.xl,
    borderRadius: DS.radius.xl,
    backgroundColor: DS.color.surface,
    borderWidth: 1,
    borderColor: DS.color.borderWhite5,
  },
  loadMoreBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: DS.color.text,
  },
  loadMoreBtnTextDone: {
    color: DS.color.textMuted,
    fontWeight: '500',
  },
  sortModalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: DS.space.lg,
  },
  sortModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  sortModalSheet: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: DS.color.surface,
    borderRadius: DS.radius.xxl,
    borderWidth: 1,
    borderColor: DS.color.borderWhite5,
    paddingVertical: DS.space.md,
    paddingHorizontal: DS.space.sm,
  },
  sortModalTitle: {
    fontFamily: DS.font.bodyBold,
    fontSize: 16,
    color: DS.color.text,
    paddingHorizontal: DS.space.md,
    paddingBottom: DS.space.sm,
    marginBottom: DS.space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.color.borderHairline,
  },
  sortModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: DS.space.md,
    paddingHorizontal: DS.space.md,
    borderRadius: DS.radius.md,
  },
  sortModalRowText: {
    fontSize: 15,
    color: DS.color.text,
  },
  sortModalRowTextOn: {
    color: DS.color.gold,
    fontWeight: '600',
  },
  playerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
    marginBottom: DS.space.md,
  },
  playerBadgePill: {
    paddingHorizontal: DS.space.md,
    paddingVertical: 6,
    borderRadius: DS.radius.pill,
    backgroundColor: DS.color.goldTint10,
    borderWidth: 1,
    borderColor: DS.color.goldTint30,
  },
  playerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: DS.color.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  playerDurationLabel: {
    fontSize: 14,
    color: DS.color.textMuted,
  },
  playerActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DS.space.sm,
    marginTop: DS.space.lg,
    marginBottom: DS.space.xl,
  },
  playerActionGold: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: DS.space.md,
    borderRadius: DS.radius.xl,
    backgroundColor: DS.color.goldTint10,
    borderWidth: 1,
    borderColor: DS.color.goldTint30,
  },
  playerActionGoldText: {
    fontSize: 13,
    fontWeight: '600',
    color: DS.color.gold,
  },
  playerActionGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: DS.space.md,
    borderRadius: DS.radius.xl,
    backgroundColor: DS.color.surface,
    borderWidth: 1,
    borderColor: DS.color.borderWhite5,
  },
  playerActionGhostText: {
    fontSize: 13,
    fontWeight: '600',
    color: DS.color.text,
  },
  playerSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DS.color.text,
    marginBottom: DS.space.md,
  },
  upNextScroll: {
    gap: DS.space.md,
    paddingBottom: DS.space.lg,
  },
  upNextCard: {
    width: 192,
    backgroundColor: DS.color.surface,
    borderRadius: DS.radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: DS.color.borderWhite5,
    marginRight: DS.space.md,
  },
  upNextThumbWrap: {
    position: 'relative',
    height: 112,
    backgroundColor: DS.color.surfaceAlt,
  },
  upNextThumb: {
    width: '100%',
    height: '100%',
  },
  upNextDur: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: DS.color.overlayDark80,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    color: DS.color.white,
    fontSize: 10,
    fontWeight: '600',
  },
  upNextCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: DS.color.text,
    paddingHorizontal: DS.space.md,
    paddingTop: DS.space.sm,
    lineHeight: 18,
  },
  upNextChannel: {
    fontSize: 11,
    color: DS.color.textMuted,
    paddingHorizontal: DS.space.md,
    paddingBottom: DS.space.md,
    paddingTop: 4,
  },
  relatedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: DS.space.md,
    marginBottom: DS.space.lg,
  },
  relatedCard: {
    width: '47.5%',
    backgroundColor: DS.color.surface,
    borderRadius: DS.radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: DS.color.borderWhite5,
    marginBottom: DS.space.sm,
  },
  relatedImageWrap: {
    height: 120,
    position: 'relative',
    backgroundColor: DS.color.surfaceAlt,
  },
  relatedImage: {
    width: '100%',
    height: '100%',
  },
  relatedDur: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: DS.color.overlayDark80,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    color: DS.color.white,
    fontSize: 10,
    fontWeight: '600',
  },
  relatedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: DS.radius.pill,
    backgroundColor: DS.color.goldTint10,
    borderWidth: 1,
    borderColor: DS.color.goldTint30,
  },
  relatedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: DS.color.gold,
    textTransform: 'uppercase',
  },
  relatedBody: {
    padding: DS.space.sm + 2,
  },
  relatedTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: DS.color.text,
    marginBottom: 4,
    lineHeight: 18,
  },
  relatedMeta: {
    fontSize: 11,
    color: DS.color.textMuted,
    marginBottom: DS.space.sm,
  },
  relatedFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  savedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DS.space.base,
    paddingBottom: DS.space.md,
  },
  savedTitle: {
    ...tabRootTitleText,
    flex: 1,
    textAlign: 'center',
  },
  savedHeaderActions: {
    flexDirection: 'row',
    gap: DS.space.md,
  },
  savedIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(26, 26, 26, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedChipScroll: {
    paddingHorizontal: DS.space.base,
    paddingBottom: DS.space.md,
    gap: DS.space.sm,
  },
  savedChip: {
    paddingHorizontal: DS.space.lg,
    paddingVertical: DS.space.sm + 2,
    borderRadius: DS.radius.pill,
    backgroundColor: DS.color.surfaceAlt,
    borderWidth: 1,
    borderColor: DS.color.borderHairlineLight,
    marginRight: DS.space.sm,
    alignSelf: 'flex-start',
  },
  savedChipOn: {
    backgroundColor: DS.color.gold,
    borderColor: DS.color.gold,
  },
  savedChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: DS.color.text,
  },
  savedChipTextOn: {
    color: DS.color.background,
  },
  savedCount: {
    fontSize: 13,
    color: DS.color.textMuted,
    paddingHorizontal: DS.space.base,
    marginBottom: DS.space.md,
  },
  savedEmpty: {
    alignItems: 'center',
    paddingHorizontal: DS.space.xl,
    paddingVertical: DS.space.xxl,
  },
  savedEmptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: DS.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: DS.space.md,
  },
  savedEmptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: DS.color.text,
    marginBottom: DS.space.sm,
  },
  savedEmptyBody: {
    fontSize: 14,
    color: DS.color.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: DS.space.xl,
  },
  savedBrowseBtn: {
    paddingVertical: DS.space.md,
    paddingHorizontal: DS.space.xl,
    borderRadius: DS.radius.xl,
    backgroundColor: DS.color.gold,
  },
  savedBrowseBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: DS.color.background,
  },
  savedGridPad: {
    paddingHorizontal: DS.space.base,
  },
  savedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: DS.space.md,
  },
  savedCard: {
    width: '47.5%',
    backgroundColor: DS.color.surface,
    borderRadius: DS.radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: DS.color.borderWhite5,
    marginBottom: DS.space.sm,
    position: 'relative',
  },
  savedCardImageWrap: {
    height: 140,
    position: 'relative',
    backgroundColor: DS.color.surfaceAlt,
  },
  savedCardImage: {
    width: '100%',
    height: '100%',
  },
  savedCardPlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  savedPlayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(200, 168, 75, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedCardDuration: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: DS.color.overlayDark80,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    color: DS.color.white,
    fontSize: 10,
    fontWeight: '600',
  },
  savedCatBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: DS.radius.pill,
    borderWidth: 1,
  },
  savedCatBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  savedBookmarkFab: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedCardBody: {
    padding: DS.space.sm + 2,
  },
  savedCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: DS.color.text,
    lineHeight: 18,
    marginBottom: 4,
  },
  savedCardMeta: {
    fontSize: 11,
    color: DS.color.textMuted,
    marginBottom: DS.space.sm,
  },
  savedCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  savedAgo: {
    fontSize: 11,
    color: 'rgba(212, 208, 200, 0.45)',
  },
});
