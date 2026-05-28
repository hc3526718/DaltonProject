import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type ReactElement } from 'react';
import {
  ActionSheetIOS,
  Alert,
  AppState,
  Image,
  type ImageSourcePropType,
  type LayoutChangeEvent,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { AppLoadingIndicator } from '../components/AppLoadingIndicator';
import { OptionMenuModal, type OptionMenuItem } from '../components/OptionMenuModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { PostCommentsSheet } from '../components/PostCommentsSheet';
import { CaptionComposer } from '../components/CaptionComposer';
import { BrandLogo } from '../components/BrandLogo';
import { PullRefreshRiveOverlay } from '../components/PullRefreshRiveOverlay';
import { DS, tabRootHeaderPadding, tabRootTitleText } from '../designSystem';
import { assertCanMessageRecipient } from '../messaging/messagingPolicy';
import { listFollowingProfiles } from '../roadmap/followService';
import { resolveCanMessagePeer } from '../roadmap/messagingGateService';
import { formatAuthorDisplayName } from '../lib/communityPostBody';
import {
  isScreenshotSampleConversationId,
  SCREENSHOT_INBOX_EXTRAS,
} from '../data/appStoreScreenshotSamples';
import { isAppStoreScreenshotMode, isSupabaseConfigured } from '../lib/env';
import { webCommunityFeedPaneStyle, webPageShellStyle } from '../layout/webLayout';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { PostFeedMedia } from '../components/PostFeedMedia';
import { canSubmitCommunityPost } from '../roadmap/communityPolicy';
import { getSupabase } from '../lib/supabase';
import { parsePostBody } from '../lib/communityPostBody';
import {
  enrichPostWithAuthor,
  insertCommunityPost,
  listRecentCommunityPosts,
  listAllEvents,
  getEventsByIds,
  deleteCommunityPost,
  getSubscriptionOfferPageById,
  deleteSubscriptionOfferPage,
  searchCommunityPosts,
  subscribeCommunityPosts,
  type CommunityPostFeedRow,
} from '../roadmap/liveDataService';
import {
  addPostComment,
  getPostCommentCount,
  getPostLikeCount,
  getTopPostReactions,
  getUserHasLikedPost,
  likePost,
  listPostComments,
  setPostReaction,
  submitPostReport,
  unlikePost,
  type PostCommentRow,
  type PostReportReason,
  type ReactionSummary,
} from '../roadmap/communityInteractionsService';
import { logShareActivity } from '../sharing/shareActivityLog';
import {
  clearInAppNotifications,
  listInAppNotifications,
  markAllInAppNotificationsRead,
  markInAppNotificationRead,
  type InAppNotification,
} from '../roadmap/notificationsService';
import {
  blockUser,
  clearConversationMessages,
  getOrCreateConversationId,
  listConversationSummaries,
  listMessages,
  sendMediaMessage,
  sendTextMessage,
  type ConversationSummary,
} from '../roadmap/messagingService';
import { fetchProfileByUserId } from '../roadmap/profileService';
import {
  clampComposerMedia,
  inferContentType,
  inferExt,
  MAX_COMPOSER_IMAGES,
  MAX_COMPOSER_VIDEOS,
  MAX_COMPOSER_VIDEO_MS,
  pickerAssetIsVideo,
  pickerVideoDurationMs,
  type ComposerMedia,
} from '../lib/mediaComposer';
import { resolveProfileAvatarSource, isDaltonDefaultAvatarSource } from '../lib/profileAvatar';
import { useCommunityStyles, useCommunityTheme } from './community/CommunityStylesContext';
import { useAccessibility } from '../accessibility/AccessibilityContext';
import type { MessageRow, SubscriptionOfferPageRow } from '../roadmap/types';
import type { CommunityStackParamList, SponsorsStackParamList } from '../navigation/types';
import { useActionBanner } from '../actionBanner/ActionBannerContext';
import { requestProposalOutcomeModal } from '../lib/proposalOutcomeBridge';
import {
  navigateFromInAppNotification,
  notificationIconForLink,
} from '../lib/notificationNavigation';
import { useActivityBadges } from '../activity/ActivityBadgeProvider';
import { markMessagesSeen, markNotificationsSeen } from '../lib/activityBadges';
import { useRefreshWithMinimum } from '../hooks/useRefreshWithMinimum';
import { pullRefreshControl } from '../lib/pullRefreshUi';
import { DALTON_LOGO_FINAL_IMG } from '../constants/brandAssets';

type CProps<K extends keyof CommunityStackParamList> = NativeStackScreenProps<
  CommunityStackParamList,
  K
>;

type BrandPartnerScreenProps =
  | NativeStackScreenProps<CommunityStackParamList, 'BrandPartner'>
  | NativeStackScreenProps<SponsorsStackParamList, 'BrandPartner'>;

function parseSponsorDescriptionForFeatured(
  description: string | null,
): { hook: string; helpsAthletes: string; contactEmail: string } {
  const desc = (description ?? '').trim();
  if (!desc) return { hook: '', helpsAthletes: '', contactEmail: '' };
  const contactMatch = desc.match(/(?:^|\n)Contact:\s*([^\n]+)\s*(?:\n|$)/i);
  const contactEmail = contactMatch?.[1]?.trim() || '';
  const helpsMatch = desc.match(/How this helps athletes:\s*\n([\s\S]*)/i);
  const helpsAthletes = helpsMatch?.[1]?.trim() || '';
  const hook = desc
    .split(/\n\nHow this helps athletes:\s*\n/i)[0]
    ?.replace(/\n*Contact:\s*[^\n]+\s*/gi, '\n')
    .trim();
  return { hook: hook || '', helpsAthletes, contactEmail };
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function RichTextMentions({ text }: { text: string }) {
  const styles = useCommunityStyles();
  const parts = useMemo(() => {
    const re = /([@#][A-Za-z0-9_]+)/g;
    const out: { k: string; v: string; gold: boolean }[] = [];
    let i = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      if (start > i) out.push({ k: `${i}-t`, v: text.slice(i, start), gold: false });
      out.push({ k: `${start}-m`, v: m[0], gold: true });
      i = end;
    }
    if (i < text.length) out.push({ k: `${i}-e`, v: text.slice(i), gold: false });
    return out.length ? out : [{ k: '0', v: text, gold: false }];
  }, [text]);
  return (
    <Text style={styles.postBody}>
      {parts.map((p) =>
        p.gold ? (
          <Text key={p.k} style={styles.mentionGold}>
            {p.v}
          </Text>
        ) : (
          p.v
        ),
      )}
    </Text>
  );
}

function HighlightBody({ text, query }: { text: string; query: string }) {
  const { colors } = useAccessibility();
  const highlightBodyTextStyle = useMemo(
    () => ({
      fontFamily: DS.font.body,
      fontSize: 14,
      lineHeight: 22,
      color: colors.text,
    }),
    [colors.text],
  );
  const highlightGoldTextStyle = useMemo(
    () => ({
      fontFamily: DS.font.bodyMedium,
      fontSize: 14,
      lineHeight: 22,
      color: colors.gold,
      fontWeight: '600' as const,
    }),
    [colors.gold],
  );
  const nodes = useMemo(() => {
    const q = query.trim();
    if (!q) return [{ key: '0', segment: text as string, gold: false }];
    const re = new RegExp(`(${escapeRegExp(q)})`, 'gi');
    return text.split(re).map((segment, i) => ({
      key: `${i}-${segment.slice(0, 8)}`,
      segment,
      gold: segment.toLowerCase() === q.toLowerCase(),
    }));
  }, [text, query]);
  return (
    <Text style={highlightBodyTextStyle}>
      {nodes.map(({ key, segment, gold }) =>
        gold ? (
          <Text key={key} style={highlightGoldTextStyle}>
            {segment}
          </Text>
        ) : (
          segment
        ),
      )}
    </Text>
  );
}

const FILTERS = ['All', 'Sprints', 'Jumps', 'Youth', 'Academy'] as const;

function formatRelativePostTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Math.max(0, Date.now() - t);
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  if (hr < 48) return 'Yesterday';
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function TabIconWithBadge({
  children,
  show,
}: {
  children: ReactElement;
  show: boolean;
}) {
  return (
    <View>
      {children}
      {show ? (
        <View
          style={{
            position: 'absolute',
            top: -2,
            right: -4,
            width: 9,
            height: 9,
            borderRadius: 5,
            backgroundColor: '#ef4444',
            borderWidth: 1,
            borderColor: DS.color.background,
          }}
        />
      ) : null}
    </View>
  );
}

export function CommunityFeedScreen({ navigation }: CProps<'CommunityFeed'>) {
  const { styles, colors } = useCommunityTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { unreadNotifications, unreadMessages, clearNotificationBadge, clearMessageBadge } =
    useActivityBadges();
  const [feedPosts, setFeedPosts] = useState<CommunityPostFeedRow[]>([]);
  const [feedLoading, setFeedLoading] = useState(() => isSupabaseConfigured());
  const [eventTitleMap, setEventTitleMap] = useState<Map<string, string>>(new Map());

  const liveMode = isSupabaseConfigured();
  /** With Supabase configured, never show HTML/demo posts — only real rows or empty state. */
  const demoCommunityAudience = !liveMode;

  const loadFeed = useCallback(async () => {
    if (!liveMode) {
      setFeedLoading(false);
      return;
    }
    setFeedLoading(true);
    const rows = await listRecentCommunityPosts(30);
    setFeedPosts(rows);
    setFeedLoading(false);
  }, [liveMode, user?.id]);

  const reloadFeedQuiet = useCallback(async () => {
    if (!liveMode) return;
    const rows = await listRecentCommunityPosts(30);
    setFeedPosts(rows);
  }, [liveMode]);

  const { refreshing, onRefresh } = useRefreshWithMinimum(reloadFeedQuiet, 4000);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  useFocusEffect(
    useCallback(() => {
      void loadFeed();
    }, [loadFeed]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reloadFeedQuiet();
    });
    return () => sub.remove();
  }, [reloadFeedQuiet]);

  useEffect(() => {
    if (!liveMode) return;
    return subscribeCommunityPosts((change) => {
      if (change.event === 'DELETE') {
        setFeedPosts((prev) => prev.filter((p) => p.id !== change.id));
        return;
      }
      void enrichPostWithAuthor(change.row).then((full) => {
        setFeedPosts((prev) => {
          const i = prev.findIndex((p) => p.id === full.id);
          if (i >= 0) {
            const next = [...prev];
            next[i] = full;
            return next;
          }
          return [full, ...prev]
            .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
            .slice(0, 30);
        });
      });
    });
  }, [liveMode]);

  useEffect(() => {
    const ids = new Set<string>();
    for (const p of feedPosts) {
      const { eventId } = parsePostBody(p.body);
      if (eventId) ids.add(eventId);
    }
    if (ids.size === 0) {
      setEventTitleMap(new Map());
      return;
    }
    void (async () => {
      const m = await getEventsByIds([...ids]);
      const next = new Map<string, string>();
      m.forEach((v, k) => next.set(k, v.title));
      setEventTitleMap(next);
    })();
  }, [feedPosts]);

  const removePost = useCallback((id: string) => {
    setFeedPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const feedIsWeb = Platform.OS === 'web';

  const renderFeedPost = useCallback(
    (p: CommunityPostFeedRow) => {
      const { displayBody, eventId } = parsePostBody(p.body);
      return (
        <PostCard
          postId={p.id}
          authorId={p.author_id}
          avatar={resolveProfileAvatarSource(p.author_avatar_url)}
          name={p.author_display_name?.trim() || 'Member'}
          time={formatRelativePostTime(p.created_at)}
          body={displayBody}
          imageUri={p.attachments?.find((a) => a.kind === 'image')?.uri}
          media={p.attachments}
          likes={0}
          heartFilled={false}
          comments={0}
          eventId={eventId}
          eventTitle={eventId ? eventTitleMap.get(eventId) : undefined}
          onPostDeleted={removePost}
        />
      );
    },
    [eventTitleMap, removePost],
  );

  const feedPane = feedIsWeb && !demoCommunityAudience ? (
    <View style={[styles.feedWebColumn, webCommunityFeedPaneStyle()]}>
      {feedLoading ? (
        <AppLoadingIndicator style={{ marginVertical: DS.space.lg }} />
      ) : feedPosts.length === 0 ? (
        <Text style={[styles.feedEmptyText, styles.feedList]}>No posts yet. Yours can be the first.</Text>
      ) : (
        <FlatList
          data={feedPosts}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <View>{renderFeedPost(item)}</View>}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.feedList, { paddingBottom: 124 + insets.bottom }]}
          refreshControl={liveMode ? pullRefreshControl(refreshing, onRefresh) : undefined}
        />
      )}
    </View>
  ) : null;

  return (
    <View style={[styles.root, feedIsWeb && styles.rootWebFull]}>
      <PullRefreshRiveOverlay visible={refreshing} topInset={insets.top} />
      <View
        style={[
          styles.feedHeader,
          tabRootHeaderPadding,
          webPageShellStyle(),
          { paddingTop: insets.top + DS.space.md },
        ]}
      >
        <View style={styles.feedHeaderRow}>
          <Text style={styles.communityTitle}>COMMUNITY</Text>
          <View style={styles.feedHeaderActions}>
            <Pressable onPress={() => navigation.navigate('CommunitySearch')}>
              <FontAwesome name="search" size={20} color={colors.gold} />
            </Pressable>
            <Pressable
              onPress={() => {
                void clearMessageBadge();
                navigation.navigate('MessagesInbox');
              }}
            >
              <TabIconWithBadge show={unreadMessages > 0}>
                <FontAwesome5 name="paper-plane" size={18} color={colors.gold} solid={false} />
              </TabIconWithBadge>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              onPress={() => {
                void clearNotificationBadge();
                navigation.navigate('Notifications');
              }}
              hitSlop={8}
            >
              <TabIconWithBadge show={unreadNotifications > 0}>
                <FontAwesome name="bell-o" size={20} color={colors.gold} />
              </TabIconWithBadge>
            </Pressable>
          </View>
        </View>
      </View>
      {feedPane ? (
        feedPane
      ) : (
        <ScrollView
          contentContainerStyle={[styles.feedList, { paddingBottom: 124 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          refreshControl={liveMode ? pullRefreshControl(refreshing, onRefresh) : undefined}
        >
          {demoCommunityAudience ? (
            <>
              {!liveMode ? (
                <Text style={styles.feedSampleKicker}>
                  Example posts shown while the database is not configured.
                </Text>
              ) : null}
              {!liveMode ? <CommunityDemoPostList navigation={navigation} /> : null}
            </>
          ) : (
            <>
              {feedLoading ? (
                <AppLoadingIndicator style={{ marginVertical: DS.space.lg }} />
              ) : feedPosts.length === 0 ? (
                <Text style={styles.feedEmptyText}>No posts yet. Yours can be the first.</Text>
              ) : (
                feedPosts.map((p) => <View key={p.id}>{renderFeedPost(p)}</View>)
              )}
            </>
          )}
        </ScrollView>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="New post"
        style={[
          styles.communityFab,
          { bottom: 36 + Math.max(insets.bottom, 8), right: DS.space.lg + 16 },
        ]}
        onPress={() => navigation.navigate('CreateCommunityPost')}
      >
        <FontAwesome name="plus" size={32} color={colors.background} />
      </Pressable>
    </View>
  );
}

export { CreateCommunityPostScreen } from './community/CreateCommunityPostScreen';


type SecondaryReaction = { kind: 'fire' | 'clap' | 'lightbulb'; count: number };

function resolvePostAvatar(src: string | ImageSourcePropType): ImageSourcePropType {
  return typeof src === 'string' ? { uri: src } : src;
}

function isDefaultDaltonAvatar(src: ImageSourcePropType): boolean {
  return typeof src === 'number' && src === DALTON_LOGO_FINAL_IMG;
}

function PostCard({
  postId: _postId,
  authorId,
  avatar,
  name,
  time,
  body,
  bodyParagraphs,
  imageUri,
  media,
  likes: initialLikes,
  heartFilled: initialLiked,
  secondary: initialSecondary,
  comments: initialCommentCount,
  badge,
  onPressCard,
  eventId,
  eventTitle,
  onPostDeleted,
}: {
  postId: string;
  /** When set and looks like a real profile id, avatar/name open public profile. */
  authorId?: string;
  avatar: string | ImageSourcePropType;
  name: string;
  time: string;
  body?: string;
  bodyParagraphs?: string[];
  imageUri?: string;
  media?: { kind: 'image' | 'video' | 'file'; uri: string; name?: string }[];
  likes: number;
  heartFilled?: boolean;
  secondary?: SecondaryReaction;
  comments: number;
  badge?: string;
  onPressCard?: () => void;
  eventId?: string | null;
  eventTitle?: string;
  onPostDeleted?: (postId: string) => void;
}) {
  const { styles, colors } = useCommunityTheme();
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<CommunityStackParamList>>();
  const liveMode = isSupabaseConfigured() && user && !user.id.startsWith('demo-');
  const [liked, setLiked] = useState(!!initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikes);
  const [secondary, setSecondary] = useState<SecondaryReaction | undefined>(initialSecondary);
  const [topReactions, setTopReactions] = useState<ReactionSummary[]>([]);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [syncing, setSyncing] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<PostCommentRow[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentsBusy, setCommentsBusy] = useState(false);
  const [postMenuVisible, setPostMenuVisible] = useState(false);
  const [postMenuOptions, setPostMenuOptions] = useState<OptionMenuItem[]>([]);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const showActionBanner = useActionBanner();
  const insets = useSafeAreaInsets();

  const canOpenProfile =
    Boolean(authorId && !authorId.startsWith('demo') && authorId.length > 20);

  useEffect(() => {
    if (!liveMode || !user) return;
    let cancelled = false;
    void (async () => {
      const [has, cLikes, cComments, tops] = await Promise.all([
        getUserHasLikedPost(_postId, user.id),
        getPostLikeCount(_postId),
        getPostCommentCount(_postId),
        getTopPostReactions(_postId, 3),
      ]);
      if (cancelled) return;
      setLiked(has);
      setLikeCount(cLikes);
      setCommentCount(cComments);
      setTopReactions(tops);
    })();
    return () => {
      cancelled = true;
    };
  }, [_postId, liveMode, user]);

  const reloadComments = useCallback(async () => {
    if (!liveMode) return;
    const rows = await listPostComments(_postId);
    setComments(rows);
    const n = await getPostCommentCount(_postId);
    setCommentCount(n);
  }, [_postId, liveMode]);

  useEffect(() => {
    if (!commentsOpen || !liveMode) return;
    void reloadComments();
  }, [commentsOpen, liveMode, reloadComments]);

  const bodyText = useMemo(
    () => (bodyParagraphs ? bodyParagraphs.join('\n\n') : body ?? ''),
    [body, bodyParagraphs],
  );

  const bodySection =
    bodyParagraphs ? (
      <View style={styles.postBodyBlock}>
        {bodyParagraphs.map((p, i) => (
          <RichTextMentions key={i} text={p} />
        ))}
      </View>
    ) : (
      <RichTextMentions text={body ?? ''} />
    );

  const mediaSection = (
    <PostFeedMedia
      items={(media ?? []).filter((m) => m.kind === 'image' || m.kind === 'video')}
      fallbackImageUri={imageUri}
    />
  );

  const goEvent = useCallback(() => {
    if (!eventId) return;
    const tabNav = navigation.getParent();
    tabNav?.navigate(
      'Events' as never,
      {
        screen: 'EventDetails',
        params: {
          supabaseEventId: eventId,
          title: eventTitle ?? 'Event',
        },
      } as never,
    );
  }, [navigation, eventId, eventTitle]);

  const openProfile = useCallback(() => {
    if (!canOpenProfile || !authorId) return;
    navigation.navigate('PublicProfile', { userId: authorId });
  }, [navigation, authorId, canOpenProfile]);

  const toggleLike = useCallback(() => {
    if (!liveMode || !user) {
      setLiked((v) => {
        setLikeCount((c) => (v ? c - 1 : c + 1));
        return !v;
      });
      return;
    }
    if (syncing) return;
    setSyncing(true);
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    void (async () => {
      const ok = next ? await likePost(_postId, user.id) : await unlikePost(_postId, user.id);
      if (!ok) {
        setLiked((v) => !v);
        setLikeCount((c) => Math.max(0, c + (next ? -1 : 1)));
      } else {
        const cLikes = await getPostLikeCount(_postId);
        setLikeCount(cLikes);
        if (next) showActionBanner('Liked', `${name}'s post`);
      }
      setSyncing(false);
    })();
  }, [liveMode, user, syncing, liked, _postId, name, showActionBanner]);

  const sharePost = useCallback(async () => {
    try {
      await Share.share({
        title: `${name} · The Dalton Grant Academy`,
        message: `${name}\n\n${bodyText}`.slice(0, 4000),
      });
      await logShareActivity({
        kind: 'post',
        title: `Shared ${name}'s post`,
        detail: bodyText.slice(0, 160),
      });
      showActionBanner('Shared', 'Logged in Share activity');
    } catch {
      /* dismissed */
    }
  }, [bodyText, name, showActionBanner]);

  const pickEmojiReaction = useCallback(() => {
    const apply = (kind: SecondaryReaction['kind']) => {
      const run = async () => {
        if (liveMode && user) {
          const ok = await setPostReaction(_postId, user.id, kind);
          if (ok) {
            const tops = await getTopPostReactions(_postId, 3);
            setTopReactions(tops);
          }
        }
        setSecondary((prev) => {
          if (prev?.kind === kind) {
            return { kind, count: prev.count + 1 };
          }
          const seed = initialSecondary?.kind === kind ? initialSecondary.count : 0;
          return { kind, count: seed + 1 };
        });
        const label = kind === 'fire' ? 'Fire' : kind === 'clap' ? 'Clap' : 'Insight';
        showActionBanner('Reaction sent', label);
      };
      void run();
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', '🔥 Fire', '👏 Clap', '💡 Insight'],
          cancelButtonIndex: 0,
        },
        (i) => {
          if (i === 1) apply('fire');
          if (i === 2) apply('clap');
          if (i === 3) apply('lightbulb');
        },
      );
    } else {
      Alert.alert('React', 'Choose a reaction', [
        { text: '🔥', onPress: () => apply('fire') },
        { text: '👏', onPress: () => apply('clap') },
        { text: '💡', onPress: () => apply('lightbulb') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [initialSecondary, liveMode, user, _postId, showActionBanner]);

  const reportPost = useCallback(() => {
    if (!liveMode || !user?.id || user.id.startsWith('demo-')) {
      Alert.alert('Report', 'Sign in with your account to report posts.');
      return;
    }
    const reporterId = user.id;
    const run = async (reason: PostReportReason) => {
      const ok = await submitPostReport(_postId, reporterId, reason);
      if (ok) showActionBanner('Report sent', 'Thanks for helping keep the community safe.');
      else Alert.alert('Could not send report', 'Check your connection and try again.');
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Spam', 'Harassment', 'Misinformation', 'Copyright', 'Something else'],
          cancelButtonIndex: 0,
        },
        (i) => {
          if (i === 1) void run('spam');
          if (i === 2) void run('harassment');
          if (i === 3) void run('misinformation');
          if (i === 4) void run('copyright');
          if (i === 5) void run('other');
        },
      );
    } else {
      Alert.alert('Report post', 'What best describes the issue?', [
        { text: 'Spam', onPress: () => void run('spam') },
        { text: 'Harassment', onPress: () => void run('harassment') },
        { text: 'Misinformation', onPress: () => void run('misinformation') },
        { text: 'Copyright', onPress: () => void run('copyright') },
        { text: 'Other', onPress: () => void run('other') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [liveMode, user, _postId, showActionBanner]);

  const openPostMenu = useCallback(() => {
    const isAuthor = Boolean(user?.id && authorId && user.id === authorId);
    const canDelete = isAuthor || Boolean(user?.masterControl);
    const sharePost = () => {
      const shareBody = (bodyParagraphs?.join('\n\n') ?? body ?? '').trim();
      void Share.share({
        message: shareBody || 'Post on Dalton Grant Academy',
        title: name ? `Post by ${name}` : 'Community post',
      }).catch(() => undefined);
    };
    const copyId = () => {
      Alert.alert('Post reference', _postId, [{ text: 'OK' }]);
    };
    const deletePost = () => {
      if (!canDelete) return;
      setDeleteConfirmVisible(true);
    };

    const items: OptionMenuItem[] = [
      { key: 'share', label: 'Share', onPress: sharePost },
      ...(canDelete
        ? [{ key: 'delete', label: 'Delete post', destructive: true, onPress: deletePost }]
        : []),
      { key: 'report', label: 'Report post', onPress: reportPost },
      { key: 'copy', label: 'Copy reference', onPress: copyId },
    ];

    if (Platform.OS === 'ios') {
      const labels = ['Cancel', ...items.map((i) => i.label)];
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: labels,
          cancelButtonIndex: 0,
          destructiveButtonIndex: canDelete ? 2 : undefined,
        },
        (i) => {
          if (i <= 0) return;
          items[i - 1]?.onPress();
        },
      );
      return;
    }

    setPostMenuOptions(items);
    setPostMenuVisible(true);
  }, [user, authorId, _postId, body, bodyParagraphs, name, onPostDeleted, showActionBanner, reportPost]);

  const submitComment = useCallback(async () => {
    if (!liveMode || !user) {
      setCommentCount((c) => c + 1);
      showActionBanner('Comment', 'Sign in to post comments.');
      return;
    }
    const t = commentDraft.trim();
    if (!t) return;
    setCommentsBusy(true);
    const ok = await addPostComment(_postId, user.id, t);
    setCommentsBusy(false);
    if (ok) {
      setCommentDraft('');
      await reloadComments();
      showActionBanner('Comment posted', '');
    } else {
      Alert.alert('Could not comment', 'Check your connection and try again.');
    }
  }, [liveMode, user, commentDraft, _postId, reloadComments, showActionBanner]);

  const confirmDeletePost = useCallback(async () => {
    setDeleteBusy(true);
    const ok = await deleteCommunityPost(_postId);
    setDeleteBusy(false);
    setDeleteConfirmVisible(false);
    if (ok) {
      onPostDeleted?.(_postId);
      showActionBanner('Deleted', 'Post removed from the feed.');
    } else {
      Alert.alert(
        'Could not delete',
        'You may not have permission to delete this post. Try again later.',
      );
    }
  }, [_postId, onPostDeleted, showActionBanner]);

  const postMediaItems = (media ?? []).filter(
    (m): m is { kind: 'image' | 'video'; uri: string } => m.kind === 'image' || m.kind === 'video',
  );
  const avatarSource = resolvePostAvatar(avatar);

  return (
    <View style={styles.postCard}>
      <ConfirmModal
        visible={deleteConfirmVisible}
        title="Delete post?"
        message="This cannot be undone. The post will be removed from the community feed permanently."
        confirmLabel="Delete"
        destructive
        busy={deleteBusy}
        onCancel={() => setDeleteConfirmVisible(false)}
        onConfirm={() => void confirmDeletePost()}
      />
      <OptionMenuModal
        visible={postMenuVisible}
        title="Post"
        options={postMenuOptions}
        onClose={() => setPostMenuVisible(false)}
      />
      <PostCommentsSheet
        visible={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        postName={name}
        postBody={bodyParagraphs?.join('\n\n') ?? body ?? ''}
        postMedia={postMediaItems}
        postImageFallback={imageUri}
        comments={comments}
        commentDraft={commentDraft}
        onChangeDraft={setCommentDraft}
        onSubmit={() => void submitComment()}
        commentsBusy={commentsBusy}
        liveMode={!!liveMode}
        colors={colors}
      />
      <View style={styles.postTop}>
        <Pressable
          onPress={openProfile}
          disabled={!canOpenProfile}
          style={({ pressed }) => [pressed && canOpenProfile ? { opacity: 0.85 } : null]}
        >
          <Image
            source={avatarSource}
            style={[styles.postAvatar, isDefaultDaltonAvatar(avatarSource) && styles.postAvatarGoldRing]}
          />
        </Pressable>
        <Pressable
          onPress={openProfile}
          disabled={!canOpenProfile}
          style={[styles.postMetaCol, !canOpenProfile ? { flex: 1 } : { flex: 1 }]}
        >
          <Text style={styles.postName}>{name}</Text>
          <Text style={styles.postTime}>{time}</Text>
        </Pressable>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
        <Pressable style={styles.postMore} hitSlop={8} onPress={openPostMenu}>
          <FontAwesome name="ellipsis-h" size={16} color={colors.textMuted} />
        </Pressable>
      </View>
      {eventId ? (
        <Pressable onPress={goEvent} style={styles.postEventChip}>
          <FontAwesome name="calendar" size={12} color={colors.gold} />
          <Text style={styles.postEventChipTxt} numberOfLines={1}>
            {eventTitle?.trim() ? eventTitle : 'Event'}
          </Text>
          <FontAwesome name="chevron-right" size={10} color={colors.textMuted} />
        </Pressable>
      ) : null}
      {onPressCard ? (
        <Pressable
          onPress={onPressCard}
          style={({ pressed }) => (pressed ? { opacity: 0.92 } : null)}
        >
          {bodySection}
          {mediaSection}
        </Pressable>
      ) : (
        <>
          {bodySection}
          {mediaSection}
        </>
      )}
      {liveMode && topReactions.length > 0 ? (
        <View style={styles.topReactionsRow}>
          {topReactions.map((r) => (
            <Text key={r.emoji} style={styles.topReactionTxt}>
              {r.emoji} {r.count}
            </Text>
          ))}
        </View>
      ) : null}
      <View style={styles.postActions}>
        <View style={styles.postActionsLeft}>
          <Pressable style={styles.actionPill} onPress={toggleLike}>
            <FontAwesome
              name={liked ? 'heart' : 'heart-o'}
              size={14}
              color={liked ? colors.gold : colors.textMuted}
            />
            <Text style={styles.actionTxt}> {likeCount}</Text>
          </Pressable>
          {!liveMode && secondary ? (
            <Pressable style={styles.actionPill} onPress={pickEmojiReaction}>
              {secondary.kind === 'fire' ? (
                <FontAwesome5 name="fire" size={13} color="#f97316" solid />
              ) : null}
              {secondary.kind === 'clap' ? (
                <Text style={styles.clapEmoji}>👏</Text>
              ) : null}
              {secondary.kind === 'lightbulb' ? (
                <FontAwesome5 name="lightbulb" size={13} color="#facc15" solid />
              ) : null}
              <Text style={styles.actionTxt}> {secondary.count}</Text>
            </Pressable>
          ) : !liveMode ? (
            <Pressable style={styles.actionPill} onPress={pickEmojiReaction}>
              <Text style={styles.actionTxt}>＋ 😊</Text>
            </Pressable>
          ) : null}
          {liveMode ? (
            <Pressable style={styles.actionPill} onPress={pickEmojiReaction}>
              <FontAwesome name="smile-o" size={14} color={colors.gold} />
            </Pressable>
          ) : (
            <Pressable style={styles.actionPill} onPress={pickEmojiReaction}>
              <FontAwesome name="smile-o" size={14} color={colors.textMuted} />
            </Pressable>
          )}
          <Pressable
            style={styles.actionPill}
            onPress={() => void sharePost()}
            accessibilityLabel="Share post"
          >
            <FontAwesome name="share-alt" size={14} color={colors.gold} />
          </Pressable>
        </View>
        <Pressable style={styles.actionPill} onPress={() => setCommentsOpen(true)}>
          <Text style={styles.actionTxt}>{commentCount} </Text>
          <FontAwesome name="comment-o" size={14} color={colors.textMuted} />
        </Pressable>
      </View>

    </View>
  );
}

function CommunityDemoPostList({
  navigation,
}: Pick<CProps<'CommunityFeed'>, 'navigation'>) {
  return (
    <>
      <PostCard
        postId="demo-pb-1"
        avatar="https://picsum.photos/seed/dalton-ava1/200/200"
        name="Jordan Blake"
        time="12m ago"
        body="Track day reps with @TaylorM and @CoachDana felt locked in. Focusing on hips through the drive phase 🚀 #DaltonAthletics #Sprinters #MondayMiles"
        imageUri="https://picsum.photos/seed/dalton-run1/800/520"
        likes={34}
        heartFilled={false}
        secondary={{ kind: 'fire', count: 18 }}
        comments={9}
      />
      <PostCard
        postId="demo-pb-2"
        avatar="https://picsum.photos/seed/dalton-ava2/200/200"
        name="Alex Rivera"
        time="42m ago"
        body="@JordanBlake that ladder session blueprint you shared 🔥 Tagged @YouthClub coaches too — shoutout #DaltonGrant #CoachNetwork"
        media={[
          { kind: 'image', uri: 'https://picsum.photos/seed/dalton-carousel-a/900/560' },
          { kind: 'image', uri: 'https://picsum.photos/seed/dalton-carousel-b/900/560' },
        ]}
        likes={52}
        heartFilled
        secondary={{ kind: 'clap', count: 21 }}
        comments={14}
      />
      <PostCard
        postId="demo-pb-3"
        avatar="https://picsum.photos/seed/dalton-ava3/200/200"
        name="Mia Okonkwo"
        time="2h ago"
        badge="AMBASSADOR"
        body="Recovery stack that’s working this block: mobility + flush ride + hydration check. Trying to stay consistent between dual meets ⚡️ #Recovery #HydrationRoutine #AthleteJournal"
        imageUri="https://picsum.photos/seed/dalton-recovery/780/540"
        likes={67}
        heartFilled={false}
        secondary={{ kind: 'lightbulb', count: 12 }}
        comments={6}
      />
      <PostCard
        postId="demo-pb-4"
        avatar="https://picsum.photos/seed/dalton-ava4/200/200"
        name="Sam Whitaker"
        time="4h ago"
        bodyParagraphs={[
          'Meet week mindset — shorten the warmup story, lengthen the checklist. Clipboard items: spikes, bib, salts, earbuds.',
          '@PerformanceLab posted a slick primer on aisle breathing; pairing that with tonight’s shakeout.',
          '#MeetWeek #DaltonAthletics #HurdlesClub',
        ]}
        likes={41}
        heartFilled={false}
        comments={11}
      />
      <PostCard
        postId="demo-pb-5"
        avatar="https://picsum.photos/seed/dalton-ava5/200/200"
        name="Chen & Ellis Training"
        time="Yesterday"
        body="Youth academy highlight reel is going up tonight — tagging @TaylorM @CoachDana plus #YouthDalton #SprintStarts. Slide into DMs if you want the drill PDF."
        imageUri="https://picsum.photos/seed/dalton-coachposter/820/560"
        likes={156}
        heartFilled={false}
        secondary={{ kind: 'fire', count: 44 }}
        comments={28}
      />
      <PostCard
        postId="demo-pb-6"
        avatar="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-8.jpg"
        name="Coach Williams"
        time="Yesterday"
        badge="MENTOR"
        body="Nutrition nudge — pre-comp carb window + electrolytes. Mentioning @JordanBlake and @MiaOkonkwo for keeping the locker room chatter positive. 🥦🏃‍♂️💧 #FuelRight #DaltonFam"
        imageUri="https://picsum.photos/seed/dalton-foodtrack/760/520"
        likes={198}
        heartFilled={false}
        secondary={{ kind: 'lightbulb', count: 62 }}
        comments={36}
        onPressCard={() => navigation.navigate('BrandPartner')}
      />
    </>
  );
}

const DEFAULT_RECENT = ['sprint technique', 'Coach Williams', 'high jump'] as const;
const TRENDING = [
  { topic: 'nutrition tips', count: '142 posts this week' },
  { topic: 'recovery methods', count: '89 posts this week' },
  { topic: 'block start', count: '67 posts this week' },
] as const;

export function CommunitySearchScreen({ navigation }: CProps<'CommunitySearch'>) {
  const { styles, colors } = useCommunityTheme();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [recent, setRecent] = useState<string[]>([...DEFAULT_RECENT]);
  const runSearch = (query: string) =>
    navigation.navigate('CommunitySearchResults', { query: query.trim() || 'sprint technique' });
  return (
    <View style={styles.root}>
      <View
        style={[
          styles.searchHeaderWrap,
          {
            paddingTop: insets.top + DS.space.md,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.borderWhite5,
          },
        ]}
      >
        <View style={styles.searchHeader}>
          <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <FontAwesome name="arrow-left" size={20} color={colors.gold} />
          </Pressable>
          <View style={styles.searchInputWrap}>
            <FontAwesome
              name="search"
              size={14}
              color={colors.textMuted}
              style={styles.searchInputIcon}
            />
            <TextInput
              style={styles.searchInputInner}
              placeholder="Search posts, people, tags"
              placeholderTextColor={colors.textMuted}
              value={q}
              onChangeText={setQ}
              onSubmitEditing={() => runSearch(q)}
              returnKeyType="search"
            />
          </View>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={[styles.commSearchBody, { paddingBottom: 100 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.commSearchSectionTitle}>Recent Searches</Text>
        {recent.map((term) => (
          <View key={term} style={styles.recentRow}>
            <Pressable
              style={styles.recentRowLeft}
              onPress={() => {
                setQ(term);
                runSearch(term);
              }}
            >
              <FontAwesome name="clock-o" size={14} color={colors.textMuted} />
              <Text style={styles.recentRowText}>{term}</Text>
            </Pressable>
            <Pressable onPress={() => setRecent((r) => r.filter((x) => x !== term))} hitSlop={8}>
              <FontAwesome name="times" size={14} color={colors.textMuted} />
            </Pressable>
          </View>
        ))}
        <Text style={styles.commSearchSectionTitle}>Trending</Text>
        {TRENDING.map((t) => (
          <Pressable key={t.topic} style={styles.trendingRow} onPress={() => runSearch(t.topic)}>
            <FontAwesome5 name="fire" size={14} color="#f97316" solid />
            <View style={{ flex: 1 }}>
              <Text style={styles.trendingTopic}>{t.topic}</Text>
              <Text style={styles.trendingMeta}>{t.count}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const SEARCH_SORT = ['Recent', 'Top', 'Most Relevant'] as const;
const SEARCH_FILTER_CHIPS = ['All', 'Posts', 'People', 'Videos'] as const;

const SEARCH_RESULT_POSTS: {
  avatar: string;
  name: string;
  time: string;
  body: string;
  imageUri?: string;
  heartFilled?: boolean;
  likes: number;
  comments: number;
}[] = [
  {
    avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-8.jpg',
    name: 'Coach Williams',
    time: '2h',
    body:
      "Perfecting your sprint technique starts with proper block positioning. Here's what I teach my athletes...",
    likes: 24,
    comments: 8,
  },
  {
    avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-5.jpg',
    name: 'Sarah Chen',
    time: '4h',
    body:
      'Finally nailed my sprint technique after months of practice! The key was focusing on arm drive and foot placement 🏃‍♀️',
    imageUri:
      'https://storage.googleapis.com/uxpilot-auth.appspot.com/c68706f822-23f485ad5a9b054c3c84.png',
    heartFilled: true,
    likes: 156,
    comments: 32,
  },
  {
    avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg',
    name: 'Marcus Johnson',
    time: '1d',
    body: 'Common mistakes in sprint technique that slow you down. Thread 🧵',
    likes: 89,
    comments: 45,
  },
  {
    avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-7.jpg',
    name: 'Emma Rodriguez',
    time: '2d',
    body: "Video analysis of my sprint technique from yesterday's training. Any feedback?",
    imageUri:
      'https://storage.googleapis.com/uxpilot-auth.appspot.com/14700d91c4-a780d1c2476327e59dd9.png',
    likes: 67,
    comments: 19,
  },
];

export function CommunitySearchResultsScreen({
  navigation,
  route,
}: CProps<'CommunitySearchResults'>) {
  const { styles, colors } = useCommunityTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const q = route.params?.query?.trim() || 'sprint technique';
  const displayQ = q.length > 28 ? `${q.slice(0, 28)}…` : q;
  const [sortI, setSortI] = useState(0);
  const [chipI, setChipI] = useState(0);
  const liveConfigured = isSupabaseConfigured();
  const useLiveSearch = liveConfigured && Boolean(user);

  const [livePosts, setLivePosts] = useState<CommunityPostFeedRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [eventTitleMap, setEventTitleMap] = useState<Map<string, string>>(new Map());
  const [removedPostIds, setRemovedPostIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!useLiveSearch) {
      setLivePosts([]);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    void (async () => {
      const rows = await searchCommunityPosts(q);
      if (!cancelled) {
        setLivePosts(rows);
        setSearchLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [useLiveSearch, q]);

  useEffect(() => {
    if (!useLiveSearch || livePosts.length === 0) {
      setEventTitleMap(new Map());
      return;
    }
    const ids = new Set<string>();
    for (const p of livePosts) {
      const { eventId } = parsePostBody(p.body);
      if (eventId) ids.add(eventId);
    }
    if (ids.size === 0) {
      setEventTitleMap(new Map());
      return;
    }
    void (async () => {
      const m = await getEventsByIds([...ids]);
      const next = new Map<string, string>();
      m.forEach((v, k) => next.set(k, v.title));
      setEventTitleMap(next);
    })();
  }, [useLiveSearch, livePosts]);

  const demoPostsFiltered = useMemo(() => {
    if (useLiveSearch) return [];
    const needle = q.toLowerCase();
    if (!needle) return SEARCH_RESULT_POSTS;
    return SEARCH_RESULT_POSTS.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) || p.body.toLowerCase().includes(needle),
    );
  }, [useLiveSearch, q]);

  const visibleLivePosts = useMemo(
    () => livePosts.filter((p) => !removedPostIds.has(p.id)),
    [livePosts, removedPostIds],
  );

  const resultCount = useLiveSearch ? visibleLivePosts.length : demoPostsFiltered.length;

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.searchResultsHeader,
          { paddingTop: insets.top + DS.space.md },
        ]}
      >
        <View style={styles.searchResultsTopRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <FontAwesome name="arrow-left" size={20} color={colors.gold} />
          </Pressable>
          <View style={styles.searchInputWrap}>
            <FontAwesome
              name="search"
              size={14}
              color={colors.textMuted}
              style={styles.searchInputIcon}
            />
            <Text style={styles.searchResultsInputText} numberOfLines={1}>
              {q}
            </Text>
            <Pressable
              onPress={() => navigation.navigate('CommunitySearch')}
              hitSlop={8}
              style={styles.searchClearHit}
            >
              <FontAwesome name="times" size={14} color={colors.textMuted} />
            </Pressable>
          </View>
          <Pressable onPress={() => navigation.navigate('Notifications')}>
            <View>
              <FontAwesome name="bell" size={20} color={colors.textMuted} />
              <View style={styles.searchBellDot} />
            </View>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('MessagesInbox')}>
            <FontAwesome5 name="paper-plane" size={18} color={colors.textMuted} solid={false} />
          </Pressable>
        </View>
        <View style={styles.sortRow}>
          <Text style={styles.sortLabel}>Sort:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sortChipsInner}
          >
            {SEARCH_SORT.map((label, i) => (
              <Pressable
                key={label}
                onPress={() => setSortI(i)}
                style={[styles.sortChip, sortI === i && styles.sortChipOn]}
              >
                <Text style={sortI === i ? styles.sortChipTextOn : styles.sortChipTextOff}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.searchFilterChipsRow}
        >
          {SEARCH_FILTER_CHIPS.map((label, i) => (
            <Pressable
              key={label}
              onPress={() => setChipI(i)}
              style={[styles.searchFilterChip, chipI === i && styles.searchFilterChipOn]}
            >
              <Text
                style={chipI === i ? styles.searchFilterChipTextOn : styles.searchFilterChipTextOff}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.searchResultsList,
          { paddingBottom: 100 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.searchResultCount}>
          {resultCount} result{resultCount === 1 ? '' : 's'} for &quot;{displayQ}&quot;
        </Text>
        {useLiveSearch && searchLoading ? (
          <AppLoadingIndicator style={{ marginVertical: DS.space.lg }} />
        ) : null}
        {useLiveSearch && !searchLoading && visibleLivePosts.length === 0 ? (
          <Text style={styles.feedEmptyText}>No posts match your search.</Text>
        ) : null}
        {useLiveSearch && !searchLoading
          ? visibleLivePosts.map((p) => {
              const { displayBody, eventId } = parsePostBody(p.body);
              return (
                <PostCard
                  key={p.id}
                  postId={p.id}
                  authorId={p.author_id}
                  avatar={resolveProfileAvatarSource(p.author_avatar_url)}
                  name={p.author_display_name?.trim() || 'Member'}
                  time={formatRelativePostTime(p.created_at)}
                  body={displayBody}
                  imageUri={p.attachments?.find((a) => a.kind === 'image')?.uri}
                  media={p.attachments}
                  likes={0}
                  heartFilled={false}
                  comments={0}
                  eventId={eventId}
                  eventTitle={eventId ? eventTitleMap.get(eventId) : undefined}
                  onPostDeleted={(id) => setRemovedPostIds((prev) => new Set(prev).add(id))}
                />
              );
            })
          : demoPostsFiltered.map((post, idx) => (
              <Pressable
                key={`${post.name}-${idx}`}
                style={styles.searchResultCard}
                onPress={() => navigation.navigate('CommunityFeed')}
              >
                <View style={styles.searchResultCardTop}>
                  <Image source={{ uri: post.avatar }} style={styles.searchResultAvatar} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.searchResultNameRow}>
                      <Text style={styles.searchResultName}>{post.name}</Text>
                      <Text style={styles.searchResultDot}> • </Text>
                      <Text style={styles.searchResultTime}>{post.time}</Text>
                    </View>
                    <HighlightBody text={post.body} query={q} />
                  </View>
                </View>
                {post.imageUri ? (
                  <View style={styles.searchResultMedia}>
                    <Image source={{ uri: post.imageUri }} style={styles.searchResultMediaImg} />
                    {idx === 3 ? (
                      <View style={styles.searchResultPlay}>
                        <FontAwesome name="play" size={16} color={colors.white} />
                      </View>
                    ) : null}
                  </View>
                ) : null}
                <View style={styles.searchResultActions}>
                  <Pressable style={styles.searchResultAction}>
                    <FontAwesome
                      name={post.heartFilled ? 'heart' : 'heart-o'}
                      size={14}
                      color={post.heartFilled ? colors.error : colors.textMuted}
                    />
                    <Text style={styles.searchResultActionTxt}> {post.likes}</Text>
                  </Pressable>
                  <Pressable style={styles.searchResultAction}>
                    <FontAwesome name="comment-o" size={14} color={colors.textMuted} />
                    <Text style={styles.searchResultActionTxt}> {post.comments}</Text>
                  </Pressable>
                  <Pressable style={styles.searchResultAction}>
                    <FontAwesome name="share-alt" size={14} color={colors.textMuted} />
                  </Pressable>
                </View>
              </Pressable>
            ))}
      </ScrollView>
    </View>
  );
}

type NotifRow = {
  id: string;
  unread: boolean;
  avatar?: string;
  icon?: 'calendar' | 'trophy';
  body: ReactNode;
  time: string;
};

function buildNotificationDemoRows(
  notifBodyStrongStyle: { fontFamily: string; fontWeight: '600'; color: string },
  notifBodyRestStyle: { fontFamily: string; color: string },
): NotifRow[] {
  return [
  {
    id: '1',
    unread: true,
    avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-5.jpg',
    body: (
      <>
        <Text style={notifBodyStrongStyle}>Sarah Chen</Text>
        <Text style={notifBodyRestStyle}> liked your post about sprint technique</Text>
      </>
    ),
    time: '2 minutes ago',
  },
  {
    id: '2',
    unread: true,
    avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-8.jpg',
    body: (
      <>
        <Text style={notifBodyStrongStyle}>Coach Williams</Text>
        <Text style={notifBodyRestStyle}>
          {' '}
          commented: &quot;Great improvement on your block start!&quot;
        </Text>
      </>
    ),
    time: '15 minutes ago',
  },
  {
    id: '3',
    unread: true,
    avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-7.jpg',
    body: (
      <>
        <Text style={notifBodyStrongStyle}>Emma Rodriguez</Text>
        <Text style={notifBodyRestStyle}> mentioned you in a comment</Text>
      </>
    ),
    time: '1 hour ago',
  },
  {
    id: '4',
    unread: false,
    avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg',
    body: (
      <>
        <Text style={notifBodyStrongStyle}>Marcus Johnson</Text>
        <Text style={notifBodyRestStyle}> started following you</Text>
      </>
    ),
    time: '3 hours ago',
  },
  {
    id: '5',
    unread: false,
    icon: 'calendar',
    body: (
      <>
        <Text style={notifBodyStrongStyle}>Upcoming Event:</Text>
        <Text style={notifBodyRestStyle}> Regional Track Meet starts in 2 days</Text>
      </>
    ),
    time: '5 hours ago',
  },
  {
    id: '6',
    unread: false,
    avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-9.jpg',
    body: (
      <>
        <Text style={notifBodyStrongStyle}>Jake Thompson</Text>
        <Text style={notifBodyRestStyle}>
          {' '}
          and <Text style={notifBodyStrongStyle}>12 others</Text> liked your training video
        </Text>
      </>
    ),
    time: 'Yesterday',
  },
  {
    id: '7',
    unread: false,
    avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-6.jpg',
    body: (
      <>
        <Text style={notifBodyStrongStyle}>Lisa Park</Text>
        <Text style={notifBodyRestStyle}> replied to your comment</Text>
      </>
    ),
    time: '2 days ago',
  },
  {
    id: '8',
    unread: false,
    icon: 'trophy',
    body: (
      <>
        <Text style={notifBodyStrongStyle}>Achievement Unlocked:</Text>
        <Text style={notifBodyRestStyle}> Speed Demon — 10 sprint posts</Text>
      </>
    ),
    time: '3 days ago',
  },
  ];
}

type NotifRowUi = {
  id: string;
  unread: boolean;
  time: string;
  body: ReactNode;
  titlePlain?: string;
  avatar?: string;
  icon?: 'calendar' | 'trophy';
  iconKind?: ReturnType<typeof notificationIconForLink>;
  linkType?: string | null;
  linkId?: string | null;
};

function NotifLeadingIcon({
  kind,
  colors,
  styles,
}: {
  kind: ReturnType<typeof notificationIconForLink>;
  colors: { gold: string };
  styles: ReturnType<typeof useCommunityStyles>;
}) {
  const name =
    kind === 'message'
      ? 'envelope'
      : kind === 'proposal'
        ? 'file-text-o'
        : kind === 'event'
          ? 'calendar'
          : kind === 'post'
            ? 'picture-o'
            : kind === 'follow'
              ? 'user-plus'
              : 'bell-o';
  return (
    <View style={styles.notifIconCircle}>
      <FontAwesome name={name} size={16} color={colors.gold} />
    </View>
  );
}

export function NotificationsScreen({ navigation }: CProps<'Notifications'>) {
  const { styles, colors } = useCommunityTheme();
  const notifBodyStrongStyle = useMemo(
    () => ({
      fontFamily: DS.font.bodyMedium,
      fontWeight: '600' as const,
      color: colors.text,
    }),
    [colors.text],
  );
  const notifBodyRestStyle = useMemo(
    () => ({
      fontFamily: DS.font.body,
      color: colors.text,
    }),
    [colors.text],
  );
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [demoDismissed, setDemoDismissed] = useState(false);
  const [liveNotifs, setLiveNotifs] = useState<InAppNotification[] | null>(null);
  const showBanner = useActionBanner();

  const liveMode = isSupabaseConfigured();
  const isDemoUser = Boolean(user?.id.startsWith('demo-'));
  const useServerNotifs = liveMode && user && !isDemoUser;

  const reloadNotifs = useCallback(() => {
    if (!useServerNotifs || !user?.id) {
      setLiveNotifs(null);
      return;
    }
    void listInAppNotifications(user.id).then(setLiveNotifs);
  }, [useServerNotifs, user?.id]);

  useEffect(() => {
    reloadNotifs();
  }, [reloadNotifs]);

  useFocusEffect(
    useCallback(() => {
      reloadNotifs();
      void markNotificationsSeen();
    }, [reloadNotifs]),
  );

  useEffect(() => {
    if (!useServerNotifs || !user?.id) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const channel = supabase
      .channel(`in-app-notifs-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'in_app_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void listInAppNotifications(user.id).then(setLiveNotifs);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'in_app_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void listInAppNotifications(user.id).then(setLiveNotifs);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [useServerNotifs, user?.id]);

  const demoNotificationRows = useMemo(
    () => buildNotificationDemoRows(notifBodyStrongStyle, notifBodyRestStyle),
    [notifBodyStrongStyle, notifBodyRestStyle],
  );

  const demoVisible: NotifRowUi[] = (demoDismissed ? [] : demoNotificationRows).map((r) => ({
    id: r.id,
    unread: r.unread && !readIds.has(r.id),
    time: r.time,
    body: r.body,
    avatar: r.avatar,
    icon: r.icon,
  }));

  const serverVisible: NotifRowUi[] =
    liveNotifs?.map((n) => ({
      id: n.id,
      unread: !n.read_at,
      time: formatRelativePostTime(n.created_at),
      titlePlain: n.title,
      body: (
        <>
          <Text style={notifBodyStrongStyle}>{n.title}</Text>
          <Text style={notifBodyRestStyle}>{n.body ? ` ${n.body}` : ''}</Text>
        </>
      ),
      iconKind: notificationIconForLink(n.link_type, n.title),
      linkType: n.link_type,
      linkId: n.link_id,
    })) ?? [];

  const showDemoNotifs = !liveMode || isAppStoreScreenshotMode();
  const visible: NotifRowUi[] =
    useServerNotifs && liveNotifs !== null
      ? serverVisible
      : useServerNotifs && liveNotifs === null
        ? []
        : showDemoNotifs
          ? demoVisible
          : [];

  const notificationsLoading = useServerNotifs && liveNotifs === null;
  const showNotificationsEmpty = !notificationsLoading && visible.length === 0;

  const markAllRead = useCallback(() => {
    if (useServerNotifs && user) {
      void markAllInAppNotificationsRead(user.id).then((ok) => {
        if (ok) {
          showBanner('Marked all read');
          void listInAppNotifications(user.id).then(setLiveNotifs);
        } else showBanner('Could not update', 'Check your connection.');
      });
      return;
    }
    setReadIds(new Set(NOTIFICATION_ROWS.map((r) => r.id)));
    showBanner('Marked all read');
  }, [useServerNotifs, user, showBanner]);

  const clearAll = useCallback(() => {
    if (useServerNotifs && user) {
      void clearInAppNotifications(user.id).then((ok) => {
        if (ok) {
          showBanner('Notifications cleared');
          void listInAppNotifications(user.id).then(setLiveNotifs);
        } else showBanner('Could not clear', 'Check delete policy and connection.');
      });
      return;
    }
    setDemoDismissed(true);
    setReadIds(new Set());
    showBanner('Notifications cleared');
  }, [useServerNotifs, user, showBanner]);

  const onPressRow = useCallback(
    (row: NotifRowUi) => {
      if (useServerNotifs && user) {
        void markInAppNotificationRead(user.id, row.id).then((ok) => {
          if (ok) {
            setLiveNotifs((prev) =>
              prev
                ? prev.map((n) => (n.id === row.id ? { ...n, read_at: new Date().toISOString() } : n))
                : prev,
            );
          }
        });
        const tabNav = navigation.getParent();
        if (tabNav) {
          const handled = navigateFromInAppNotification(
            tabNav as never,
            row.linkType,
            row.linkId,
            row.titlePlain,
          );
          if (handled) return;
        }
        if (row.linkType === 'proposal_outcome' && row.linkId) {
          requestProposalOutcomeModal(row.linkId);
        }
        return;
      }
      setReadIds((prev) => new Set(prev).add(row.id));
    },
    [navigation, useServerNotifs, user],
  );

  return (
    <View style={styles.root}>
      <View style={[styles.notifHeader, { paddingTop: insets.top + DS.space.md }]}>
        <View style={styles.notifHeaderTop}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <FontAwesome name="arrow-left" size={20} color={colors.gold} />
          </Pressable>
          <Text style={styles.notifTitle}>NOTIFICATIONS</Text>
          <View style={styles.notifClose} />
        </View>
        <View style={styles.notifHeaderActions}>
          <Pressable onPress={markAllRead} hitSlop={8}>
            <Text style={styles.markAllRead}>Mark all as read</Text>
          </Pressable>
          <Pressable onPress={clearAll} hitSlop={8}>
            <Text style={styles.notifClear}>Clear</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {notificationsLoading ? (
          <AppLoadingIndicator style={{ marginTop: DS.space.lg }} />
        ) : null}
        {showNotificationsEmpty ? (
          <Text style={styles.feedEmptyText}>No new notifications</Text>
        ) : null}
        {visible.map((row) => (
          <Pressable
            key={row.id}
            style={[
              styles.notifItem,
              row.unread ? styles.notifItemUnread : styles.notifItemRead,
            ]}
            onPress={() => onPressRow(row)}
          >
            {row.avatar ? (
              <Image source={{ uri: row.avatar }} style={styles.notifAvatar} />
            ) : row.iconKind ? (
              <NotifLeadingIcon kind={row.iconKind} colors={colors} styles={styles} />
            ) : row.icon === 'calendar' ? (
              <View style={styles.notifIconCircle}>
                <FontAwesome name="calendar" size={16} color={colors.gold} />
              </View>
            ) : (
              <View style={styles.notifIconCircle}>
                <FontAwesome name="trophy" size={16} color={colors.gold} />
              </View>
            )}
            <View style={styles.notifTextCol}>
              <Text style={styles.notifBodyLine}>{row.body}</Text>
              <Text style={styles.notifTime}>{row.time}</Text>
            </View>
            {row.unread ? <View style={styles.notifUnreadDot} /> : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

type InboxRowUi = {
  id: string;
  name: string;
  peerAvatarUrl: string | null;
  time: string;
  preview: string;
  previewMuted?: boolean;
  online?: boolean;
  unread?: number;
  selected?: boolean;
  conversationId?: string;
  peerUserId?: string;
};

export function MessagesInboxScreen({ navigation }: CProps<'MessagesInbox'>) {
  const { styles, colors } = useCommunityTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const screenshotMsgs = isAppStoreScreenshotMode();
  const liveMsgs =
    screenshotMsgs || Boolean(isSupabaseConfigured() && user && !user.id.startsWith('demo-'));
  const [liveThreads, setLiveThreads] = useState<ConversationSummary[]>([]);

  const reloadInboxThreads = useCallback(async () => {
    if (!user) {
      setLiveThreads([]);
      return;
    }
    if (!liveMsgs) {
      setLiveThreads([]);
      return;
    }
    try {
      const rows = await listConversationSummaries(user.id);
      setLiveThreads(rows);
      const { cacheMessageInbox } = await import('../lib/offline/messagesOffline');
      await cacheMessageInbox(user.id, rows);
    } catch {
      const { loadCachedMessageInbox } = await import('../lib/offline/messagesOffline');
      const cached = await loadCachedMessageInbox(user.id);
      if (cached) setLiveThreads(cached);
    }
  }, [liveMsgs, user]);

  useFocusEffect(
    useCallback(() => {
      void reloadInboxThreads();
      void markMessagesSeen();
    }, [reloadInboxThreads]),
  );

  useEffect(() => {
    if (!liveMsgs || !user?.id) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const channel = supabase
      .channel(`inbox-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => {
          void reloadInboxThreads();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [liveMsgs, reloadInboxThreads, user?.id]);

  const { refreshing, onRefresh } = useRefreshWithMinimum(reloadInboxThreads, 4000);

  const [filter, setFilter] = useState('');
  const openThreadToPeer = useCallback(
    async (peerUserId: string, name: string, avatarUrl?: string | null) => {
      if (!user?.id) return;
      const gate = await resolveCanMessagePeer(user.id, peerUserId);
      if (!gate.ok) {
        Alert.alert('Cannot message', gate.message);
        return;
      }
      navigation.navigate('MessageThread', {
        name,
        peerUserId,
        avatarUrl: avatarUrl?.trim() || undefined,
      });
    },
    [navigation, user?.id],
  );

  const newMessageDemo = useCallback(() => {
    if (!user?.id || user.id.startsWith('demo-')) {
      Alert.alert('New message', 'Sign in with your account to start real conversations.');
      return;
    }
    if (!liveMsgs) {
      Alert.alert('New message', 'Connect Supabase to use live messaging.');
      return;
    }
    if (isAppStoreScreenshotMode()) {
      Alert.alert('New message', 'Screenshot shortcuts', [
        {
          text: 'Marcus (policy demo)',
          onPress: () => {
            const gate = assertCanMessageRecipient({
              recipientPref: 'followers_only',
              isFollowingRecipient: false,
            });
            if (!gate.ok) {
              Alert.alert('Cannot send', 'Recipient requires a follow relationship.');
              return;
            }
            navigation.navigate('MessageThread', { name: 'Marcus Johnson' });
          },
        },
        {
          text: 'Coach (screenshot)',
          onPress: () => navigation.navigate('MessageThread', { name: 'Coach Williams' }),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    void (async () => {
      const following = await listFollowingProfiles(user.id);
      if (!following.length) {
        Alert.alert(
          'New message',
          'Follow someone first, then open their profile and tap Message — or message from a proposal thread.',
        );
        return;
      }
      const picks = following.slice(0, 10);
      Alert.alert(
        'New message',
        'Choose someone you follow:',
        [
          ...picks.map((p) => ({
            text:
              p.display_name?.trim() ||
              (p.username?.trim() ? `@${p.username.trim()}` : 'Member'),
            onPress: () =>
              void openThreadToPeer(
                p.id,
                p.display_name?.trim() ||
                  (p.username?.trim() ? `@${p.username.trim()}` : 'Member'),
                p.avatar_url,
              ),
          })),
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    })();
  }, [liveMsgs, navigation, openThreadToPeer, user?.id]);
  const threads = useMemo(() => {
    const liveRows: InboxRowUi[] = liveThreads.map((t) => {
      const extras = SCREENSHOT_INBOX_EXTRAS[t.conversation_id] ?? {};
      return {
        id: `live-${t.conversation_id}`,
        name: t.peer_display_name?.trim() || 'Member',
        peerAvatarUrl: t.peer_avatar_url ?? null,
        time: t.last_at ? formatRelativePostTime(t.last_at) : '',
        preview: t.last_body ?? 'No messages yet',
        previewMuted: !t.last_body,
        conversationId: t.conversation_id,
        peerUserId: t.peer_user_id,
        ...extras,
      };
    });
    const merged = liveMsgs ? liveRows : [];
    const f = filter.trim().toLowerCase();
    if (!f) return merged;
    return merged.filter(
      (t) => t.name.toLowerCase().includes(f) || t.preview.toLowerCase().includes(f),
    );
  }, [filter, liveThreads]);
  return (
    <View style={styles.root}>
      <PullRefreshRiveOverlay visible={refreshing && liveMsgs} topInset={insets.top} />
      <View style={[styles.inboxHeader, { paddingTop: insets.top + DS.space.md }]}>
        <View style={styles.inboxHeaderRow}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <FontAwesome name="arrow-left" size={20} color={colors.gold} />
          </Pressable>
          <Text style={styles.inboxTitle}>MESSAGES</Text>
          <Pressable hitSlop={8} onPress={newMessageDemo}>
            <FontAwesome5 name="pen-square" size={18} color={colors.gold} solid />
          </Pressable>
        </View>
        <View style={styles.inboxSearchWrap}>
          <FontAwesome
            name="search"
            size={14}
            color={colors.textMuted}
            style={styles.inboxSearchIcon}
          />
          <TextInput
            style={styles.inboxSearchInput}
            placeholder="Search conversations..."
            placeholderTextColor={colors.textMuted}
            value={filter}
            onChangeText={setFilter}
          />
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={liveMsgs ? pullRefreshControl(refreshing, onRefresh) : undefined}
      >
        {liveMsgs && threads.length === 0 ? (
          <Text style={styles.inboxEmpty}>
            No conversations yet. Tap the compose icon or open a profile and tap Message.
          </Text>
        ) : null}
        {threads.map((t) => (
          <Pressable
            key={t.id}
            style={[
              styles.inboxRow,
              t.selected ? styles.inboxRowSelected : styles.inboxRowIdle,
            ]}
            onPress={() =>
              navigation.navigate('MessageThread', {
                name: t.name,
                conversationId: t.conversationId,
                peerUserId: t.peerUserId,
                avatarUrl: t.avatar,
              })
            }
          >
            <View style={styles.inboxAvatarWrap}>
              <Image
                source={resolveProfileAvatarSource(t.peerAvatarUrl)}
                style={[
                  styles.inboxAvatar,
                  isDaltonDefaultAvatarSource(resolveProfileAvatarSource(t.peerAvatarUrl)) &&
                    styles.inboxAvatarGoldRing,
                ]}
              />
              {t.online ? <View style={styles.inboxOnlineDot} /> : null}
            </View>
            <View style={styles.inboxMid}>
              <View style={styles.inboxNameRow}>
                <Text style={styles.inboxName} numberOfLines={1}>
                  {t.name}
                </Text>
                <Text style={styles.inboxTime}>{t.time}</Text>
              </View>
              <Text
                style={t.previewMuted ? styles.inboxPreviewMuted : styles.inboxPreview}
                numberOfLines={1}
              >
                {t.preview}
              </Text>
            </View>
            {t.unread ? (
              <View style={styles.inboxUnreadBadge}>
                <Text style={styles.inboxUnreadBadgeTxt}>{t.unread}</Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const COACH_THREAD: { from: 'them' | 'me'; text: string; time: string; read?: 'double' | 'single' }[] = [
  {
    from: 'them',
    text: 'Hey! How did your morning run go? I saw you posted about trying the new route.',
    time: '9:15 AM',
  },
  {
    from: 'me',
    text: 'It was amazing! The hill sections were challenging but I felt strong. Thanks for suggesting it 🏃‍♂️',
    time: '9:18 AM',
    read: 'double',
  },
  {
    from: 'them',
    text: "That's what I like to hear! Your endurance has really improved over the past month.",
    time: '9:20 AM',
  },
  {
    from: 'them',
    text: 'Great progress on your technique today! Keep it up 💪',
    time: '2:45 PM',
  },
  {
    from: 'me',
    text: 'Thank you coach! I really felt the difference in my form today. The breathing exercises are helping a lot.',
    time: '2:47 PM',
    read: 'double',
  },
  {
    from: 'them',
    text: "Excellent! For tomorrow's session, let's focus on interval training. Are you ready for a challenge?",
    time: '2:50 PM',
  },
  {
    from: 'me',
    text: "Absolutely! I'm excited to push my limits. What time should I be there?",
    time: '2:52 PM',
    read: 'single',
  },
  {
    from: 'them',
    text: "6 AM sharp! And don't forget to bring your water bottle and towel.",
    time: 'Now',
  },
];

export function MessageThreadScreen({ navigation, route }: CProps<'MessageThread'>) {
  const { styles, colors } = useCommunityTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const showBanner = useActionBanner();
  const conversationIdParam = route.params?.conversationId;
  const peerUserId = route.params?.peerUserId;
  const markDiscussedProposalId = route.params?.markDiscussedProposalId;
  const initialDraft = route.params?.initialDraft;
  const title =
    route.params?.name ??
    (isAppStoreScreenshotMode() ? 'Coach Williams' : 'Conversation');
  const paramAvatar = route.params?.avatarUrl;
  const isCoachDemo =
    isAppStoreScreenshotMode() &&
    title === 'Coach Williams' &&
    !conversationIdParam &&
    !peerUserId;

  const [peerAvatarUrl, setPeerAvatarUrl] = useState<string | null>(paramAvatar?.trim() || null);
  const [liveMessages, setLiveMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState(initialDraft?.trim() ?? '');
  const [loading, setLoading] = useState(Boolean(conversationIdParam || peerUserId));

  useEffect(() => {
    if (initialDraft?.trim()) setDraft(initialDraft.trim());
  }, [initialDraft]);
  const [attachBusy, setAttachBusy] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [threadMenuVisible, setThreadMenuVisible] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(
    conversationIdParam,
  );

  const avatarSource = resolveProfileAvatarSource(peerAvatarUrl);

  useEffect(() => {
    if (!peerUserId) return;
    void (async () => {
      const row = await fetchProfileByUserId(peerUserId);
      if (row?.avatar_url?.trim()) setPeerAvatarUrl(row.avatar_url.trim());
    })();
  }, [peerUserId]);

  useEffect(() => {
    setActiveConversationId(conversationIdParam);
  }, [conversationIdParam]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        if (!user?.id || user.id.startsWith('demo-')) {
          setLiveMessages([]);
          setLoading(false);
          return;
        }
        if (conversationIdParam) {
          setLoading(true);
          try {
            const msgs = await listMessages(conversationIdParam, 100);
            setLiveMessages(msgs);
            const { cacheMessageThread } = await import('../lib/offline/messagesOffline');
            await cacheMessageThread(conversationIdParam, msgs);
          } catch {
            const { loadCachedMessageThread } = await import('../lib/offline/messagesOffline');
            const cached = await loadCachedMessageThread(conversationIdParam);
            if (cached) setLiveMessages(cached);
          }
          setLoading(false);
          return;
        }
        if (peerUserId) {
          setLoading(true);
          const gate = await resolveCanMessagePeer(user.id, peerUserId);
          if (!gate.ok) {
            setLoading(false);
            Alert.alert('Cannot message', gate.message, [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
            return;
          }
          const cid = await getOrCreateConversationId(peerUserId);
          if (!cid) {
            setLoading(false);
            Alert.alert(
              'Cannot message',
              'This user does not accept messages from you.',
              [{ text: 'OK', onPress: () => navigation.goBack() }],
            );
            return;
          }
          setActiveConversationId(cid);
          try {
            const msgs = await listMessages(cid, 100, user.id);
            setLiveMessages(msgs);
            const { cacheMessageThread } = await import('../lib/offline/messagesOffline');
            await cacheMessageThread(cid, msgs);
          } catch {
            const { loadCachedMessageThread } = await import('../lib/offline/messagesOffline');
            const cached = await loadCachedMessageThread(cid);
            if (cached) setLiveMessages(cached);
          }
          setLoading(false);
        } else {
          setLiveMessages([]);
          setLoading(false);
        }
      })();
    }, [conversationIdParam, peerUserId, user]),
  );

  const cidFinal = activeConversationId ?? conversationIdParam;
  const isSampleThread = Boolean(
    cidFinal && isAppStoreScreenshotMode() && isScreenshotSampleConversationId(cidFinal),
  );
  const isLive = Boolean(
    cidFinal && user && !user.id.startsWith('demo-') && !isSampleThread,
  );
  const isScreenshotThread = Boolean(cidFinal && user && isSampleThread);

  useEffect(() => {
    if (!isLive || !cidFinal || !user) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const channel = supabase
      .channel(`messages-${cidFinal}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${cidFinal}`,
        },
        (payload) => {
          const row = payload.new as MessageRow;
          if (!row?.id || row.sender_id === user.id) return;
          setLiveMessages((prev) => {
            if (prev.some((x) => x.id === row.id)) return prev;
            return [...prev, row];
          });
          const snippet = (row.body ?? '').trim().slice(0, 72);
          showBanner('New message', snippet || 'Open thread to read');
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isLive, cidFinal, user, showBanner]);

  const send = useCallback(async () => {
    if (!cidFinal || !user || draft.trim().length === 0) return;
    const result = await sendTextMessage(cidFinal, user.id, draft);
    if (result.ok) {
      setDraft('');
      setLiveMessages((prev) => [...prev, result.message]);
      if (markDiscussedProposalId) {
        const { masterMarkProposalDiscussed } = await import('../roadmap/proposalService');
        await masterMarkProposalDiscussed(markDiscussedProposalId);
      }
      showBanner('Sent', 'Message delivered.');
    } else {
      Alert.alert('Send failed', result.error);
    }
  }, [cidFinal, user, draft, showBanner, markDiscussedProposalId]);

  const threadMenuOptions: OptionMenuItem[] = useMemo(() => {
    if (!isLive || !cidFinal) return [];
    const opts: OptionMenuItem[] = [
      {
        key: 'search',
        label: 'Search chat',
        onPress: () => setShowChatSearch(true),
      },
      {
        key: 'clear',
        label: 'Clear chat',
        destructive: true,
        onPress: () => {
          Alert.alert(
            'Clear chat?',
            'All messages in this conversation will be removed for everyone in the thread.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Clear',
                style: 'destructive',
                onPress: () => {
                  void (async () => {
                    const ok = await clearConversationMessages(cidFinal);
                    if (ok) {
                      setLiveMessages([]);
                      showBanner('Chat cleared', '');
                    } else {
                      Alert.alert('Could not clear', 'Try again when you are back online.');
                    }
                  })();
                },
              },
            ],
          );
        },
      },
    ];
    if (peerUserId && user?.id) {
      opts.push({
        key: 'block',
        label: 'Block user',
        destructive: true,
        onPress: () => {
          Alert.alert(
            'Block user?',
            'They will not be able to message you and this thread will be hidden from new messages.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Block',
                style: 'destructive',
                onPress: () => {
                  void (async () => {
                    const ok = await blockUser(user.id, peerUserId);
                    if (ok) {
                      showBanner('User blocked', '');
                      navigation.goBack();
                    }
                  })();
                },
              },
            ],
          );
        },
      });
    }
    return opts;
  }, [isLive, cidFinal, peerUserId, user?.id, navigation, showBanner]);

  const openThreadMenu = useCallback(() => {
    if (!cidFinal) {
      Alert.alert('Conversation', 'Open a live conversation to use these options.');
      return;
    }
    if (!isLive) {
      Alert.alert('Conversation', 'Sign in with your account to manage this thread.');
      return;
    }
    if (threadMenuOptions.length === 0) return;

    if (Platform.OS === 'web') {
      setThreadMenuVisible(true);
      return;
    }

    if (Platform.OS === 'ios') {
      const labels = [...threadMenuOptions.map((o) => o.label), 'Cancel'];
      const destructiveIndex = threadMenuOptions.findIndex((o) => o.destructive);
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: labels,
          cancelButtonIndex: labels.length - 1,
          destructiveButtonIndex: destructiveIndex >= 0 ? destructiveIndex : undefined,
        },
        (index) => {
          if (index == null || index === labels.length - 1) return;
          threadMenuOptions[index]?.onPress();
        },
      );
      return;
    }

    Alert.alert(
      'Conversation',
      'Choose an action',
      [
        ...threadMenuOptions.map((o) => ({
          text: o.label,
          style: o.destructive ? ('destructive' as const) : undefined,
          onPress: o.onPress,
        })),
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }, [cidFinal, isLive, threadMenuOptions]);

  const pickAttachment = useCallback(async () => {
    if (!isLive || !cidFinal || !user?.id || attachBusy) return;
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: false,
      quality: 0.92,
      videoMaxDuration: Math.floor(MAX_COMPOSER_VIDEO_MS / 1000),
    });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    let media: ComposerMedia | null = null;
    if (pickerAssetIsVideo(a)) {
      const durMs = pickerVideoDurationMs(a) ?? MAX_COMPOSER_VIDEO_MS;
      if (durMs > MAX_COMPOSER_VIDEO_MS) {
        Alert.alert('Video too long', 'Videos must be 30 seconds or shorter.');
        return;
      }
      media = { kind: 'video', uri: a.uri, durationMs: durMs, mimeType: a.mimeType ?? undefined };
    } else if (a.uri) {
      media = { kind: 'image', uri: a.uri, mimeType: a.mimeType ?? undefined };
    }
    if (!media) return;
    setAttachBusy(true);
    const sent = await sendMediaMessage(cidFinal, user.id, clampComposerMedia([media])[0]!);
    setAttachBusy(false);
    if (sent) {
      setLiveMessages((prev) => [...prev, sent]);
      showBanner('Sent', media.kind === 'video' ? 'Video sent.' : 'Photo sent.');
    } else {
      Alert.alert('Send failed', 'Could not attach this file.');
    }
  }, [isLive, cidFinal, user?.id, attachBusy, showBanner]);

  const bubbles =
    isLive || isScreenshotThread
      ? liveMessages.map((m) => ({
          from: (m.sender_id === user!.id ? 'me' : 'them') as 'me' | 'them',
          text: m.body ?? '',
          time: formatRelativePostTime(m.created_at),
          read: (m.sender_id === user!.id ? 'double' : undefined) as 'double' | 'single' | undefined,
          mediaUrl: m.media_public_url?.trim() || null,
          mediaKind: m.media_kind ?? null,
        }))
      : isCoachDemo
        ? COACH_THREAD.map((m) => ({ ...m, mediaUrl: null as string | null, mediaKind: null }))
        : [];

  const needle = chatSearch.trim().toLowerCase();
  const visibleBubbles = needle
    ? bubbles.filter((m) => m.text.toLowerCase().includes(needle))
    : bubbles;

  return (
    <View style={styles.root}>
      <OptionMenuModal
        visible={threadMenuVisible}
        title="Conversation"
        options={threadMenuOptions}
        onClose={() => setThreadMenuVisible(false)}
      />
      <View style={[styles.threadHeader, { paddingTop: insets.top + DS.space.md }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <FontAwesome name="arrow-left" size={20} color={colors.gold} />
        </Pressable>
        <Pressable
          disabled={!peerUserId}
          onPress={() => {
            if (!peerUserId) return;
            navigation.navigate('PublicProfile', { userId: peerUserId });
          }}
        >
          <Image
            source={avatarSource}
            style={[
              styles.threadHeaderAvatar,
              isDaltonDefaultAvatarSource(avatarSource) && styles.threadHeaderAvatarGoldRing,
            ]}
          />
        </Pressable>
        <View style={styles.threadHeaderMid}>
          <Text style={styles.threadHeaderName} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.threadHeaderStatus}>
            {isLive || isScreenshotThread ? 'Messages' : 'Online'}
          </Text>
        </View>
        <Pressable hitSlop={10} style={styles.threadHeaderMenuBtn} onPress={openThreadMenu}>
          <FontAwesome name="ellipsis-v" size={18} color={colors.gold} />
        </Pressable>
      </View>
      {showChatSearch ? (
        <View style={styles.threadSearchBar}>
          <TextInput
            style={styles.threadSearchInput}
            placeholder="Search in conversation…"
            placeholderTextColor={colors.textMuted}
            value={chatSearch}
            onChangeText={setChatSearch}
            autoFocus
          />
          <Pressable hitSlop={8} onPress={() => { setShowChatSearch(false); setChatSearch(''); }}>
            <FontAwesome name="times" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={[styles.threadBody, { paddingBottom: DS.space.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {loading && (isLive || isScreenshotThread) ? (
          <AppLoadingIndicator style={{ marginVertical: 16 }} />
        ) : null}
        {!loading && bubbles.length === 0 ? (
          <Text style={styles.threadEmpty}>
            {isLive || isScreenshotThread
              ? 'No messages yet. Say hello.'
              : 'Open Messages or a profile and tap Message to start a conversation.'}
          </Text>
        ) : null}
        <View style={styles.threadDayPillWrap}>
          <Text style={styles.threadDayPill}>Today</Text>
        </View>
        {visibleBubbles.map((m, i) =>
          m.from === 'them' ? (
            <View key={`${i}-t`} style={styles.threadMsgThem}>
              <View style={styles.bubbleThem}>
                {m.mediaUrl && m.mediaKind === 'image' ? (
                  <Image source={{ uri: m.mediaUrl }} style={styles.bubbleMedia} resizeMode="cover" />
                ) : null}
                {m.mediaUrl && m.mediaKind === 'video' ? (
                  <Video
                    source={{ uri: m.mediaUrl }}
                    style={styles.bubbleMedia}
                    resizeMode={ResizeMode.COVER}
                    useNativeControls
                  />
                ) : null}
                {m.text ? <Text style={styles.bubbleText}>{m.text}</Text> : null}
              </View>
              <Text style={styles.bubbleMetaThem}>{m.time}</Text>
            </View>
          ) : (
            <View key={`${i}-m`} style={styles.threadMsgMe}>
              <View style={styles.bubbleMe}>
                {m.mediaUrl && m.mediaKind === 'image' ? (
                  <Image source={{ uri: m.mediaUrl }} style={styles.bubbleMedia} resizeMode="cover" />
                ) : null}
                {m.mediaUrl && m.mediaKind === 'video' ? (
                  <Video
                    source={{ uri: m.mediaUrl }}
                    style={styles.bubbleMedia}
                    resizeMode={ResizeMode.COVER}
                    useNativeControls
                  />
                ) : null}
                {m.text ? <Text style={styles.bubbleTextDark}>{m.text}</Text> : null}
              </View>
              <View style={styles.bubbleMetaMeRow}>
                <Text style={styles.bubbleMetaMe}>{m.time}</Text>
                {m.read === 'double' ? (
                  <FontAwesome5 name="check-double" size={11} color={colors.gold} solid />
                ) : m.read === 'single' ? (
                  <FontAwesome name="check" size={11} color={colors.textMuted} />
                ) : null}
              </View>
            </View>
          ),
        )}
      </ScrollView>
      <View style={[styles.composeBar, { paddingBottom: Math.max(insets.bottom, DS.space.md) }]}>
        <Pressable
          hitSlop={8}
          style={[styles.composePlus, attachBusy ? { opacity: 0.5 } : null]}
          onPress={() => void pickAttachment()}
          disabled={!isLive || attachBusy}
        >
          {attachBusy ? (
            <AppLoadingIndicator size={20} />
          ) : (
            <FontAwesome name="plus" size={20} color={colors.gold} />
          )}
        </Pressable>
        <TextInput
          style={styles.composeInputRounded}
          placeholder="Type a message..."
          placeholderTextColor={colors.textMuted}
          multiline
          value={draft}
          onChangeText={setDraft}
          editable={isLive}
        />
        <Pressable
          style={[styles.sendBtnRound, !isLive || !draft.trim() ? { opacity: 0.45 } : null]}
          onPress={() => void send()}
          disabled={!isLive || !draft.trim()}
        >
          <FontAwesome5 name="paper-plane" size={16} color={colors.background} solid />
        </Pressable>
      </View>
    </View>
  );
}

const BRAND_VIDEO_THUMB =
  'https://storage.googleapis.com/uxpilot-auth.appspot.com/91bf71e10a-f9bb386c642433b2804a.png';
const BRAND_PRODUCTS: { uri: string; title: string; price: string }[] = [
  {
    uri: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/13a32f8919-e32e3b4c0c51f38c043e.png',
    title: 'Pro Percussion V2',
    price: '$299.00',
  },
  {
    uri: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/a6dc2597c3-e8765beb7b2c7040a874.png',
    title: 'Recovery Boots',
    price: '$899.00',
  },
  {
    uri: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/32a6819a9b-b47ac4c88b9be5998210.png',
    title: 'Density Roller',
    price: '$45.00',
  },
];

function normalizePartnerLinks(raw: unknown): { label: string; url: string }[] {
  const source: unknown =
    raw && typeof raw === 'object' && !Array.isArray(raw) && 'external_links' in raw
      ? (raw as { external_links?: unknown }).external_links
      : raw;
  if (!Array.isArray(source)) return [];
  const out: { label: string; url: string }[] = [];
  for (const item of source) {
    if (typeof item === 'string' && /^https?:\/\//i.test(item)) {
      out.push({ label: 'Link', url: item });
      continue;
    }
    if (item && typeof item === 'object' && 'url' in item) {
      const url = String((item as { url: unknown }).url);
      const lab =
        'label' in item ? String((item as { label: unknown }).label).slice(0, 80) : 'Link';
      if (/^https?:\/\//i.test(url)) out.push({ label: lab || 'Link', url });
    }
  }
  return out;
}

function BrandPartnerAthleticXLegacy({
  navigation,
}: Pick<BrandPartnerScreenProps, 'navigation'>) {
  const { styles, colors } = useCommunityTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <View style={[styles.brandTopNav, { paddingTop: insets.top + DS.space.sm }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.brandNavBtn}>
          <FontAwesome name="chevron-left" size={18} color={colors.textMuted} />
        </Pressable>
        <Text style={styles.brandNavTitle}>Partner</Text>
        <View style={styles.brandNavBtn} />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.brandScroll,
          { paddingBottom: 120 + insets.bottom },
        ]}
      >
        <View style={styles.brandHero}>
          <View style={styles.brandLogoCard}>
            <BrandLogo width={240} height={72} />
          </View>
          <Text style={styles.brandHeroTitle}>ATHLETIC X</Text>
          <View style={styles.brandActiveRow}>
            <View style={styles.brandActiveDot} />
            <Text style={styles.brandActiveLabel}>Active Partner</Text>
          </View>
        </View>
        <View style={styles.brandQuoteSection}>
          <FontAwesome name="quote-left" size={20} color={colors.gold} style={{ opacity: 0.5 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.brandQuoteKicker}>DALTON SAYS</Text>
            <Text style={styles.brandQuoteBody}>
              &quot;These guys provide the best recovery gear I&apos;ve ever used. It&apos;s
              fundamentally changed how I approach my post-training routine.&quot;
            </Text>
          </View>
        </View>
        <View style={styles.brandPromoBlock}>
          <View style={styles.brandPromoHeadingRow}>
            <FontAwesome name="star" size={10} color={colors.gold} />
            <Text style={styles.brandPromoHeading}> Member Exclusive</Text>
          </View>
          <View style={styles.brandCodeRow}>
            <View style={styles.brandCodeBox}>
              <Text style={styles.brandCodeText}>PRO-LEVEL-20</Text>
              <Pressable
                style={styles.brandCopyBtn}
                onPress={() => Alert.alert('Copied', 'PRO-LEVEL-20')}
              >
                <FontAwesome name="copy" size={14} color={colors.gold} />
              </Pressable>
            </View>
          </View>
          <Text style={styles.brandCodeHint}>
            Tap to copy your exclusive 20% off discount code
          </Text>
        </View>
        <View style={styles.brandAbout}>
          <Text style={styles.brandAboutTitle}>About Athletic X</Text>
          <Text style={styles.brandAboutBody}>
            Athletic X engineers premium recovery tools designed for elite performers. By combining
            cutting-edge material science with biomechanical insights, they deliver solutions that
            accelerate recovery and optimize peak physical performance.
          </Text>
          <View style={styles.brandTagRow}>
            {['Recovery', 'Gear', 'Performance'].map((tag) => (
              <View key={tag} style={styles.brandTag}>
                <Text style={styles.brandTagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
        <Pressable style={styles.brandFeaturedVideo}>
          <Image source={{ uri: BRAND_VIDEO_THUMB }} style={styles.brandVideoImg} />
          <View style={styles.brandVideoScrim} />
          <View style={styles.brandPlayCircle}>
            <FontAwesome name="play" size={18} color={colors.gold} style={{ marginLeft: 4 }} />
          </View>
          <View style={styles.brandDurationBadge}>
            <Text style={styles.brandDurationText}>02:45</Text>
          </View>
        </Pressable>
        <View style={styles.brandProductsHeader}>
          <Text style={styles.brandProductsTitle}>Featured Gear</Text>
          <Text style={styles.brandViewAll}>View All</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.brandProductsScroll}
        >
          {BRAND_PRODUCTS.map((p) => (
            <View key={p.title} style={styles.brandProductCard}>
              <View style={styles.brandProductThumb}>
                <Image source={{ uri: p.uri }} style={styles.brandProductImg} resizeMode="contain" />
              </View>
              <Text style={styles.brandProductTitle} numberOfLines={1}>
                {p.title}
              </Text>
              <Text style={styles.brandProductPrice}>{p.price}</Text>
            </View>
          ))}
        </ScrollView>
      </ScrollView>
      <View style={[styles.brandFooter, { paddingBottom: Math.max(insets.bottom, DS.space.md) }]}>
        <Pressable style={styles.brandVisitCta}>
          <Text style={styles.brandVisitText}>VISIT WEBSITE</Text>
          <FontAwesome5 name="external-link-alt" size={13} color={colors.gold} solid />
        </Pressable>
      </View>
    </View>
  );
}

export function BrandPartnerScreen({ navigation, route }: BrandPartnerScreenProps) {
  const { styles, colors } = useCommunityTheme();
  const { user } = useAuth();
  const pageId = route.params?.pageId?.trim();
  const [menuOpen, setMenuOpen] = useState(false);
  const [offer, setOffer] = useState<
    SubscriptionOfferPageRow | 'loading' | 'idle' | 'missing'
  >(pageId ? 'loading' : 'idle');

  useFocusEffect(
    useCallback(() => {
      if (!pageId) {
        setOffer('idle');
        return;
      }
      let alive = true;
      setOffer('loading');
      void (async () => {
        const row = await getSubscriptionOfferPageById(pageId);
        if (!alive) return;
        setOffer(row ?? 'missing');
      })();
      return () => {
        alive = false;
      };
    }, [pageId]),
  );

  if (!pageId || offer === 'idle') {
    return <BrandPartnerAthleticXLegacy navigation={navigation} />;
  }

  if (offer === 'loading') {
    const insets = useSafeAreaInsets();
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center', paddingTop: insets.top }]}>
        <AppLoadingIndicator />
      </View>
    );
  }

  if (offer === 'missing') {
    const insets = useSafeAreaInsets();
    return (
      <View style={[styles.root, { paddingTop: insets.top + DS.space.md, paddingHorizontal: DS.space.lg }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.brandNavBtn}>
          <FontAwesome name="chevron-left" size={18} color={colors.textMuted} />
        </Pressable>
        <Text style={[styles.brandAboutTitle, { marginTop: DS.space.lg }]}>Partner not found</Text>
        <Text style={[styles.brandAboutBody, { marginTop: DS.space.sm }]}>
          This page may have been removed.
        </Text>
      </View>
    );
  }

  const page = offer;
  const insets = useSafeAreaInsets();
  const links = normalizePartnerLinks(page.social_links);
  const featured = parseSponsorDescriptionForFeatured(page.description ?? null);
  const socialObj =
    page.social_links && typeof page.social_links === 'object' && !Array.isArray(page.social_links)
      ? (page.social_links as {
          promo_codes?: unknown;
          gallery_urls?: unknown;
        })
      : null;
  const promoCodes =
    socialObj && Array.isArray(socialObj.promo_codes)
      ? (socialObj.promo_codes as { code?: unknown; details?: unknown }[])
          .map((p) => ({ code: String(p.code ?? '').trim(), details: String(p.details ?? '').trim() }))
          .filter((p) => p.code && p.details)
      : [];
  const galleryUrls =
    socialObj && Array.isArray(socialObj.gallery_urls)
      ? (socialObj.gallery_urls as unknown[])
          .map((u) => String(u ?? '').trim())
          .filter((u) => /^https?:\/\//i.test(u))
      : [];
  const heroUri = page.hero_image_url?.trim();
  const videoUri = page.video_url?.trim();
  const siteUri = page.website_url?.trim();

  const goEditSponsor = useCallback(() => {
    if (!pageId) return;
    try {
      // Works when BrandPartner is in Sponsors stack
      (navigation as any).navigate('EditSponsor', { pageId });
      return;
    } catch {
      // ignore
    }
    // Works when BrandPartner is opened from Community stack
    try {
      navigation.getParent()?.navigate('Sponsors' as never, { screen: 'EditSponsor', params: { pageId } } as never);
    } catch {
      Alert.alert('Sponsor', 'Could not open the editor.');
    }
  }, [navigation, pageId]);

  const doDeleteSponsor = useCallback(() => {
    if (!pageId) return;
    Alert.alert('Delete sponsor?', 'Removes this partner page for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const ok = await deleteSubscriptionOfferPage(pageId);
            if (ok) {
              Alert.alert('Deleted', 'This sponsor page has been removed.');
              navigation.goBack();
            } else {
              Alert.alert('Could not delete', 'You may not have permission to delete this sponsor page.');
            }
          })();
        },
      },
    ]);
  }, [navigation, pageId]);

  return (
    <View style={styles.root}>
      <View style={[styles.brandTopNav, { paddingTop: insets.top + DS.space.sm }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.brandNavBtn}>
          <FontAwesome name="chevron-left" size={18} color={colors.textMuted} />
        </Pressable>
        <Text style={styles.brandNavTitle}>Partner</Text>
        {user?.masterControl ? (
          <Pressable
            onPress={() => setMenuOpen(true)}
            style={styles.brandNavBtn}
            accessibilityLabel="Sponsor options"
          >
            <FontAwesome name="ellipsis-v" size={18} color={colors.text} />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => {
              void Share.share({
                message: siteUri ? `${page.business_name}\n${siteUri}` : page.business_name,
              });
            }}
            style={styles.brandNavBtn}
            accessibilityLabel="Share sponsor"
          >
            <FontAwesome name="share" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
      <OptionMenuModal
        visible={menuOpen}
        title="Sponsor"
        onClose={() => setMenuOpen(false)}
        options={[
          {
            key: 'edit',
            label: 'Edit sponsor',
            onPress: () => {
              setMenuOpen(false);
              goEditSponsor();
            },
          },
          {
            key: 'share',
            label: 'Share sponsor',
            onPress: () => {
              setMenuOpen(false);
              void Share.share({
                message: siteUri ? `${page.business_name}\n${siteUri}` : page.business_name,
              });
            },
          },
          {
            key: 'delete',
            label: 'Delete sponsor',
            destructive: true,
            onPress: () => {
              setMenuOpen(false);
              doDeleteSponsor();
            },
          },
        ]}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.brandScroll, { paddingBottom: 120 + insets.bottom }]}
      >
        <View style={styles.brandHero}>
          {heroUri ? (
            <Image
              source={{ uri: heroUri }}
              style={{
                width: '100%',
                height: 200,
                borderRadius: DS.radius.xl,
                marginBottom: DS.space.md,
              }}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.brandLogoCard}>
              <BrandLogo width={240} height={72} />
            </View>
          )}
          <Text style={styles.brandHeroTitle}>{page.business_name.toUpperCase()}</Text>
          <View style={styles.brandActiveRow}>
            <View style={styles.brandActiveDot} />
            <Text style={styles.brandActiveLabel}>Partner offer</Text>
          </View>
        </View>
        {featured.hook ? (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: DS.radius.xl,
              padding: DS.space.lg,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.borderWhite5,
              marginBottom: DS.space.md,
            }}
          >
            <Text
              style={{
                fontFamily: DS.font.bodyMedium,
                fontSize: 11,
                letterSpacing: 2,
                textTransform: 'uppercase',
                color: colors.gold,
                marginBottom: DS.space.sm,
              }}
            >
              Featured offer
            </Text>
            <Text style={{ fontFamily: DS.font.heading, fontSize: 20, lineHeight: 28, color: colors.text }}>
              {featured.hook}
            </Text>
          </View>
        ) : null}
        {featured.helpsAthletes ? (
          <View style={styles.brandAbout}>
            <Text style={[styles.brandAboutTitle, { fontSize: 20 }]}>How this helps athletes</Text>
            <Text style={[styles.brandAboutBody, { fontSize: 16, lineHeight: 24 }]}>{featured.helpsAthletes}</Text>
          </View>
        ) : page.description?.trim() ? (
          <View style={styles.brandAbout}>
            <Text style={[styles.brandAboutTitle, { fontSize: 20 }]}>About</Text>
            <Text style={[styles.brandAboutBody, { fontSize: 16, lineHeight: 24 }]}>{page.description.trim()}</Text>
          </View>
        ) : null}
        {featured.contactEmail ? (
          <View style={[styles.brandPromoBlock, { marginTop: DS.space.md }]}>
            <View style={styles.brandPromoHeadingRow}>
              <FontAwesome name="envelope" size={12} color={colors.gold} />
              <Text style={styles.brandPromoHeading}> Contact</Text>
            </View>
            <Text style={[styles.brandCodeHint, { fontSize: 14, lineHeight: 20 }]}>{featured.contactEmail}</Text>
          </View>
        ) : null}
        {videoUri ? (
          <Pressable
            style={[styles.brandPromoBlock, { marginTop: DS.space.md }]}
            onPress={() => void Linking.openURL(videoUri)}
          >
            <View style={styles.brandPromoHeadingRow}>
              <FontAwesome name="play-circle" size={12} color={colors.gold} />
              <Text style={styles.brandPromoHeading}> Watch video</Text>
            </View>
            <Text style={styles.brandCodeHint}>Opens in your browser</Text>
          </Pressable>
        ) : null}
        {promoCodes.length ? (
          <View style={[styles.brandAbout, { marginTop: DS.space.sm }]}>
            <Text style={styles.brandAboutTitle}>Promo codes</Text>
            {promoCodes.map((p) => (
              <View key={p.code} style={{ marginBottom: DS.space.md }}>
                <Text style={{ fontFamily: DS.font.bodyBold, color: colors.gold }}>{p.code}</Text>
                <Text style={styles.brandAboutBody}>{p.details}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {galleryUrls.length ? (
          <View style={[styles.brandAbout, { marginTop: DS.space.sm }]}>
            <Text style={styles.brandAboutTitle}>Gallery</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {galleryUrls.slice(0, 12).map((u) => (
                <Image
                  key={u}
                  source={{ uri: u }}
                  style={{ width: 140, height: 90, borderRadius: DS.radius.md, marginRight: DS.space.sm }}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          </View>
        ) : null}
        {links.length ? (
          <View style={[styles.brandAbout, { marginTop: DS.space.sm }]}>
            <Text style={styles.brandAboutTitle}>Links</Text>
            {links.map((l) => (
              <Pressable
                key={`${l.label}-${l.url}`}
                onPress={() => void Linking.openURL(l.url)}
                style={{ marginBottom: DS.space.md }}
              >
                <Text style={{ fontFamily: DS.font.bodyBold, color: colors.gold }}>{l.label}</Text>
                <Text style={styles.muted} numberOfLines={2}>
                  {l.url}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
      <View style={[styles.brandFooter, { paddingBottom: Math.max(insets.bottom, DS.space.md) }]}>
        <Pressable
          style={styles.brandVisitCta}
          onPress={() => {
            if (siteUri) void Linking.openURL(siteUri);
            else Alert.alert('Website', 'No website URL has been added for this partner yet.');
          }}
        >
          <Text style={styles.brandVisitText}>VISIT WEBSITE</Text>
          <FontAwesome5 name="external-link-alt" size={13} color={colors.gold} solid />
        </Pressable>
      </View>
    </View>
  );
}

export function DemoHubScreen({ navigation }: CProps<'DemoHub'>) {
  const { styles } = useCommunityTheme();
  const { logout } = useAuth();
  const go = (tab: 'Community' | 'Media' | 'Events' | 'Sponsors' | 'Profile', screen: string) => {
    navigation.getParent()?.navigate(tab, { screen });
  };
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.hubPad}>
      <Text style={styles.hubKicker}>DALTON PROJECT</Text>
      <Text style={styles.hubTitle}>SCREEN SHORTCUTS</Text>
      <Text style={styles.hubBody}>
        Quick jumps to primary areas while building and testing the app.
      </Text>
      <HubBtn label="Path A — Sign out (return to welcome)" onPress={() => void logout()} />
      <HubBtn label="Path B — Upcoming events" onPress={() => go('Events', 'UpcomingEvents')} />
      <HubBtn label="Path C — Media library" onPress={() => go('Media', 'MediaLibrary')} />
      <HubBtn label="Path D — Community feed" onPress={() => go('Community', 'CommunityFeed')} />
      <HubBtn label="Path E — Athlete profile" onPress={() => go('Profile', 'AthleteProfile')} />
      <Pressable style={styles.hubClose} onPress={() => navigation.goBack()}>
        <Text style={styles.muted}>Close</Text>
      </Pressable>
    </ScrollView>
  );
}

function HubBtn({ label, onPress }: { label: string; onPress: () => void }) {
  const { styles } = useCommunityTheme();
  return (
    <Pressable style={styles.hubBtn} onPress={onPress}>
      <Text style={styles.hubBtnText}>{label}</Text>
    </Pressable>
  );
}

