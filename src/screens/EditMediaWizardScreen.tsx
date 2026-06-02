import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useWizardBeforeRemove } from '../hooks/useWizardBeforeRemove';
import { useAuth } from '../auth/AuthContext';
import { DS } from '../designSystem';
import { uploadProposalAttachment } from '../lib/proposalAttachmentUpload';
import type { MediaStackParamList } from '../navigation/types';
import { getMediaAssetById, setFeaturedMediaSeries, updateMediaAsset } from '../roadmap/liveDataService';
import type { MediaAssetRow } from '../roadmap/types';
import { WizardChrome } from './proposals/WizardChrome';

type Props = NativeStackScreenProps<MediaStackParamList, 'EditMedia'>;

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
const TOTAL_STEPS = 5;

function parseCategoryAndPitch(description: string | null): { category: string | null; pitch: string } {
  const desc = (description ?? '').trim();
  if (!desc) return { category: null, pitch: '' };
  const m = desc.match(/(?:^|\n)Category:\s*([^\n]+)\s*(?:\n|$)/i);
  const category = m?.[1]?.trim() || null;
  const pitch = desc.replace(/\n*Category:\s*[^\n]+\s*/gi, '\n').trim();
  return { category, pitch };
}

function buildDescription(pitch: string, category: string): string {
  const p = pitch.trim();
  const c = category.trim();
  return [p, c ? `Category: ${c}` : ''].filter(Boolean).join('\n\n').trim();
}

