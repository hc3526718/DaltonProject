import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { pickLocalComposerMedia } from '../../lib/pickLocalMedia';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FontAwesome } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useAuth } from '../../auth/AuthContext';
import { CaptionComposer } from '../../components/CaptionComposer';
import { DS } from '../../designSystem';
import { useWizardBack } from '../../hooks/useWizardBack';
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
import { canSubmitCommunityPost } from '../../roadmap/communityPolicy';
import { normalizePostBodyForStorage, validateMentionsInText } from '../../lib/postMentions';
import { insertCommunityPost, listAllEvents } from '../../roadmap/liveDataService';
import type { CommunityStackParamList } from '../../navigation/types';
import { WizardChrome } from '../proposals/WizardChrome';
import { useCommunityTheme } from './CommunityStylesContext';

type Props = NativeStackScreenProps<CommunityStackParamList, 'CreateCommunityPost'>;
const TOTAL_STEPS = 4;

export function CreateCommunityPostWizard({ navigation }: Props) {
  const { styles, colors } = useCommunityTheme();
  const { user } = useAuth();
  const liveMode = isSupabaseConfigured();
  const isDemoUser = Boolean(user?.id?.startsWith('demo-'));
  const showBanner = useActionBanner();

  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [media, setMedia] = useState<ComposerMedia[]>([]);
  const [captionValue, setCaptionValue] = useState({ body: '', hashtags: [] as string[] });
  const [captionPlain, setCaptionPlain] = useState('');
  const [events, setEvents] = useState<{ id: string; title: string }[]>([]);
  const [eventId, setEventId] = useState<string | null>(null);

  const goBack = useWizardBack(step, setStep, () => navigation.goBack());

  useEffect(() => {
    if (!liveMode) return;
    void listAllEvents(100).then((rows) =>
      setEvents(rows.map((e) => ({ id: e.id, title: e.title }))),
    );
  }, [liveMode]);

  const openPicker = useCallback(async () => {
    if (Platform.OS === 'web') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        quality: 0.92,
        videoMaxDuration: Math.floor(MAX_COMPOSER_VIDEO_MS / 1000),
        selectionLimit: MAX_COMPOSER_IMAGES + MAX_COMPOSER_VIDEOS,
      });
      if (res.canceled) return;
      const next: ComposerMedia[] = [];
      for (const a of res.assets) {
        const uri = a.uri;
        if (pickerAssetIsVideo(a)) {
          const durMs = pickerVideoDurationMs(a) ?? MAX_COMPOSER_VIDEO_MS;
          if (durMs > MAX_COMPOSER_VIDEO_MS) continue;
          next.push({ kind: 'video', uri, durationMs: durMs, mimeType: a.mimeType ?? undefined });
        } else if (uri) {
          next.push({ kind: 'image', uri, mimeType: a.mimeType ?? undefined });
        }
      }
      setMedia((prev) => clampComposerMedia([...prev, ...next]));
      return;
    }
    const picked = await pickLocalComposerMedia({ title: 'Post photos or video' });
    if (!picked.length) return;
    const next: ComposerMedia[] = [];
    for (const f of picked) {
      if (f.kind === 'video') {
        next.push({
          kind: 'video',
          uri: f.uri,
          durationMs: MAX_COMPOSER_VIDEO_MS,
        });
      } else {
        next.push({ kind: 'image', uri: f.uri });
      }
    }
    setMedia((prev) => clampComposerMedia([...prev, ...next]));
  }, []);

  const removeMedia = (uri: string) => {
    setMedia((prev) => clampComposerMedia(prev.filter((m) => m.uri !== uri)));
  };

  const validateStep = (s: number): string | null => {
    if (s === 1 && media.length === 0) return 'Add at least one photo or video.';
    if (s === 2 && !canSubmitCommunityPost(user?.id ?? '', { body: captionPlain })) {
      return 'Add a caption before continuing.';
    }
    return null;
  };

  const nextStep = () => {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    if (step < TOTAL_STEPS) setStep(step + 1);
    else void submit();
  };

  const submit = useCallback(async () => {
    const picks = clampComposerMedia(media);
    if (!user || isDemoUser || !liveMode) return;
    const err = validateStep(1) ?? validateStep(2);
    if (err) {
      setError(err);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const mentionErr = await validateMentionsInText(captionPlain);
      if (mentionErr) {
        setError(mentionErr);
        return;
      }
      const eventTag = eventId ? `\n\n#event:${eventId}` : '';
      const bodyStored = normalizePostBodyForStorage(captionPlain.trim());
      const created = await insertCommunityPost(user.id, `${bodyStored}${eventTag}`);
      if ('error' in created) {
        setError(created.error);
        return;
      }
      const row = created.row;
      const supabase = getSupabase();
      if (supabase && picks.length > 0) {
        const uploadErrors: string[] = [];
        for (let i = 0; i < picks.length; i++) {
          const m = picks[i]!;
          try {
            const { uploadLocalUriToStorage } = await import('../../lib/uploadLocalFile');
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
          setError(uploadErrors[0] ?? 'Could not upload media.');
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

  if (step === 1) {
    return (
      <WizardChrome
        title="New post"
        step={1}
        totalSteps={TOTAL_STEPS}
        onBack={goBack}
        onNext={nextStep}
        errorMessage={error}
      >
        <Text style={local.lead}>Add photos or videos for your post.</Text>
        <Pressable style={[local.pickBtn, { borderColor: colors.goldTint30 }]} onPress={() => void openPicker()}>
          <FontAwesome name="plus" size={16} color={colors.gold} />
          <Text style={[local.pickTxt, { color: colors.gold }]}> Choose from library</Text>
        </Pressable>
        {first ? (
          <View style={local.hero}>
            {first.kind === 'image' ? (
              <Image source={{ uri: first.uri }} style={local.heroInner} resizeMode="cover" />
            ) : (
              <Video source={{ uri: first.uri }} style={local.heroInner} resizeMode={ResizeMode.COVER} useNativeControls />
            )}
            <Pressable style={styles.mediaRemove} onPress={() => removeMedia(first.uri)}>
              <FontAwesome name="times" size={11} color={colors.background} />
            </Pressable>
          </View>
        ) : null}
        {media.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: DS.space.md }}>
            {media.map((m) => (
              <View key={m.uri} style={styles.composerThumbWrap}>
                <Pressable style={styles.composerThumbRemove} onPress={() => removeMedia(m.uri)}>
                  <FontAwesome name="times" size={8} color={colors.background} />
                </Pressable>
                {m.kind === 'image' ? (
                  <Image source={{ uri: m.uri }} style={styles.composerThumb} />
                ) : (
                  <Video source={{ uri: m.uri }} style={styles.composerThumb} resizeMode={ResizeMode.COVER} />
                )}
              </View>
            ))}
          </ScrollView>
        ) : null}
      </WizardChrome>
    );
  }

  if (step === 2) {
    return (
      <WizardChrome
        title="New post"
        step={2}
        totalSteps={TOTAL_STEPS}
        onBack={goBack}
        onNext={nextStep}
        errorMessage={error}
      >
        <Text style={local.lead}>Caption, mentions, and hashtags.</Text>
        <CaptionComposer
          value={captionValue}
          onChange={(v, plain) => {
            setCaptionValue(v);
            setCaptionPlain(plain);
          }}
          placeholder="@mention teammates — #hashtags"
          maxLength={4000}
        />
      </WizardChrome>
    );
  }

  if (step === 3) {
    return (
      <WizardChrome
        title="New post"
        step={3}
        totalSteps={TOTAL_STEPS}
        onBack={goBack}
        onNext={nextStep}
        nextLabel="Review"
        errorMessage={error}
      >
        <Text style={local.lead}>Optionally link an event (optional).</Text>
        <Pressable
          style={[local.eventChip, eventId === null && local.eventChipOn]}
          onPress={() => setEventId(null)}
        >
          <Text style={local.eventChipTxt}>No event link</Text>
        </Pressable>
        {events.map((e) => (
          <Pressable
            key={e.id}
            style={[local.eventChip, eventId === e.id && local.eventChipOn]}
            onPress={() => setEventId(e.id)}
          >
            <Text style={local.eventChipTxt} numberOfLines={2}>
              {e.title}
            </Text>
          </Pressable>
        ))}
      </WizardChrome>
    );
  }

  return (
    <WizardChrome
      title="New post"
      step={4}
      totalSteps={TOTAL_STEPS}
      onBack={goBack}
      onNext={nextStep}
      nextLabel={busy ? 'Posting…' : 'Post to community'}
      nextDisabled={busy}
      errorMessage={error}
    >
      <Text style={local.lead}>Review before posting.</Text>
      <Text style={[local.reviewLabel, { color: colors.textMuted }]}>Media</Text>
      <Text style={{ color: colors.text }}>{media.length} attachment(s)</Text>
      <Text style={[local.reviewLabel, { color: colors.textMuted }]}>Caption</Text>
      <Text style={{ color: colors.text }}>{captionPlain.trim() || '—'}</Text>
      <Text style={[local.reviewLabel, { color: colors.textMuted }]}>Event</Text>
      <Text style={{ color: colors.text }}>
        {eventId ? events.find((e) => e.id === eventId)?.title ?? 'Linked event' : 'None'}
      </Text>
    </WizardChrome>
  );
}

const local = StyleSheet.create({
  lead: {
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.textMuted,
    marginBottom: DS.space.md,
  },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: DS.space.md,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    marginBottom: DS.space.md,
  },
  pickTxt: { fontFamily: DS.font.bodyMedium, fontSize: 14 },
  hero: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: DS.radius.xl,
    overflow: 'hidden',
    position: 'relative',
  },
  heroInner: { width: '100%', height: '100%' },
  eventChip: {
    padding: DS.space.md,
    borderRadius: DS.radius.lg,
    backgroundColor: DS.color.input,
    marginBottom: DS.space.sm,
  },
  eventChipOn: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: DS.color.gold,
  },
  eventChipTxt: { fontFamily: DS.font.bodyMedium, fontSize: 15, color: DS.color.text },
  reviewLabel: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 12,
    marginTop: DS.space.md,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
});
