import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useBeforeRemove, useFocusEffect } from '@react-navigation/native';
import { FontAwesome } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { FormField } from '../components/ui/FormField';
import { DS } from '../designSystem';
import { useWizardBack } from '../hooks/useWizardBack';
import { endsAtAfterDuration } from '../lib/eventFormParse';
import {
  combineDateAndTime,
  isScheduleAtLeast48HoursAhead,
  minScheduleStartDate,
  schedule48HourError,
} from '../lib/scheduleValidation';
import { getSupabase } from '../lib/supabase';
import { pickWebMediaFile } from '../lib/webFilePicker';
import type { EventsStackParamList } from '../navigation/types';
import { canCreateVerifiedContent } from '../creator/creatorAccess';
import { getEventById, updateCommunityEvent } from '../roadmap/liveDataService';
import { WizardChrome } from './proposals/WizardChrome';
import { WebScheduleField } from '../components/WebScheduleField';
import {
  entryPaymentBlockForDescription,
  formatEntryPaymentNotice,
  type EntryPaymentMode,
} from '../lib/eventEntryPayment';

type Props = NativeStackScreenProps<EventsStackParamList, 'EditEvent'>;

type AssetItem = { uri: string; kind: 'image' | 'video' };
const LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Elite', 'All levels'] as const;
type AgendaSplit = '15' | '30' | '60' | 'custom';
const DESC_MIN = 100;
const TOTAL_STEPS = 6;

function inferImageContentType(uri: string): string {
  const u = uri.toLowerCase().split('?')[0] ?? '';
  if (u.endsWith('.png')) return 'image/png';
  if (u.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

function inferImageExt(uri: string): string {
  const u = uri.toLowerCase().split('?')[0] ?? '';
  const dot = u.lastIndexOf('.');
  const ext = dot !== -1 ? u.slice(dot + 1) : '';
  if (ext && ext.length <= 5 && /^[a-z0-9]+$/.test(ext)) return ext;
  return 'jpg';
}

async function uploadEventHero(userId: string, uri: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const blob = await (await fetch(uri)).blob();
    const ext = inferImageExt(uri);
    const contentType = inferImageContentType(uri);
    const rand = Math.random().toString(36).slice(2, 8);
    const storage_path = `events/${userId}/hero-${Date.now()}-${rand}.${ext}`;
    const { error } = await supabase.storage.from('media_assets').upload(storage_path, blob, {
      contentType,
      upsert: false,
    });
    if (error) return null;
    const pub = supabase.storage.from('media_assets').getPublicUrl(storage_path);
    return pub.data.publicUrl ?? null;
  } catch {
    return null;
  }
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function parseEventDescription(desc: string) {
  const pick = (label: string) => {
    const m = desc.match(new RegExp(`^${label}\\s*:\\s*(.+)$`, 'mi'));
    return m?.[1]?.trim() ?? '';
  };
  const level = pick('Level');
  const cap = pick('Capacity');
  const tags = pick('Tags');
  const bring = pick('What to bring');
  const duration = pick('Duration');

  const agendaBlock = (() => {
    const m = desc.match(/(?:^|\n)Agenda:\s*\n([\s\S]*?)(?:\n\s*\n|$)/i);
    return (m?.[1] ?? '').trim();
  })();
  const agenda = agendaBlock
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('• '))
    .map((l) => l.replace(/^•\s+/, ''))
    .map((l) => {
      const mm = l.match(/^(.+?)\s+—\s+(.+)$/);
      return { time: (mm?.[1] ?? '').trim(), title: (mm?.[2] ?? '').trim() };
    })
    .filter((r) => r.time && r.title);

  const faqBlock = (() => {
    const m = desc.match(/(?:^|\n)FAQs:\s*\n([\s\S]*?)(?:\n\s*\n|$)/i);
    return (m?.[1] ?? '').trim();
  })();
  const faqs: { q: string; a: string }[] = [];
  if (faqBlock) {
    const lines = faqBlock.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const q = (lines[i] ?? '').trim();
      const a = (lines[i + 1] ?? '').trim();
      if (q.startsWith('Q:') && a.startsWith('A:')) {
        faqs.push({ q: q.replace(/^Q:\s*/, ''), a: a.replace(/^A:\s*/, '') });
        i += 1;
      }
    }
  }

  // "Base description" is everything before the first blank line followed by Level/Agenda/etc.
  const base = desc.split('\n\nLevel:')[0]?.trim() ?? desc.trim();

  return {
    baseDescription: base,
    level,
    cap,
    tags,
    bring,
    duration,
    agenda,
    faqs,
  };
}