export function EditMediaWizardScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const mediaId = route.params.mediaId;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [asset, setAsset] = useState<MediaAssetRow | null>(null);
  const [title, setTitle] = useState('');
  const [pitch, setPitch] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('Training');
  const [selectedTags, setSelectedTags] = useState<(typeof TAGS)[number][]>([]);

  const [newVideo, setNewVideo] = useState<{ name: string; uri: string } | null>(null);
  const [newThumb, setNewThumb] = useState<{ name: string; uri: string } | null>(null);
  const [seriesTitle, setSeriesTitle] = useState('');
  const [seriesPart, setSeriesPart] = useState('');
  const [featureSeries, setFeatureSeries] = useState(false);

  const initialSnapshot = useRef<string>('');

  useFocusEffect(
    useCallback(() => {
      if (!user?.masterControl) navigation.goBack();
    }, [navigation, user?.masterControl]),
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    void (async () => {
      const row = await getMediaAssetById(mediaId);
      if (!alive) return;
      if (!row) {
        setLoading(false);
        setError('Could not load this media item.');
        return;
      }
      setAsset(row);
      setTitle(row.title?.trim() || '');
      const parsed = parseCategoryAndPitch(row.description ?? null);
      setPitch(parsed.pitch);
      const cat = (parsed.category ?? 'Training').trim();
      setCategory((CATEGORIES as readonly string[]).includes(cat) ? (cat as any) : 'Training');
      const tags = Array.isArray(row.tags) ? row.tags : [];
      const cleaned = tags.map((t) => String(t).trim()).filter(Boolean) as any[];
      setSelectedTags(cleaned.filter((t) => (TAGS as readonly string[]).includes(t)) as any);
      setSeriesTitle(row.series_title?.trim() ?? '');
      setSeriesPart(row.series_part != null ? String(row.series_part) : '');
      setFeatureSeries(!!row.featured_series);
      initialSnapshot.current = JSON.stringify({
        title: row.title?.trim() || '',
        pitch: parsed.pitch,
        category: (CATEGORIES as readonly string[]).includes(cat) ? cat : 'Training',
        tags: cleaned.filter((t) => (TAGS as readonly string[]).includes(t)),
        thumb: row.thumbnail_url?.trim() || null,
        url: row.public_url?.trim() || null,
        seriesTitle: row.series_title?.trim() ?? '',
        seriesPart: row.series_part != null ? String(row.series_part) : '',
        featureSeries: !!row.featured_series,
      });
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [mediaId]);

  const dirty = useMemo(() => {
    if (!asset) return false;
    const now = JSON.stringify({
      title: title.trim(),
      pitch: pitch.trim(),
      category,
      tags: selectedTags.slice().sort(),
      thumb: newThumb ? 'changed' : asset.thumbnail_url?.trim() || null,
      url: newVideo ? 'changed' : asset.public_url?.trim() || null,
      seriesTitle: seriesTitle.trim(),
      seriesPart: seriesPart.trim(),
      featureSeries,
    });
    return now !== initialSnapshot.current;
  }, [asset, category, featureSeries, newThumb, newVideo, pitch, selectedTags, seriesPart, seriesTitle, title]);

  useWizardBeforeRemove(
    useCallback(
      (e) => {
        if (!dirty || saving) return;
        e.preventDefault();
        Alert.alert('Discard changes?', 'You have unsaved edits.', [
          { text: 'Keep editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ]);
      },
      [dirty, navigation, saving],
    ),
  );

  const pickThumb = useCallback(async () => {
    const res = await DocumentPicker.getDocumentAsync({
      multiple: false,
      copyToCacheDirectory: true,
      type: 'image/*',
    });
    if (res.canceled) return;
    const a = res.assets?.[0];
    if (!a?.uri) return;
    setNewThumb({ name: a.name ?? 'thumbnail.jpg', uri: a.uri });
  }, []);

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
    setNewVideo({ name, uri: a.uri });
  }, []);

  const toggleTag = (t: (typeof TAGS)[number]) => {
    setSelectedTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const tagsLine = useMemo(() => selectedTags.join(', '), [selectedTags]);
  const currentThumb = newThumb?.uri?.trim() || asset?.thumbnail_url?.trim() || asset?.public_url?.trim() || '';

  const save = useCallback(async () => {
    if (saving || !user?.id || !asset) return;
    if (!title.trim() || pitch.trim().length < 20 || selectedTags.length === 0) {
      setError('Please complete title, description (min 20 chars), and at least one tag.');
      return;
    }
    setSaving(true);
    setError(null);

    let nextVideoUrl: string | null | undefined = undefined;
    if (newVideo?.uri && newVideo.name) {
      nextVideoUrl = await uploadProposalAttachment(user.id, 'media', newVideo.uri, newVideo.name);
      if (!nextVideoUrl) {
        setSaving(false);
        setError('Could not upload the new video. Please try again.');
        return;
      }
    }

    let nextThumbUrl: string | null | undefined = undefined;
    if (newThumb?.uri && newThumb.name) {
      nextThumbUrl = await uploadProposalAttachment(user.id, 'media', newThumb.uri, newThumb.name);
      if (!nextThumbUrl) {
        setSaving(false);
        setError('Could not upload the new thumbnail. Please try again.');
        return;
      }
    }

    const partNum = parseInt(seriesPart.trim(), 10);
    const updated = await updateMediaAsset(asset.id, {
      kind: 'video',
      title: title.trim(),
      description: buildDescription(pitch, category),
      tags: selectedTags,
      series_title: seriesTitle.trim() || null,
      series_part: seriesTitle.trim() && Number.isFinite(partNum) && partNum > 0 ? partNum : null,
      featured_series: featureSeries && !!seriesTitle.trim(),
      ...(nextVideoUrl !== undefined ? { public_url: nextVideoUrl } : {}),
      ...(nextThumbUrl !== undefined ? { thumbnail_url: nextThumbUrl } : {}),
    });

    setSaving(false);
    if (!updated) {
      setError('Could not save changes. Check permissions and try again.');
      return;
    }

    if (featureSeries && seriesTitle.trim()) {
      await setFeaturedMediaSeries(seriesTitle.trim());
    } else if (!featureSeries && asset.featured_series) {
      await setFeaturedMediaSeries(null);
    }

    initialSnapshot.current = JSON.stringify({
      title: updated.title?.trim() || '',
      pitch: parseCategoryAndPitch(updated.description ?? null).pitch,
      category,
      tags: (Array.isArray(updated.tags) ? updated.tags : []).slice().sort(),
      thumb: updated.thumbnail_url?.trim() || null,
      url: updated.public_url?.trim() || null,
      seriesTitle: updated.series_title?.trim() ?? '',
      seriesPart: updated.series_part != null ? String(updated.series_part) : '',
      featureSeries: !!updated.featured_series,
    });

    navigation.reset({
      index: 1,
      routes: [
        { name: 'MediaLibrary' as const },
        {
          name: 'MediaPlayer' as const,
          params: { mediaId: updated.id, title: updated.title ?? undefined, playbackUrl: updated.public_url ?? undefined },
        },
      ],
    });
  }, [
    asset,
    category,
    featureSeries,
    navigation,
    newThumb,
    newVideo,
    pitch,
    saving,
    selectedTags,
    seriesPart,
    seriesTitle,
    title,
    user?.id,
  ]);

  const chrome = (
    children: React.ReactNode,
    opts?: { nextLabel?: string; onNext?: () => void; hideNext?: boolean; nextDisabled?: boolean },
  ) => (
    <WizardChrome
      title="Edit media"
      step={step}
      totalSteps={TOTAL_STEPS}
      onBack={() => (step > 1 ? setStep(step - 1) : navigation.goBack())}
      onNext={opts?.hideNext ? undefined : opts?.onNext ?? (() => setStep(step + 1))}
      nextLabel={opts?.nextLabel}
      nextDisabled={saving || opts?.nextDisabled}
      errorMessage={error}
    >
      {children}
    </WizardChrome>
  );

  if (loading) {
    return chrome(
      <View style={styles.center}>
        <Text style={styles.lead}>Loading media…</Text>
      </View>,
      { hideNext: true },
    );
  }

  if (!asset) {
    return chrome(
      <View style={styles.center}>
        <Text style={styles.lead}>{error ?? 'Missing media.'}</Text>
        <Pressable style={styles.ghostBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.ghostText}>Go back</Text>
        </Pressable>
      </View>,
      { hideNext: true },
    );
  }

  if (step === 1) {
    return chrome(
      <>
        <Text style={styles.lead}>Update the video and thumbnail shown in the media library.</Text>
        <Text style={styles.label}>Thumbnail</Text>
        {currentThumb ? <Image source={{ uri: currentThumb }} style={styles.thumb} /> : null}
        <Text style={styles.linkBtn} onPress={() => void pickThumb()}>
          {newThumb ? 'Change thumbnail' : '+ Set thumbnail'}
        </Text>
        {newThumb ? <Text style={styles.fileRow}>{newThumb.name}</Text> : null}
        <View style={styles.divider} />
        <Text style={styles.label}>Video</Text>
        <Text style={styles.fileRow}>
          Current: {asset.public_url?.trim() ? 'Uploaded video' : 'Missing video URL'}
        </Text>
        <Text style={styles.linkBtn} onPress={() => void pickVideo()}>
          {newVideo ? 'Change video' : '+ Replace video (optional)'}
        </Text>
        {newVideo ? <Text style={styles.fileRow}>{newVideo.name}</Text> : null}
      </>,
      { nextDisabled: !currentThumb },
    );
  }

  if (step === 2) {
    return chrome(
      <>
        <Text style={styles.lead}>Update title, description and category.</Text>
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
            <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, category === c && styles.chipOn]}>
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
          Optional: group this video in a series (multi-part content). Featured series appears at the top of Media.
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
          {currentThumb ? <Image source={{ uri: currentThumb }} style={styles.previewImg} /> : null}
          <View style={styles.previewBody}>
            <View style={styles.previewBadgeRow}>
              <View style={styles.previewBadgePill}>
                <Text style={styles.previewBadgeText}>{category}</Text>
              </View>
              {selectedTags.length ? <Text style={styles.previewMeta}>{tagsLine}</Text> : null}
            </View>
            <Text style={styles.previewTitle}>{title.trim()}</Text>
            <Text style={styles.previewDesc} numberOfLines={5}>
              {pitch.trim()}
            </Text>
            <Text style={styles.previewMeta}>
              {newVideo ? 'Video will be replaced' : 'Video kept'} • {newThumb ? 'Thumbnail updated' : 'Thumbnail kept'}
            </Text>
          </View>
        </View>
        <Pressable
          style={styles.cancelRow}
          onPress={() => {
            Alert.alert('Cancel editing?', 'Discard all changes?', [
              { text: 'Keep editing', style: 'cancel' },
              { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
            ]);
          }}
        >
          <FontAwesome name="times" size={14} color={DS.color.textMuted} />
          <Text style={styles.cancelText}> Cancel</Text>
        </Pressable>
      </>,
      {
        nextLabel: saving ? 'Saving…' : 'Save changes',
        onNext: () => void save(),
        nextDisabled: !dirty,
      },
    );
  }

  return chrome(
    <View style={styles.center}>
      <FontAwesome name="check-circle" size={48} color={DS.color.gold} />
      <Text style={styles.confirmTitle}>Saved</Text>
    </View>,
    { hideNext: true },
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: DS.space.xl },
  lead: { color: DS.color.textMuted, fontFamily: DS.font.body, fontSize: 14, lineHeight: 20 },
  label: { marginTop: DS.space.lg, color: DS.color.text, fontFamily: DS.font.bodyBold, fontSize: 13 },
  input: {
    marginTop: DS.space.sm,
    backgroundColor: DS.color.surface,
    borderRadius: DS.radius.md,
    paddingHorizontal: DS.space.md,
    paddingVertical: DS.space.md,
    color: DS.color.text,
    fontFamily: DS.font.body,
  },
  multi: { minHeight: 120, textAlignVertical: 'top' },
  linkBtn: { marginTop: DS.space.sm, color: DS.color.gold, fontFamily: DS.font.bodyBold },
  fileRow: { marginTop: DS.space.xs, color: DS.color.textMuted, fontFamily: DS.font.body, fontSize: 12 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: DS.space.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: DS.space.sm, gap: DS.space.sm },
  chip: {
    paddingHorizontal: DS.space.md,
    paddingVertical: DS.space.sm,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chipOn: { backgroundColor: 'rgba(197, 168, 106, 0.18)', borderColor: 'rgba(197, 168, 106, 0.35)' },
  chipText: { color: DS.color.textMuted, fontFamily: DS.font.bodyBold, fontSize: 12 },
  chipTextOn: { color: DS.color.gold },
  tagPreview: { marginTop: DS.space.md, color: DS.color.textMuted, fontFamily: DS.font.body },
  thumb: { width: '100%', height: 180, borderRadius: DS.radius.lg, marginTop: DS.space.sm },
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
  previewBadgePill: { backgroundColor: 'rgba(197, 168, 106, 0.18)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  previewBadgeText: { color: DS.color.gold, fontFamily: DS.font.bodyBold, fontSize: 12 },
  previewTitle: { color: DS.color.text, fontFamily: DS.font.display, fontSize: 18, marginTop: DS.space.xs },
  previewDesc: { color: DS.color.textMuted, fontFamily: DS.font.body, marginTop: DS.space.sm, lineHeight: 20 },
  previewMeta: { color: DS.color.textMuted, fontFamily: DS.font.body, fontSize: 12, marginTop: DS.space.sm, flex: 1 },
  cancelRow: { marginTop: DS.space.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: DS.color.textMuted, fontFamily: DS.font.bodyBold },
  confirmTitle: { marginTop: DS.space.md, color: DS.color.text, fontFamily: DS.font.display, fontSize: 18 },
  ghostBtn: {
    marginTop: DS.space.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: DS.space.lg,
    paddingVertical: DS.space.sm,
    borderRadius: DS.radius.md,
  },
  ghostText: { color: DS.color.text, fontFamily: DS.font.bodyBold },
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

