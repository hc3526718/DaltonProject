import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../auth/AuthContext';
import { DS } from '../../designSystem';
import { uploadProposalAttachment } from '../../lib/proposalAttachmentUpload';
import { masterInstantPublish } from '../../lib/masterInstantPublish';
import type { MediaStackParamList } from '../../navigation/types';
import { WizardChrome } from './WizardChrome';

type Props = NativeStackScreenProps<MediaStackParamList, 'MediaProposalWizard'>;

const CATEGORIES = ['Training', 'Mindset', 'Nutrition', 'Recovery', 'Career', 'Other'] as const;
const TAGS = [
  'Technique',
  'Strength',
  'Speed',
  'Mindset',
  'Recovery',
  'Nutrition',
  'Mobility',
  'Competition',
] as const;
const TOTAL_STEPS = 6;

export function MediaProposalWizard({ navigation }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [pitch, setPitch] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('Training');
  const [selectedTags, setSelectedTags] = useState<(typeof TAGS)[number][]>([]);
  const [video, setVideo] = useState<{ name: string; uri: string } | null>(null);
  const [thumbnail, setThumbnail] = useState<{ name: string; uri: string } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmTitle, setConfirmTitle] = useState<string | null>(null);
  const [seriesTitle, setSeriesTitle] = useState('');
  const [seriesPart, setSeriesPart] = useState('1');
  const [featureSeries, setFeatureSeries] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user?.masterControl) {
        navigation.goBack();
      }
    }, [navigation, user?.masterControl]),
  );

  const pickVideo = useCallback(async () => {
    const res = await DocumentPicker.getDocumentAsync({
      multiple: false,
      copyToCacheDirectory: true,
      type: 'video/*',
    });
    if (res.canceled) return;
    const a = res.assets?.[0];
    if (!a?.uri) return;
    const name = a.name ?? 'video.mp4';
    const lower = name.toLowerCase();
    if (!lower.match(/\.(mp4|mov|m4v|webm)$/i)) {
      Alert.alert('Video only', 'Please choose an MP4/MOV/WebM video file.');
      return;
    }
    setVideo({ name, uri: a.uri });
  }, []);

  const pickThumbnail = useCallback(async () => {
    const res = await DocumentPicker.getDocumentAsync({
      multiple: false,
      copyToCacheDirectory: true,
      type: 'image/*',
    });
    if (res.canceled) return;
    const a = res.assets?.[0];
    if (!a?.uri) return;
    setThumbnail({ name: a.name ?? 'thumbnail.jpg', uri: a.uri });
  }, []);

  const toggleTag = (t: (typeof TAGS)[number]) => {
    setSelectedTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const tagsLine = useMemo(() => selectedTags.join(', '), [selectedTags]);

  const publish = useCallback(async () => {
    if (publishing || !user?.id) return;
    if (!video?.uri || !video.name) {
      setError('Please upload a video to publish.');
      return;
    }
    setPublishing(true);
    setError(null);
    const uploaded: string[] = [];
    const url = await uploadProposalAttachment(user.id, 'media', video.uri, video.name);
    if (url) uploaded.push(url);
    if (thumbnail?.uri && thumbnail.name) {
      // Important: upload thumbnail AFTER video so attachment order doesn't break media publishing.
      const tUrl = await uploadProposalAttachment(user.id, 'media', thumbnail.uri, thumbnail.name);
      if (tUrl) uploaded.push(tUrl);
    }
    const result = await masterInstantPublish(
      user.id,
      'media',
      {
        title: title.trim(),
        pitch: pitch.trim(),
        category,
        tags: selectedTags,
        series_title: seriesTitle.trim() || undefined,
        series_part: seriesTitle.trim() ? parseInt(seriesPart.trim(), 10) || 1 : undefined,
        feature_series: featureSeries && !!seriesTitle.trim(),
      },
      uploaded,
      [{ uri: video.uri, name: video.name }],
    );
    setPublishing(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setConfirmTitle(title.trim());
    setStep(6);
  }, [category, featureSeries, pitch, publishing, selectedTags, seriesPart, seriesTitle, title, user?.id, video]);

  useEffect(() => {
    if (step !== 6 || !confirmTitle) return;
    const timer = setTimeout(() => {
      navigation.reset({
        index: 0,
        routes: [{ name: 'MediaLibrary', params: { createdMediaTitle: confirmTitle } }],
      });
    }, 2600);
    return () => clearTimeout(timer);
  }, [step, confirmTitle, navigation]);

  const chrome = (
    children: React.ReactNode,
    opts?: { nextLabel?: string; onNext?: () => void; hideNext?: boolean; nextDisabled?: boolean },
  ) => (
    <WizardChrome
      title="Create media"
      step={step}
      totalSteps={TOTAL_STEPS}
      onBack={() => (step > 1 ? setStep(step - 1) : navigation.goBack())}
      onNext={opts?.hideNext ? undefined : opts?.onNext ?? (() => setStep(step + 1))}
      nextLabel={opts?.nextLabel}
      nextDisabled={publishing || opts?.nextDisabled}
      errorMessage={error}
    >
      {children}
    </WizardChrome>
  );

  if (step === 1) {
    return chrome(
      <>
        <Text style={styles.lead}>Video only — published live in the media library when you confirm.</Text>
        <Text style={styles.label}>Video upload</Text>
        <Text style={styles.linkBtn} onPress={() => void pickVideo()}>
          {video ? 'Change video' : '+ Upload video'}
        </Text>
        {video ? <Text style={styles.fileRow}>{video.name}</Text> : null}
        <Text style={styles.label}>Thumbnail (recommended)</Text>
        {thumbnail?.uri ? <Image source={{ uri: thumbnail.uri }} style={styles.thumb} /> : null}
        <Text style={styles.linkBtn} onPress={() => void pickThumbnail()}>
          {thumbnail ? 'Change thumbnail' : '+ Set thumbnail'}
        </Text>
      </>,
      { nextDisabled: !video },
    );
  }

  if (step === 2) {
    return chrome(
      <>
        <Text style={styles.lead}>Add the details shown on the media page.</Text>
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Video title"
          placeholderTextColor={DS.color.textMuted}
        />
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.multi]}
          value={pitch}
          onChangeText={setPitch}
          multiline
          placeholder="What will athletes learn? (min 20 characters)"
          placeholderTextColor={DS.color.textMuted}
        />
        <Text style={styles.label}>Category</Text>
        <View style={styles.chips}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c}
              onPress={() => setCategory(c)}
              style={[styles.chip, category === c && styles.chipOn]}
            >
              <Text style={[styles.chipText, category === c && styles.chipTextOn]}>{c}</Text>
            </Pressable>
          ))}
        </View>
      </>,
      { nextDisabled: !title.trim() || pitch.trim().length < 20 },
    );
  }

  if (step === 3) {
    return chrome(
      <>
        <Text style={styles.lead}>Select tags (choose one or more).</Text>
        <View style={styles.chips}>
          {TAGS.map((t) => {
            const on = selectedTags.includes(t);
            return (
              <Pressable key={t} onPress={() => toggleTag(t)} style={[styles.chip, on && styles.chipOn]}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{t}</Text>
              </Pressable>
            );
          })}
        </View>
        {selectedTags.length ? <Text style={styles.tagPreview}>Selected: {tagsLine}</Text> : null}
      </>,
      { nextLabel: 'Series', nextDisabled: selectedTags.length === 0 },
    );
  }

  if (step === 4) {
    return chrome(
      <>
        <Text style={styles.lead}>
          Optional: add this video to a series. Featured series is shown at the top of Media.
        </Text>
        <Text style={styles.label}>Series title</Text>
        <TextInput
          style={styles.input}
          value={seriesTitle}
          onChangeText={setSeriesTitle}
          placeholder="e.g. The Champion&apos;s Mindset"
          placeholderTextColor={DS.color.textMuted}
        />
        <Text style={styles.label}>Part number</Text>
        <TextInput
          style={styles.input}
          value={seriesPart}
          onChangeText={setSeriesPart}
          keyboardType="number-pad"
          placeholder="1"
          placeholderTextColor={DS.color.textMuted}
        />
        <Pressable
          style={[styles.featureRow, featureSeries && styles.featureRowOn]}
          onPress={() => setFeatureSeries((v) => !v)}
          disabled={!seriesTitle.trim()}
        >
          <FontAwesome
            name={featureSeries ? 'check-square' : 'square-o'}
            size={18}
            color={seriesTitle.trim() ? DS.color.gold : DS.color.textMuted}
          />
          <Text style={styles.featureRowText}>Feature this series on Media home</Text>
        </Pressable>
      </>,
      { nextLabel: 'Review' },
    );
  }

  if (step === 5) {
    return chrome(
      <>
        <Text style={styles.lead}>Preview how this looks to a standard user.</Text>
        <View style={styles.previewCard}>
          {thumbnail?.uri ? <Image source={{ uri: thumbnail.uri }} style={styles.previewImg} /> : null}
          <View style={styles.previewBody}>
            <View style={styles.previewBadgeRow}>
              <View style={styles.previewBadgePill}>
                <Text style={styles.previewBadgeText}>{category}</Text>
              </View>
              {selectedTags.length ? <Text style={styles.previewMeta}>{tagsLine}</Text> : null}
            </View>
            <Text style={styles.previewTitle}>{title.trim()}</Text>
            <Text style={styles.previewDesc} numberOfLines={6}>
              {pitch.trim()}
            </Text>
            {video ? <Text style={styles.previewMeta}>Video: {video.name}</Text> : null}
          </View>
        </View>
      </>,
      {
        nextLabel: publishing ? 'Publishing…' : 'Create media',
        onNext: () => void publish(),
      },
    );
  }

  return chrome(
    <>
      <View style={styles.confirmHero}>
        <FontAwesome name="check-circle" size={48} color={DS.color.gold} />
        <Text style={styles.confirmTitle}>Media published</Text>
        <Text style={styles.confirmSubtitle}>{confirmTitle}</Text>
      </View>
      <Text style={styles.confirmHint}>Taking you to Media…</Text>
    </>,
    { hideNext: true },
  );
}

