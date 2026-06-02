import { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
import { pickLocalImage, pickLocalVideo } from '../lib/pickLocalMedia';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FontAwesome } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { FormField } from '../components/ui/FormField';
import { DS } from '../designSystem';
import { useWizardBack } from '../hooks/useWizardBack';
import { buildEventDetailsPayload } from '../lib/eventDescriptionParse';
import { endsAtAfterDuration } from '../lib/eventFormParse';
import {
  combineDateAndTime,
  isScheduleAtLeast48HoursAhead,
  minScheduleStartDate,
  schedule48HourError,
} from '../lib/scheduleValidation';
import { getSupabase } from '../lib/supabase';
import { readLocalFileAsArrayBuffer } from '../lib/readLocalFileBytes';
import { pickWebMediaFile } from '../lib/webFilePicker';
import type { EventsStackParamList } from '../navigation/types';
import { insertCommunityEvent } from '../roadmap/liveDataService';
import { WizardChrome } from './proposals/WizardChrome';
import { WebScheduleField } from '../components/WebScheduleField';
import {
  formatEntryPaymentNotice,
  type EntryPaymentMode,
} from '../lib/eventEntryPayment';

type Props = Pick<NativeStackScreenProps<EventsStackParamList, 'CreateEvent'>, 'navigation'>;

