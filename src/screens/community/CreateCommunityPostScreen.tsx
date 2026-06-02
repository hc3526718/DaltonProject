import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FontAwesome } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../auth/AuthContext';
import { CaptionComposer } from '../../components/CaptionComposer';
import { DS } from '../../designSystem';
import { useActionBanner } from '../../actionBanner/ActionBannerContext';
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
} from '../../lib/mediaComposer';
import { getSupabase } from '../../lib/supabase';
import { isSupabaseConfigured } from '../../lib/env';
import { uploadLocalUriToStorage } from '../../lib/uploadLocalFile';
import { canSubmitCommunityPost } from '../../roadmap/communityPolicy';
import { normalizePostBodyForStorage, validateMentionsInText } from '../../lib/postMentions';
import { insertCommunityPost, listAllEvents } from '../../roadmap/liveDataService';
import type { CommunityStackParamList } from '../../navigation/types';
import { useCommunityTheme } from './CommunityStylesContext';

type Props = NativeStackScreenProps<CommunityStackParamList, 'CreateCommunityPost'>;

export function CreateCommunityPostScreen({ navigation }: Props) {
  const { styles, colors } = useCommunityTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const liveMode = isSupabaseConfigured();
  const isDemoUser = Boolean(user?.id?.startsWith('demo-'));

  const [captionValue, setCaptionValue] = useState({ body: '', hashtags: [] as string[] });
  const [captionPlain, setCaptionPlain] = useState('');
  const [busy, setBusy] = useState(false);
  const [media, setMedia] = useState<ComposerMedia[]>([]);
  const [events, setEvents] = useState<{ id: string; title: string; starts_at: string }[]>([]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [eventPickerOpen, setEventPickerOpen] = useState(false);

  const showBanner = useActionBanner();

  useEffect(() => {
    if (!liveMode) return;
    void listAllEvents(100).then((rows) =>
      setEvents(rows.map((e) => ({ id: e.id, title: e.title, starts_at: e.starts_at }))),
    );
  }, [liveMode]);

  const openPicker = useCallback(async () => {
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 0.92,
      videoMaxDuration: Math.floor(MAX_COMPOSER_VIDEO_MS / 1000),
      selectionLimit: MAX_COMPOSER_IMAGES + MAX_COMPOSER_VIDEOS,
    });

    if (res.canceled) return;

    const nextIncoming: ComposerMedia[] = [];
    for (const a of res.assets) {
      const uri = a.uri;
      if (pickerAssetIsVideo(a)) {
        const durMs = pickerVideoDurationMs(a) ?? MAX_COMPOSER_VIDEO_MS;
        if (durMs > MAX_COMPOSER_VIDEO_MS) continue;
        nextIncoming.push({
          kind: 'video',
          uri,
          durationMs: durMs,
          mimeType: a.mimeType ?? undefined,
        });
      } else if (uri) {
        nextIncoming.push({ kind: 'image', uri, mimeType: a.mimeType ?? undefined });
      }
    }

    setMedia((prev) => clampComposerMedia([...prev, ...nextIncoming]));
  }, []);

  const canPost = Boolean(
    user &&
      !isDemoUser &&
      liveMode &&
      media.length > 0 &&
      canSubmitCommunityPost(user.id, { body: captionPlain }) &&
      !busy,
  );

  const removeMedia = useCallback((uri: string) => {
    setMedia((prev) => clampComposerMedia(prev.filter((m) => m.uri !== uri)));
  }, []);

  const submit = useCallback(async () => {
    const picks = clampComposerMedia(media);
    if (!user || isDemoUser || !liveMode) return;
    if (picks.length === 0) {
      Alert.alert('Add media', 'Choose at least one photo or video.');
      return;
    }
    if (!canSubmitCommunityPost(user.id, { body: captionPlain })) {
      Alert.alert('Caption required', 'Add a caption before posting.');
      return;
    }
    setBusy(true);
    try {
      const mentionErr = await validateMentionsInText(captionPlain);
      if (mentionErr) {
        Alert.alert('Unknown mention', mentionErr);
        return;
      }
      const eventTag = eventId ? `\n\n#event:${eventId}` : '';
      const bodyStored = normalizePostBodyForStorage(captionPlain.trim());
      const created = await insertCommunityPost(user.id, `${bodyStored}${eventTag}`);
      if ('error' in created) {
        Alert.alert('Could not post', created.error);
        return;
      }
      const row = created.row;
      const supabase = getSupabase();
      if (supabase && picks.length > 0) {
        const uploadErrors: string[] = [];
        for (let i = 0; i < picks.length; i++) {
          const m = picks[i]!;
          try {
            const contentType = m.mimeType ?? inferContentType(m.kind, m.uri);
            const ext = inferExt(m.kind, m.uri);
            const storage_path = `posts/${user.id}/${row.id}/${Date.now()}-${i}.${ext}`;
            const up = await uploadLocalUriToStorage(
              supabase,
              'media_assets',
              storage_path,
              m.uri,
              contentType,
            );
            if (!up.ok) {
              uploadErrors.push(up.error);
              continue;
            }
            const { error: insErr } = await supabase.from('media_assets').insert({
              owner_id: user.id,
              kind: m.kind,
              storage_path,
              public_url: up.publicUrl,
              mime_type: contentType,
              visibility: 'public',
              post_id: row.id,
            });
            if (insErr) uploadErrors.push(insErr.message);
          } catch (e) {
            uploadErrors.push(e instanceof Error ? e.message : 'Upload failed');
          }
        }
        if (uploadErrors.length === picks.length) {
          Alert.alert('Could not upload media', uploadErrors[0] ?? 'Try again.');
          return;
        }
        if (uploadErrors.length > 0) {
          showBanner('Posted with warnings', 'Some attachments could not be uploaded.');
        }
      }
      showBanner('Posted', 'Your post is live in the feed.');
      navigation.goBack();
    } finally {
      setBusy(false);
    }
  }, [user, isDemoUser, liveMode, captionPlain, eventId, navigation, media, showBanner]);

  const first = media[0];

  return (
    <View style={styles.root}>
      <View style={[styles.createTop, { paddingTop: insets.top + DS.space.md }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <FontAwesome name="arrow-left" size={20} color={colors.gold} />
        </Pressable>
        <Text style={styles.createTitle}>NEW POST</Text>
        <Pressable
          onPress={() => void submit()}
          disabled={!canPost}
          style={[styles.createPostBtn, !canPost && { opacity: 0.45 }]}
        >
          <Text style={styles.createPostBtnTxt}>{busy ? 'Posting…' : 'Post'}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.createBody, { paddingBottom: 32 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.composerSectionKicker}>MEDIA</Text>
        <View style={styles.composerHeroCompact}>
          {first ? (
            <>
              {first.kind === 'image' ? (
                <Image source={{ uri: first.uri }} style={styles.composerHeroInner} resizeMode="cover" />
              ) : (
                <Video
                  source={{ uri: first.uri }}
                  style={styles.composerHeroInner}
                  resizeMode={ResizeMode.COVER}
                  useNativeControls
                  isLooping={false}
                />
              )}
              <Pressable style={styles.mediaRemove} onPress={() => removeMedia(first.uri)} hitSlop={8}>
                <FontAwesome name="times" size={12} color={colors.text} />
              </Pressable>
              <Pressable style={styles.composerAddChip} onPress={() => void openPicker()} hitSlop={8}>
                <FontAwesome name="plus" size={11} color={colors.background} />
                <Text style={styles.composerAddChipTxt}>Add</Text>
              </Pressable>
            </>
          ) : (
            <Pressable style={styles.composerHeroEmptyCompact} onPress={() => void openPicker()}>
              <FontAwesome name="plus-square-o" size={22} color={colors.gold} />
              <Text style={styles.composerHeroEmptyTitleCompact}>Add photos & videos</Text>
              <Text style={styles.composerHeroEmptySubCompact}>
                Up to {MAX_COMPOSER_IMAGES} images · {MAX_COMPOSER_VIDEOS} video · max{' '}
                {MAX_COMPOSER_VIDEO_MS / 1000}s
              </Text>
            </Pressable>
          )}
        </View>

        {media.length > 1 ? (
          <>
            <Text style={[styles.composerSectionKicker, { marginTop: DS.space.md }]}>ALL ATTACHMENTS</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.composerThumbStrip}
            >
              {media.map((m) => (
                <View key={m.uri} style={styles.composerThumbWrap}>
                  <Pressable hitSlop={6} style={styles.composerThumbRemove} onPress={() => removeMedia(m.uri)}>
                    <FontAwesome name="times" size={10} color={colors.background} />
                  </Pressable>
                  {m.kind === 'image' ? (
                    <Image source={{ uri: m.uri }} style={styles.composerThumb} />
                  ) : (
                    <>
                      <Video source={{ uri: m.uri }} style={styles.composerThumb} resizeMode={ResizeMode.COVER} />
                      <View style={styles.composerThumbVidBadge} pointerEvents="none">
                        <FontAwesome name="video-camera" size={9} color={colors.background} />
                      </View>
                    </>
                  )}
                </View>
              ))}
            </ScrollView>
          </>
        ) : null}

        <Text style={[styles.composerSectionKicker, { marginTop: DS.space.md }]}>CAPTION · MENTIONS · HASHTAGS</Text>
        <View style={styles.captionCard}>
          <CaptionComposer
            value={captionValue}
            onChange={(v, plain) => {
              setCaptionValue(v);
              setCaptionPlain(plain);
            }}
            placeholder="@mention teammates — #hashtags"
            maxLength={4000}
          />
        </View>

        <Text style={[styles.composerSectionKicker, { marginTop: DS.space.sm }]}>ATTACH EVENT (OPTIONAL)</Text>
        <Pressable
          style={styles.eventTagRow}
          onPress={() => setEventPickerOpen(true)}
          disabled={!events.length}
        >
          <FontAwesome name="calendar" size={16} color={colors.gold} />
          <Text style={styles.eventTagTxt}>
            {eventId ? `${events.find((e) => e.id === eventId)?.title ?? 'Event'}` : 'Select an upcoming event'}
          </Text>
          <FontAwesome name="chevron-right" size={14} color={colors.textMuted} />
        </Pressable>
      </ScrollView>

      {eventPickerOpen ? (
        <View style={styles.eventPickerOverlay}>
          <Pressable style={styles.eventPickerBackdrop} onPress={() => setEventPickerOpen(false)} />
          <View style={[styles.eventPickerSheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Text style={styles.eventPickerTitle}>Attach an event</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {events.map((e) => (
                <Pressable
                  key={e.id}
                  style={styles.eventPickerRow}
                  onPress={() => {
                    setEventId(e.id);
                    setEventPickerOpen(false);
                  }}
                >
                  <Text style={styles.eventPickerRowTitle}>{e.title}</Text>
                  <Text style={styles.eventPickerRowMeta}>{new Date(e.starts_at).toLocaleString()}</Text>
                </Pressable>
              ))}
              <Pressable
                style={[styles.eventPickerRow, { borderBottomWidth: 0 }]}
                onPress={() => {
                  setEventId(null);
                  setEventPickerOpen(false);
                }}
              >
                <Text style={[styles.eventPickerRowTitle, { color: colors.textMuted }]}>Clear event</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      ) : null}
    </View>
  );
}