const styles = StyleSheet.create({
  lead: {
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.textMuted,
    marginBottom: DS.space.lg,
    lineHeight: 20,
  },
  label: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 13,
    color: DS.color.screenTitle,
    marginBottom: DS.space.xs,
  },
  input: {
    backgroundColor: DS.color.input,
    borderRadius: DS.radius.lg,
    padding: DS.space.md,
    color: DS.color.text,
    fontFamily: DS.font.body,
    fontSize: 15,
    marginBottom: DS.space.md,
  },
  multi: { minHeight: 100, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: DS.space.sm },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: DS.color.input,
  },
  chipOn: { backgroundColor: DS.color.gold },
  chipText: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 13,
    color: DS.color.white,
  },
  chipTextOn: {
    color: DS.color.background,
    fontWeight: '700',
  },
  linkBtn: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 15,
    color: DS.color.gold,
    marginBottom: DS.space.md,
  },
  fileRow: {
    fontFamily: DS.font.body,
    fontSize: 13,
    color: DS.color.textMuted,
    marginBottom: 4,
  },
  thumb: {
    width: '100%',
    height: 160,
    borderRadius: DS.radius.lg,
    marginBottom: DS.space.md,
  },
  tagPreview: {
    marginTop: DS.space.md,
    fontFamily: DS.font.body,
    fontSize: 13,
    color: DS.color.textMuted,
    lineHeight: 18,
  },
  reviewTitle: {
    fontFamily: DS.font.heading,
    fontSize: 26,
    color: DS.color.white,
    marginBottom: DS.space.sm,
  },
  reviewMeta: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 14,
    color: DS.color.gold,
    marginBottom: DS.space.sm,
  },
  reviewBody: {
    fontFamily: DS.font.body,
    fontSize: 15,
    color: DS.color.text,
    lineHeight: 22,
  },
  previewCard: {
    marginTop: DS.space.md,
    backgroundColor: DS.color.surface,
    borderRadius: DS.radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  previewImg: { width: '100%', height: 180 },
  previewBody: { padding: DS.space.lg },
  previewBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm, marginBottom: DS.space.sm },
  previewBadgePill: {
    backgroundColor: 'rgba(197, 168, 106, 0.18)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  previewBadgeText: { color: DS.color.gold, fontFamily: DS.font.bodyMedium, fontSize: 12 },
  previewTitle: { color: DS.color.text, fontFamily: DS.font.heading, fontSize: 18, marginTop: DS.space.xs },
  previewDesc: { color: DS.color.textMuted, fontFamily: DS.font.body, marginTop: DS.space.sm, lineHeight: 20 },
  previewMeta: { color: DS.color.textMuted, fontFamily: DS.font.bodyMedium, fontSize: 12, marginTop: DS.space.sm, flex: 1 },
  confirmHero: { alignItems: 'center', marginTop: DS.space.lg, marginBottom: DS.space.lg },
  confirmTitle: {
    fontFamily: DS.font.heading,
    fontSize: 24,
    color: DS.color.text,
    marginTop: DS.space.md,
  },
  confirmSubtitle: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 16,
    color: DS.color.gold,
    marginTop: DS.space.sm,
    textAlign: 'center',
  },
  confirmHint: {
    fontFamily: DS.font.body,
    fontSize: 13,
    color: DS.color.textMuted,
    textAlign: 'center',
    marginTop: DS.space.xl,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    marginTop: DS.space.lg,
    padding: DS.space.md,
    borderRadius: DS.radius.md,
    borderWidth: 1,
    borderColor: DS.color.borderHairline,
  },
  featureRowOn: {
    borderColor: DS.color.gold,
    backgroundColor: DS.color.goldTint10,
  },
  featureRowText: {
    flex: 1,
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.text,
  },
});