export function EditEventWizardScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const eventId = route.params.eventId;
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const allowed = canCreateVerifiedContent(false, user);

  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [eventTitle, setEventTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventTags, setEventTags] = useState('');
  const [entryPaymentMode, setEntryPaymentMode] = useState<EntryPaymentMode>('none');
  const [entryPaymentAmount, setEntryPaymentAmount] = useState('');
  const [entryPaymentNote, setEntryPaymentNote] = useState('');
  const [venue, setVenue] = useState('');
  const [maxAttendance, setMaxAttendance] = useState('');
  const [eventDate, setEventDate] = useState(() => {
    const d = minScheduleStartDate();
    d.setDate(d.getDate() + 1);
    return d;
  });
  const [eventTime, setEventTime] = useState(() => {
    const d = new Date();
    d.setHours(10, 0, 0, 0);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [duration, setDuration] = useState('');
  const [agendaSplit, setAgendaSplit] = useState<AgendaSplit>('30');
  const [level, setLevel] = useState<(typeof LEVELS)[number]>('Intermediate');
  const [agenda, setAgenda] = useState<{ title: string; time: string }[]>([
    { title: '', time: '' },
    { title: '', time: '' },
  ]);
  const [faqs, setFaqs] = useState<{ q: string; a: string }[]>([{ q: '', a: '' }]);
  const [bring, setBring] = useState('');

  const initialSnapshot = useRef<string>('');
  const [explicitExit, setExplicitExit] = useState<'saved' | 'cancelled' | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) navigation.goBack();
    }, [allowed, navigation]),
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void (async () => {
      const ev = await getEventById(eventId);
      if (!alive) return;
      if (!ev) {
        Alert.alert('Not found', 'This event could not be loaded.');
        navigation.goBack();
        return;
      }
      setEventTitle(ev.title ?? '');
      setVenue(ev.venue ?? '');
      const starts = new Date(ev.starts_at);
      if (!Number.isNaN(starts.getTime())) {
        setEventDate(starts);
        setEventTime(starts);
      }
      const parsed = parseEventDescription((ev.description ?? '').trim());
      setDescription(parsed.baseDescription);
      if (parsed.tags) setEventTags(parsed.tags);
      if (parsed.cap) setMaxAttendance(parsed.cap);
      if (parsed.duration) setDuration(parsed.duration);
      if (parsed.level && (LEVELS as readonly string[]).includes(parsed.level)) {
        setLevel(parsed.level as (typeof LEVELS)[number]);
      }
      if (parsed.agenda.length) setAgenda(parsed.agenda);
      if (parsed.faqs.length) setFaqs(parsed.faqs);
      if (parsed.bring) setBring(parsed.bring);
      if (ev.hero_image_url?.trim()) {
        setAssets([{ uri: ev.hero_image_url.trim(), kind: 'image' }]);
      }
      setLoading(false);
      // snapshot for dirty detection
      initialSnapshot.current = JSON.stringify({
        assets: ev.hero_image_url?.trim() ? [ev.hero_image_url.trim()] : [],
        eventTitle: ev.title ?? '',
        description: parsed.baseDescription,
        eventTags: parsed.tags,
        entryPaymentMode,
        entryPaymentAmount,
        entryPaymentNote,
        venue: ev.venue ?? '',
        maxAttendance: parsed.cap,
        starts_at: ev.starts_at,
        duration: parsed.duration,
        agenda: parsed.agenda,
        faqs: parsed.faqs,
        bring: parsed.bring,
        level: parsed.level,
      });
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, navigation]);

  const dirty = useMemo(() => {
    if (!initialSnapshot.current) return false;
    const cur = JSON.stringify({
      assets: assets.map((a) => a.uri),
      eventTitle,
      description,
      eventTags,
      entryPaymentMode,
      entryPaymentAmount,
      entryPaymentNote,
      venue,
      maxAttendance,
      starts_at: combineDateAndTime(eventDate, eventTime).toISOString(),
      duration,
      agenda,
      faqs,
      bring,
      level,
    });
    return cur !== initialSnapshot.current;
  }, [
    agenda,
    assets,
    bring,
    description,
    entryPaymentAmount,
    entryPaymentMode,
    entryPaymentNote,
    eventDate,
    eventTags,
    eventTime,
    eventTitle,
    faqs,
    level,
    maxAttendance,
    duration,
    venue,
  ]);

  useBeforeRemove(
    useCallback(
      (e) => {
        if (explicitExit || !dirty) return;
        e.preventDefault();
        Alert.alert('Discard changes?', 'You must choose Save or Cancel. Discard changes and exit?', [
          { text: 'Stay', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              setExplicitExit('cancelled');
              navigation.dispatch(e.data.action);
            },
          },
        ]);
      },
      [dirty, explicitExit, navigation],
    ),
  );

  const sortedAssets = useMemo(
    () => [...assets].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'image' ? -1 : 1)),
    [assets],
  );

  const pickImages = useCallback(async () => {
    if (Platform.OS === 'web') {
      const picked = await pickWebMediaFile('image');
      if (picked?.uri) setAssets((prev) => [...prev, { uri: picked.uri, kind: 'image' }]);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.9,
    });
    if (res.canceled) return;
    setAssets((prev) => [
      ...prev,
      ...res.assets.filter((a) => a.uri).map((a) => ({ uri: a.uri, kind: 'image' as const })),
    ]);
  }, []);

  const pickVideos = useCallback(async () => {
    if (Platform.OS === 'web') {
      const picked = await pickWebMediaFile('video');
      if (picked?.uri) setAssets((prev) => [...prev, { uri: picked.uri, kind: 'video' }]);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
    if (res.canceled || !res.assets[0]?.uri) return;
    setAssets((prev) => [...prev, { uri: res.assets[0].uri, kind: 'video' }]);
  }, []);

  const removeAsset = useCallback((uri: string) => {
    setAssets((prev) => prev.filter((x) => x.uri !== uri));
  }, []);

  const minSelectableDate = useMemo(() => minScheduleStartDate(), []);
  const goBack = useWizardBack(step, setStep, () => navigation.goBack());

  const onPickerChange = useCallback(
    (kind: 'date' | 'time', e: DateTimePickerEvent, selected?: Date) => {
      if (Platform.OS === 'android') {
        setShowDatePicker(false);
        setShowTimePicker(false);
      }
      if (e.type === 'dismissed' || !selected) return;
      if (kind === 'date') setEventDate(selected);
      else setEventTime(selected);
    },
    [],
  );

  const applyAgendaSplit = useCallback(
    (split: AgendaSplit) => {
      setAgendaSplit(split);
      if (split === 'custom') return;
      const mins = split === '15' ? 15 : split === '30' ? 30 : 60;
      const base = new Date(eventTime);
      const items: { title: string; time: string }[] = [];
      for (let i = 0; i < 4; i++) {
        const t = new Date(base.getTime() + i * mins * 60_000);
        items.push({ title: i === 0 ? 'Welcome' : `Block ${i + 1}`, time: formatTime(t) });
      }
      setAgenda(items);
    },
    [eventTime],
  );

  const validateStep = useCallback(
    (s: number): string | null => {
      if (s === 1) {
        if (!eventTitle.trim()) return 'Event title is required.';
      }
      if (s === 2) {
        if (description.trim().length < DESC_MIN) return `Description must be at least ${DESC_MIN} characters.`;
      }
      if (s === 3) {
        if (!venue.trim()) return 'Venue or location is required.';
        const cap = parseInt(maxAttendance.replace(/\D/g, ''), 10);
        if (!maxAttendance.trim() || Number.isNaN(cap) || cap < 1) return 'Enter expected attendance (minimum 1).';
        const start = combineDateAndTime(eventDate, eventTime);
        if (!isScheduleAtLeast48HoursAhead(start)) return schedule48HourError();
      }
      if (s === 4) {
        const completeAgenda = agenda.filter((row) => row.title.trim() && row.time.trim());
        const partialAgenda = agenda.some(
          (row) => (row.title.trim() || row.time.trim()) && !(row.title.trim() && row.time.trim()),
        );
        if (completeAgenda.length === 0) return 'Add at least one agenda item with title and time.';
        if (partialAgenda) return 'Finish incomplete agenda rows or clear them.';
      }
      return null;
    },
    [agenda, description, eventDate, eventTime, eventTitle, maxAttendance, venue],
  );

  const nextStep = () => {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    if (step < 5) setStep(step + 1);
    else if (step === 5) void save();
  };

  const save = useCallback(async () => {
    if (publishing || !user?.id || user.id.startsWith('demo-')) return;
    setPublishing(true);
    setError(null);

    const completeAgenda = agenda.filter((row) => row.title.trim() && row.time.trim());
    const starts = combineDateAndTime(eventDate, eventTime).toISOString();
    const ends = endsAtAfterDuration(starts, duration);
    const cap = parseInt(maxAttendance.replace(/\D/g, ''), 10);
    const firstImage = sortedAssets.find((a) => a.kind === 'image');

    const faqLines = faqs
      .filter((f) => f.q.trim() && f.a.trim())
      .map((f) => `Q: ${f.q.trim()}\nA: ${f.a.trim()}`);
    const agendaBlock = completeAgenda.map((row) => `• ${row.time.trim()} — ${row.title.trim()}`).join('\n');
    const descParts: string[] = [
      description.trim(),
      '',
      `Level: ${level}`,
      `Capacity: ${cap}`,
      `Tags: ${eventTags.trim() || '—'}`,
      duration.trim() ? `Duration: ${duration.trim()}` : '',
      '',
      'Agenda:',
      agendaBlock,
    ].filter(Boolean);
    if (faqLines.length > 0) descParts.push('', 'FAQs:', ...faqLines);
    descParts.push('', `What to bring: ${bring.trim() || '—'}`);
    descParts.push(entryPaymentBlockForDescription(entryPaymentMode, entryPaymentAmount, entryPaymentNote));
    const longDesc = descParts.join('\n').trim();

    let hero: string | null = null;
    if (firstImage?.uri) {
      hero = /^https?:\/\//i.test(firstImage.uri) ? firstImage.uri : await uploadEventHero(user.id, firstImage.uri);
    }

    const updated = await updateCommunityEvent(eventId, {
      title: eventTitle.trim(),
      description: longDesc,
      starts_at: starts,
      ends_at: ends,
      venue: venue.trim() || null,
      hero_image_url: hero,
      entry_payment_mode: entryPaymentMode,
      entry_payment_amount: entryPaymentMode === 'payment_on_arrival' ? entryPaymentAmount.trim() : null,
      entry_payment_note: entryPaymentMode === 'internal_costs' ? entryPaymentNote.trim() : null,
    });
    setPublishing(false);
    if (!updated) {
      setError('Could not save. Check your connection and permissions.');
      return;
    }
    setExplicitExit('saved');
    navigation.replace('EventDetails', { supabaseEventId: eventId });
  }, [
    agenda,
    bring,
    description,
    duration,
    entryPaymentAmount,
    entryPaymentMode,
    entryPaymentNote,
    eventDate,
    eventId,
    eventTags,
    eventTime,
    eventTitle,
    faqs,
    level,
    maxAttendance,
    navigation,
    publishing,
    sortedAssets,
    user?.id,
    venue,
  ]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: DS.color.background, padding: DS.space.lg }}>
        <Text style={{ color: DS.color.textMuted }}>Loading…</Text>
      </View>
    );
  }

  const chrome = (children: React.ReactNode, nextLabel?: string, hideNext?: boolean) => (
    <WizardChrome
      title="Edit event"
      step={step}
      totalSteps={TOTAL_STEPS}
      onBack={goBack}
      onNext={hideNext ? undefined : nextStep}
      nextLabel={nextLabel ?? (step === 5 ? (publishing ? 'Saving…' : 'Save changes') : 'Continue')}
      nextDisabled={publishing}
      errorMessage={error}
    >
      {children}
    </WizardChrome>
  );

  if (step === 1) {
    return chrome(
      <>
        <Text style={s.lead}>Update cover image, then adjust the event title.</Text>
        <View style={s.assetActions}>
          <Pressable style={s.pickBtn} onPress={() => void pickImages()}>
            <FontAwesome name="image" size={14} color={DS.color.gold} />
            <Text style={s.pickTxt}> Add images</Text>
          </Pressable>
          <Pressable style={s.pickBtn} onPress={() => void pickVideos()}>
            <FontAwesome name="video-camera" size={14} color={DS.color.gold} />
            <Text style={s.pickTxt}> Add video</Text>
          </Pressable>
        </View>
        {sortedAssets.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: DS.space.md }}>
            {sortedAssets.map((a) => (
              <View key={a.uri} style={s.thumbWrap}>
                {a.kind === 'image' ? (
                  <Image source={{ uri: a.uri }} style={s.thumb} />
                ) : (
                  <View style={[s.thumb, s.thumbVid]}>
                    <FontAwesome name="video-camera" size={20} color={DS.color.gold} />
                  </View>
                )}
                <Pressable style={s.thumbRemove} onPress={() => removeAsset(a.uri)}>
                  <FontAwesome name="times" size={10} color={DS.color.background} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}
        <FormField label="Event title" required>
          <TextInput
            value={eventTitle}
            onChangeText={setEventTitle}
            placeholder="Strength camp — spring session"
            placeholderTextColor={DS.color.textMuted}
            style={s.input}
          />
        </FormField>
      </>,
    );
  }

  if (step === 2) {
    return chrome(
      <>
        <Text style={s.lead}>Describe the session and who it is for.</Text>
        <FormField
          label="Description"
          required
          hint={`Minimum ${DESC_MIN} characters (${description.trim().length}/${DESC_MIN})`}
        >
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Format, safety, cancellation policy…"
            placeholderTextColor={DS.color.textMuted}
            style={[s.input, s.inputMulti]}
            multiline
            textAlignVertical="top"
          />
        </FormField>
        <FormField label="Event tags" hint="Optional — comma-separated.">
          <TextInput
            value={eventTags}
            onChangeText={setEventTags}
            placeholder="strength, conditioning"
            placeholderTextColor={DS.color.textMuted}
            style={s.input}
          />
        </FormField>
        <FormField label="Level" required>
          <View style={s.chipWrap}>
            {LEVELS.map((lv) => (
              <Pressable key={lv} onPress={() => setLevel(lv)} style={[s.chip, level === lv && s.chipOn]}>
                <Text style={[s.chipTxt, level === lv && s.chipTxtOn]}>{lv}</Text>
              </Pressable>
            ))}
          </View>
        </FormField>
      </>,
    );
  }

  if (step === 3) {
    return chrome(
      <>
        <Text style={s.lead}>When and where does your event run?</Text>
        {Platform.OS === 'web' ? (
          <>
            <WebScheduleField
              mode="date"
              value={eventDate}
              minimumDate={minSelectableDate}
              onChange={setEventDate}
              label="Date *"
              formatDisplay={formatDate}
            />
            <WebScheduleField
              mode="time"
              value={eventTime}
              onChange={setEventTime}
              label="Time *"
              formatDisplay={formatTime}
            />
          </>
        ) : (
          <>
            <FormField label="Date" required>
              <Pressable style={s.pickerBtn} onPress={() => setShowDatePicker(true)}>
                <FontAwesome name="calendar" size={16} color={DS.color.gold} />
                <Text style={s.pickerBtnText}>{formatDate(eventDate)}</Text>
              </Pressable>
              {showDatePicker ? (
                <DateTimePicker
                  value={eventDate}
                  mode="date"
                  minimumDate={minSelectableDate}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e, d) => onPickerChange('date', e, d)}
                />
              ) : null}
            </FormField>
            <FormField label="Time" required>
              <Pressable style={s.pickerBtn} onPress={() => setShowTimePicker(true)}>
                <FontAwesome name="clock-o" size={16} color={DS.color.gold} />
                <Text style={s.pickerBtnText}>{formatTime(eventTime)}</Text>
              </Pressable>
              {showTimePicker ? (
                <DateTimePicker
                  value={eventTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e, d) => onPickerChange('time', e, d)}
                />
              ) : null}
            </FormField>
          </>
        )}
        <FormField label="Venue / location" required>
          <TextInput
            value={venue}
            onChangeText={setVenue}
            placeholder="City, facility, or online link"
            placeholderTextColor={DS.color.textMuted}
            style={s.input}
          />
        </FormField>
        <FormField label="Expected attendance" required>
          <TextInput
            value={maxAttendance}
            onChangeText={setMaxAttendance}
            keyboardType="number-pad"
            placeholder="e.g. 50"
            placeholderTextColor={DS.color.textMuted}
            style={s.input}
          />
        </FormField>
        <FormField label="Duration" hint="Optional — e.g. 2 hours">
          <TextInput
            value={duration}
            onChangeText={setDuration}
            placeholder="2 hours"
            placeholderTextColor={DS.color.textMuted}
            style={s.input}
          />
        </FormField>
        <FormField label="Entry payment notice" hint="Optional — shown on the event page (no in-app checkout).">
          <View style={s.chipWrap}>
            {(
              [
                ['none', 'No notice'],
                ['payment_on_arrival', 'Payment on arrival'],
                ['internal_costs', 'Free + internal costs'],
              ] as const
            ).map(([key, label]) => (
              <Pressable key={key} onPress={() => setEntryPaymentMode(key)} style={[s.chip, entryPaymentMode === key && s.chipOn]}>
                <Text style={[s.chipTxt, entryPaymentMode === key && s.chipTxtOn]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          {entryPaymentMode === 'payment_on_arrival' ? (
            <TextInput
              value={entryPaymentAmount}
              onChangeText={setEntryPaymentAmount}
              placeholder="e.g. £15"
              placeholderTextColor={DS.color.textMuted}
              style={[s.input, { marginTop: DS.space.md }]}
            />
          ) : null}
          {entryPaymentMode === 'internal_costs' ? (
            <TextInput
              value={entryPaymentNote}
              onChangeText={setEntryPaymentNote}
              placeholder="e.g. facility hire split, equipment hire"
              placeholderTextColor={DS.color.textMuted}
              style={[s.input, s.inputMulti, { marginTop: DS.space.md, minHeight: 72 }]}
              multiline
            />
          ) : null}
        </FormField>
      </>,
    );
  }

  if (step === 4) {
    return chrome(
      <>
        <Text style={s.lead}>Agenda, FAQs, and what attendees should bring.</Text>
        <Text style={s.sectionLabel}>Agenda spacing</Text>
        <View style={s.chipWrap}>
          {(
            [
              ['15', '15 min'],
              ['30', '30 min'],
              ['60', '1 hour'],
              ['custom', 'Custom'],
            ] as const
          ).map(([key, label]) => (
            <Pressable key={key} onPress={() => applyAgendaSplit(key)} style={[s.chip, agendaSplit === key && s.chipOn]}>
              <Text style={[s.chipTxt, agendaSplit === key && s.chipTxtOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.sectionLabel}>Agenda *</Text>
        {agenda.map((row, i) => (
          <View key={i} style={s.agendaRow}>
            <TextInput
              value={row.time}
              onChangeText={(t) => setAgenda((rows) => rows.map((r, j) => (j === i ? { ...r, time: t } : r)))}
              placeholder="10:00 AM"
              placeholderTextColor={DS.color.textMuted}
              style={[s.input, s.agendaTime]}
            />
            <TextInput
              value={row.title}
              onChangeText={(t) => setAgenda((rows) => rows.map((r, j) => (j === i ? { ...r, title: t } : r)))}
              placeholder="Session title"
              placeholderTextColor={DS.color.textMuted}
              style={[s.input, s.agendaTitle]}
            />
          </View>
        ))}
        <Pressable onPress={() => setAgenda((r) => [...r, { title: '', time: '' }])} style={s.ghostBtn}>
          <Text style={s.ghostTxt}>+ Add agenda row</Text>
        </Pressable>
        <Text style={[s.sectionLabel, { marginTop: DS.space.lg }]}>FAQs (optional)</Text>
        {faqs.map((f, i) => (
          <View key={i} style={{ marginBottom: DS.space.sm }}>
            <TextInput
              value={f.q}
              onChangeText={(t) => setFaqs((rows) => rows.map((r, j) => (j === i ? { ...r, q: t } : r)))}
              placeholder="Question"
              placeholderTextColor={DS.color.textMuted}
              style={s.input}
            />
            <TextInput
              value={f.a}
              onChangeText={(t) => setFaqs((rows) => rows.map((r, j) => (j === i ? { ...r, a: t } : r)))}
              placeholder="Answer"
              placeholderTextColor={DS.color.textMuted}
              style={[s.input, s.inputMulti, { minHeight: 72, marginTop: DS.space.sm }]}
              multiline
            />
          </View>
        ))}
        <Pressable onPress={() => setFaqs((r) => [...r, { q: '', a: '' }])} style={s.ghostBtn}>
          <Text style={s.ghostTxt}>+ Add FAQ</Text>
        </Pressable>
        <FormField label="What to bring" hint="Optional">
          <TextInput
            value={bring}
            onChangeText={setBring}
            placeholder="Water bottle, towel"
            placeholderTextColor={DS.color.textMuted}
            style={[s.input, { marginTop: DS.space.md }]}
          />
        </FormField>
      </>,
      'Review',
    );
  }

  // step 5 = preview (public-style comes in a follow-up task)
  if (step === 5) {
    const completeAgenda = agenda.filter((row) => row.title.trim() && row.time.trim());
    const startsLine = `${formatDate(eventDate)} · ${formatTime(eventTime)}${duration.trim() ? ` · ${duration}` : ''}`;
    return chrome(
      <>
        <Text style={s.lead}>Preview before saving changes.</Text>
        <View style={s.previewCard}>
          <Text style={s.previewKicker}>EVENT</Text>
          <Text style={s.previewTitle}>{eventTitle.trim().toUpperCase()}</Text>
          <Text style={s.previewMeta}>{startsLine}</Text>
          <Text style={s.previewMeta}>{venue.trim() || '—'}</Text>
          <Text style={s.previewBody} numberOfLines={6}>
            {description.trim()}
          </Text>
          <View style={{ height: DS.space.md }} />
          {completeAgenda.slice(0, 3).map((row, i) => (
            <Text key={i} style={s.previewMeta}>
              • {row.time.trim()} — {row.title.trim()}
            </Text>
          ))}
          {completeAgenda.length > 3 ? <Text style={s.previewMeta}>…</Text> : null}
          <View style={{ height: DS.space.md }} />
          <Text style={s.previewMeta}>
            {formatEntryPaymentNotice(entryPaymentMode, entryPaymentAmount, entryPaymentNote) ?? 'No payment notice'}
          </Text>
          <Text style={s.previewMeta}>Tags: {eventTags.trim() || '—'}</Text>
        </View>
        <Pressable
          style={s.cancelBtn}
          onPress={() => {
            Alert.alert('Cancel editing?', 'Discard changes and return to the event?', [
              { text: 'Stay', style: 'cancel' },
              {
                text: 'Discard',
                style: 'destructive',
                onPress: () => {
                  setExplicitExit('cancelled');
                  navigation.goBack();
                },
              },
            ]);
          }}
          disabled={publishing}
        >
          <Text style={s.cancelBtnText}>Cancel</Text>
        </Pressable>
      </>,
      publishing ? 'Saving…' : 'Save changes',
    );
  }

  return null;
}

const s = StyleSheet.create({
  lead: {
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.textMuted,
    marginBottom: DS.space.md,
    lineHeight: 20,
  },
  input: {
    backgroundColor: DS.apple.fillSecondary,
    borderRadius: DS.apple.radiusField,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.apple.separator,
    paddingHorizontal: DS.space.base,
    paddingVertical: 14,
    fontFamily: DS.font.body,
    fontSize: 16,
    color: DS.color.text,
  },
  inputMulti: { minHeight: 120, paddingTop: 14 },
  assetActions: { flexDirection: 'row', gap: DS.space.sm, marginBottom: DS.space.md },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: DS.space.md,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    borderColor: DS.color.goldTint30,
  },
  pickTxt: { fontFamily: DS.font.bodyMedium, fontSize: 14, color: DS.color.gold },
  thumbWrap: { marginRight: DS.space.sm, position: 'relative' },
  thumb: { width: 72, height: 72, borderRadius: DS.radius.md },
  thumbVid: {
    backgroundColor: DS.apple.fillTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: DS.color.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: DS.space.sm },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: DS.apple.radiusButton,
    backgroundColor: DS.apple.fillTertiary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.apple.separator,
  },
  chipOn: { borderColor: DS.color.gold, backgroundColor: DS.color.goldTint10 },
  chipTxt: { fontFamily: DS.font.bodyMedium, fontSize: 13, color: DS.color.textMuted },
  chipTxtOn: { color: DS.color.gold },
  sectionLabel: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 13,
    color: DS.color.textMuted,
    marginBottom: DS.space.sm,
  },
  agendaRow: { flexDirection: 'row', gap: DS.space.sm, marginBottom: DS.space.sm },
  agendaTime: { width: 110 },
  agendaTitle: { flex: 1 },
  ghostBtn: { paddingVertical: DS.space.sm, marginBottom: DS.space.md },
  ghostTxt: { fontFamily: DS.font.bodyMedium, fontSize: 14, color: DS.color.gold },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    backgroundColor: DS.apple.fillSecondary,
    borderRadius: DS.apple.radiusField,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.apple.separator,
    paddingHorizontal: DS.space.base,
    paddingVertical: 14,
  },
  pickerBtnText: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 16,
    color: DS.color.text,
  },
  previewCard: {
    backgroundColor: DS.color.surface,
    borderRadius: DS.radius.xl,
    borderWidth: 1,
    borderColor: DS.color.borderWhite5,
    padding: DS.space.lg,
  },
  previewKicker: {
    fontFamily: DS.font.bodyBold,
    fontSize: 11,
    letterSpacing: 3,
    color: DS.color.gold,
    marginBottom: DS.space.sm,
  },
  previewTitle: {
    fontFamily: DS.font.heading,
    fontSize: 24,
    color: DS.color.text,
    letterSpacing: 1,
  },
  previewMeta: { fontFamily: DS.font.body, fontSize: 13, color: DS.color.textMuted, marginTop: 6 },
  previewBody: { fontFamily: DS.font.body, fontSize: 14, color: DS.color.text, marginTop: DS.space.md, lineHeight: 22 },
  cancelBtn: {
    marginTop: DS.space.md,
    paddingVertical: DS.space.md,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    borderColor: DS.color.borderWhite5,
    alignItems: 'center',
  },
  cancelBtnText: { fontFamily: DS.font.bodyBold, color: DS.color.textMuted },
});