type ConfirmPayload = {
  title: string;
  venue: string;
  scheduleLine: string;
  agenda: { title: string; time: string }[];
};

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
    const body = await readLocalFileAsArrayBuffer(uri);
    if (body.byteLength === 0) return null;
    const ext = inferImageExt(uri);
    const contentType = inferImageContentType(uri);
    const rand = Math.random().toString(36).slice(2, 8);
    const storage_path = `events/${userId}/hero-${Date.now()}-${rand}.${ext}`;
    const { error } = await supabase.storage
      .from('media_assets')
      .upload(storage_path, body, { contentType, upsert: false });
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
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function CreateEventWizard({ navigation }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

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
  const [confirm, setConfirm] = useState<ConfirmPayload | null>(null);

  const finishAfterPublish = useCallback(
    (payload: ConfirmPayload) => {
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'UpcomingEvents',
            params: {
              initialFilter: 'my_events',
              createdEventTitle: payload.title,
            },
          },
        ],
      });
    },
    [navigation],
  );
  const goBack = useWizardBack(step, setStep, () => navigation.goBack());

  const minSelectableDate = useMemo(() => minScheduleStartDate(), []);

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
    const picked = await pickLocalImage({ multiple: true, title: 'Event images' });
    if (!picked.length) return;
    setAssets((prev) => [
      ...prev,
      ...picked.map((f) => ({ uri: f.uri, kind: 'image' as const })),
    ]);
  }, []);

  const pickVideos = useCallback(async () => {
    if (Platform.OS === 'web') {
      const picked = await pickWebMediaFile('video');
      if (picked?.uri) setAssets((prev) => [...prev, { uri: picked.uri, kind: 'video' }]);
      return;
    }
    const picked = await pickLocalVideo({ title: 'Event video' });
    const file = picked[0];
    if (!file) return;
    setAssets((prev) => [...prev, { uri: file.uri, kind: 'video' }]);
  }, []);

  const removeAsset = useCallback((uri: string) => {
    setAssets((prev) => prev.filter((x) => x.uri !== uri));
  }, []);

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
        items.push({
          title: i === 0 ? 'Welcome' : `Block ${i + 1}`,
          time: formatTime(t),
        });
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
        if (description.trim().length < DESC_MIN) {
          return `Description must be at least ${DESC_MIN} characters.`;
        }
      }
      if (s === 3) {
        if (!venue.trim()) return 'Venue or location is required.';
        const cap = parseInt(maxAttendance.replace(/\D/g, ''), 10);
        if (!maxAttendance.trim() || Number.isNaN(cap) || cap < 1) {
          return 'Enter expected attendance (minimum 1).';
        }
        const start = combineDateAndTime(eventDate, eventTime);
        if (!isScheduleAtLeast48HoursAhead(start)) return schedule48HourError();
        if (entryPaymentMode === 'payment_on_arrival' && !entryPaymentAmount.trim()) {
          return 'Enter the payment amount for arrival (e.g. £15).';
        }
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
    [eventTitle, description, venue, maxAttendance, eventDate, eventTime, entryPaymentMode, entryPaymentAmount, entryPaymentNote, agenda],
  );

  const nextStep = () => {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    if (step < 5) setStep(step + 1);
    else if (step === 5) void publish();
  };

  const publish = useCallback(() => {
    if (publishing || !user?.id || user.id.startsWith('demo-')) return;
    const completeAgenda = agenda.filter((row) => row.title.trim() && row.time.trim());
    const starts = combineDateAndTime(eventDate, eventTime).toISOString();
    const ends = endsAtAfterDuration(starts, duration);
    const cap = parseInt(maxAttendance.replace(/\D/g, ''), 10);
    const firstImage = sortedAssets.find((a) => a.kind === 'image');
    const scheduleLine = `${formatDate(eventDate)} · ${formatTime(eventTime)}${duration.trim() ? ` · ${duration}` : ''}`;
    const eventDetails = buildEventDetailsPayload({
      level,
      capacity: cap,
      tags: eventTags.trim() || '—',
      bring: bring.trim() || '—',
      duration: duration.trim(),
      agenda: completeAgenda.map((row) => ({
        time: row.time.trim(),
        title: row.title.trim(),
      })),
      faqs: faqs
        .filter((f) => f.q.trim() && f.a.trim())
        .map((f) => ({ q: f.q.trim(), a: f.a.trim() })),
    });
    const confirmPayload: ConfirmPayload = {
      title: eventTitle.trim(),
      venue: venue.trim(),
      scheduleLine,
      agenda: completeAgenda,
    };

    setPublishing(true);
    void (async () => {
      let hero: string | null = null;
      if (firstImage?.uri) {
        hero = /^https?:\/\//i.test(firstImage.uri)
          ? firstImage.uri
          : await uploadEventHero(user.id, firstImage.uri);
      }
      const row = await insertCommunityEvent({
        title: eventTitle.trim(),
        description: description.trim(),
        event_details: eventDetails,
        starts_at: starts,
        ends_at: ends,
        venue: venue.trim(),
        hero_image_url: hero,
        requires_payment: false,
        stripe_price_id: null,
        created_by: user.id,
        entry_payment_mode: entryPaymentMode,
        entry_payment_amount:
          entryPaymentMode === 'payment_on_arrival' ? entryPaymentAmount.trim() : null,
        entry_payment_note:
          entryPaymentMode === 'internal_costs' ? entryPaymentNote.trim() : null,
      });
      setPublishing(false);
      if (!row) {
        setError('Could not publish. Check your connection and permissions.');
        return;
      }
      setConfirm(confirmPayload);
      setStep(6);
    })();
  }, [
    publishing,
    user?.id,
    agenda,
    eventDate,
    eventTime,
    venue,
    maxAttendance,
    duration,
    description,
    level,
    eventTags,
    faqs,
    bring,
    sortedAssets,
    eventTitle,
    entryPaymentMode,
    entryPaymentAmount,
    entryPaymentNote,
  ]);

  useEffect(() => {
    if (step !== 6 || !confirm) return;
    const timer = setTimeout(() => finishAfterPublish(confirm), 2800);
    return () => clearTimeout(timer);
  }, [step, confirm, finishAfterPublish]);

  const chrome = (children: import('react').ReactNode, nextLabel?: string, hideNext?: boolean) => (
    <WizardChrome
      title="Create event"
      step={step}
      totalSteps={TOTAL_STEPS}
      onBack={step === 6 ? () => confirm && finishAfterPublish(confirm) : goBack}
      onNext={hideNext ? undefined : nextStep}
      nextLabel={nextLabel ?? (step === 5 ? (publishing ? 'Publishing…' : 'Publish event') : 'Continue')}
      nextDisabled={publishing}
      errorMessage={error}
    >
      {children}
    </WizardChrome>
  );

  if (step === 1) {
    return chrome(
      <>
        <Text style={s.lead}>Cover image first, then optional video.</Text>
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
              <Pressable
                key={lv}
                onPress={() => setLevel(lv)}
                style={[s.chip, level === lv && s.chipOn]}
              >
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
              <Pressable
                key={key}
                onPress={() => setEntryPaymentMode(key)}
                style={[s.chip, entryPaymentMode === key && s.chipOn]}
              >
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
            <Pressable
              key={key}
              onPress={() => applyAgendaSplit(key)}
              style={[s.chip, agendaSplit === key && s.chipOn]}
            >
              <Text style={[s.chipTxt, agendaSplit === key && s.chipTxtOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.sectionLabel}>Agenda *</Text>
        {agenda.map((row, i) => (
          <View key={i} style={s.agendaRow}>
            <TextInput
              value={row.time}
              onChangeText={(t) =>
                setAgenda((rows) => rows.map((r, j) => (j === i ? { ...r, time: t } : r)))
              }
              placeholder="10:00 AM"
              placeholderTextColor={DS.color.textMuted}
              style={[s.input, s.agendaTime]}
            />
            <TextInput
              value={row.title}
              onChangeText={(t) =>
                setAgenda((rows) => rows.map((r, j) => (j === i ? { ...r, title: t } : r)))
              }
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
              onChangeText={(t) =>
                setFaqs((rows) => rows.map((r, j) => (j === i ? { ...r, q: t } : r)))
              }
              placeholder="Question"
              placeholderTextColor={DS.color.textMuted}
              style={s.input}
            />
            <TextInput
              value={f.a}
              onChangeText={(t) =>
                setFaqs((rows) => rows.map((r, j) => (j === i ? { ...r, a: t } : r)))
              }
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

  if (step === 5) {
    const completeAgenda = agenda.filter((row) => row.title.trim() && row.time.trim());
    return chrome(
      <>
        <Text style={s.lead}>Review before publishing.</Text>
        <Text style={s.reviewLabel}>Title</Text>
        <Text style={s.reviewVal}>{eventTitle.trim() || '—'}</Text>
        <Text style={s.reviewLabel}>Schedule</Text>
        <Text style={s.reviewVal}>
          {formatDate(eventDate)} · {formatTime(eventTime)}
          {duration.trim() ? ` · ${duration}` : ''}
        </Text>
        <Text style={s.reviewLabel}>Description</Text>
        <Text style={s.reviewVal}>{description.trim() || '—'}</Text>
        <Text style={s.reviewLabel}>Venue</Text>
        <Text style={s.reviewVal}>{venue.trim() || '—'}</Text>
        <Text style={s.reviewLabel}>Attendance</Text>
        <Text style={s.reviewVal}>{maxAttendance || '—'}</Text>
        <Text style={s.reviewLabel}>Entry payment</Text>
        <Text style={s.reviewVal}>
          {formatEntryPaymentNotice(entryPaymentMode, entryPaymentAmount, entryPaymentNote) ?? 'No notice'}
        </Text>
        <Text style={s.reviewLabel}>Level</Text>
        <Text style={s.reviewVal}>{level}</Text>
        <Text style={s.reviewLabel}>Media</Text>
        <Text style={s.reviewVal}>{sortedAssets.length} file(s)</Text>
        <Text style={s.reviewLabel}>Agenda</Text>
        {completeAgenda.length > 0 ? (
          completeAgenda.map((row, i) => (
            <Text key={i} style={s.agendaPreview}>
              {row.time.trim()} — {row.title.trim()}
            </Text>
          ))
        ) : (
          <Text style={s.reviewVal}>—</Text>
        )}
      </>,
    );
  }

  if (step === 6 && confirm) {
    return chrome(
      <>
        <View style={s.confirmHero}>
          <FontAwesome name="check-circle" size={48} color={DS.color.gold} />
          <Text style={s.confirmTitle}>Event published</Text>
          <Text style={s.confirmSubtitle}>{confirm.title}</Text>
        </View>
        <Text style={s.reviewLabel}>Schedule</Text>
        <Text style={s.reviewVal}>{confirm.scheduleLine}</Text>
        <Text style={s.reviewLabel}>Venue</Text>
        <Text style={s.reviewVal}>{confirm.venue}</Text>
        <Text style={s.reviewLabel}>Agenda</Text>
        {confirm.agenda.map((row, i) => (
          <Text key={i} style={s.agendaPreview}>
            {row.time.trim()} — {row.title.trim()}
          </Text>
        ))}
        <Text style={s.confirmHint}>Taking you to your events…</Text>
      </>,
      undefined,
      true,
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
  segment: { flexDirection: 'row', gap: DS.space.sm },
  segBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: DS.apple.radiusField,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.apple.separator,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DS.apple.fillTertiary,
  },
  segBtnOn: { borderColor: DS.color.gold, backgroundColor: DS.color.goldTint10 },
  segTxt: { fontFamily: DS.font.bodyMedium, color: DS.color.textMuted },
  segTxtOn: { color: DS.color.gold },
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
  reviewLabel: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 12,
    color: DS.color.textMuted,
    marginTop: DS.space.md,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  reviewVal: { fontFamily: DS.font.body, fontSize: 15, color: DS.color.text },
  agendaPreview: {
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.text,
    marginBottom: 4,
    paddingLeft: DS.space.sm,
  },
  confirmHero: { alignItems: 'center', marginBottom: DS.space.lg, marginTop: DS.space.md },
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
});
