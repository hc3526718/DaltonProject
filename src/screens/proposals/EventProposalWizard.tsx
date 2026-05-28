import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { FontAwesome } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useAuth } from '../../auth/AuthContext';
import { DS } from '../../designSystem';
import { pickWebMediaFile } from '../../lib/webFilePicker';
import { uploadProposalAttachment } from '../../lib/proposalAttachmentUpload';
import {
  runProposalSubmitFlow,
  showProposalSubmittedAlert,
} from '../../lib/proposalSubmitFlow';
import {
  combineDateAndTime,
  isScheduleAtLeast48HoursAhead,
  minScheduleStartDate,
  schedule48HourError,
} from '../../lib/scheduleValidation';
import { proposedDateIsoFromPickers } from '../../lib/masterInstantPublish';
import type { EventsStackParamList } from '../../navigation/types';
import { contentProposalsUsedThisMonth } from '../../roadmap/proposalService';
import { WizardChrome } from './WizardChrome';

type Props = NativeStackScreenProps<EventsStackParamList, 'EventProposalWizard'>;

const LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Elite', 'All levels'] as const;
type AgendaSplit = '15' | '30' | '60' | 'custom';

type MediaAttachment = {
  uri: string;
  kind: 'image' | 'video';
  name: string;
};

type AgendaItem = { title: string; time: string };

const TOTAL_STEPS = 5;

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function EventProposalWizard({ navigation }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [pitch, setPitch] = useState('');
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
  const [venue, setVenue] = useState('');
  const [maxAttendance, setMaxAttendance] = useState('');
  const [level, setLevel] = useState<(typeof LEVELS)[number]>('All levels');
  const [agendaSplit, setAgendaSplit] = useState<AgendaSplit>('60');
  const [agenda, setAgenda] = useState<AgendaItem[]>([
    { title: 'Welcome & briefing', time: '10:00' },
    { title: 'Main session', time: '10:30' },
  ]);
  const [attachments, setAttachments] = useState<MediaAttachment[]>([]);
  const [quotaHint, setQuotaHint] = useState('');

  const minSelectableDate = useMemo(() => minScheduleStartDate(), []);

  useEffect(() => {
    void contentProposalsUsedThisMonth().then((n) => setQuotaHint(`${n}/3 proposals used this month`));
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const validateStep = useCallback(
    (s: number): string | null => {
      if (s === 1) {
        if (!title.trim()) return 'Event title is required.';
        if (pitch.trim().length < 20) return 'Summary must be at least 20 characters.';
      }
      if (s === 2) {
        if (!venue.trim()) return 'Venue or location is required.';
        const cap = parseInt(maxAttendance.replace(/\D/g, ''), 10);
        if (!maxAttendance.trim() || Number.isNaN(cap) || cap < 1) {
          return 'Enter expected attendance (minimum 1).';
        }
        const start = combineDateAndTime(eventDate, eventTime);
        if (!isScheduleAtLeast48HoursAhead(start)) return schedule48HourError();
      }
      if (s === 3) {
        const filled = agenda.filter((a) => a.title.trim() || a.time.trim());
        if (filled.length === 0) return 'Add at least one agenda item.';
        if (filled.some((a) => !a.title.trim() || !a.time.trim())) {
          return 'Each agenda item needs a title and time.';
        }
      }
      return null;
    },
    [title, pitch, venue, agenda, maxAttendance, eventDate, eventTime],
  );

  const goNext = useCallback(
    (target: number) => {
      const err = validateStep(step);
      if (err) {
        setError(err);
        return;
      }
      setError(null);
      setStep(target);
    },
    [step, validateStep],
  );

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

  const pickMedia = useCallback(async (kind: 'image' | 'video') => {
    if (Platform.OS === 'web') {
      const picked = await pickWebMediaFile(kind);
      if (!picked?.uri) return;
      setAttachments((prev) => [
        ...prev,
        { uri: picked.uri, kind, name: picked.name ?? `${kind}-${prev.length + 1}` },
      ]);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to attach media.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: kind === 'image' ? ['images'] : ['videos'],
      allowsMultipleSelection: kind === 'image',
      quality: 0.9,
    });
    if (res.canceled) return;
    setAttachments((prev) => [
      ...prev,
      ...res.assets
        .filter((a) => a.uri)
        .map((a, i) => ({
          uri: a.uri,
          kind,
          name: a.fileName ?? `${kind}-${prev.length + i + 1}`,
        })),
    ]);
  }, []);

  const applyAgendaSplit = useCallback((split: AgendaSplit) => {
    setAgendaSplit(split);
    if (split === 'custom') return;
    const mins = split === '15' ? 15 : split === '30' ? 30 : 60;
    const base = new Date(eventTime);
    const items: AgendaItem[] = [];
    for (let i = 0; i < 4; i++) {
      const t = new Date(base.getTime() + i * mins * 60_000);
      items.push({
        title: i === 0 ? 'Session block' : `Block ${i + 1}`,
        time: formatTime(t),
      });
    }
    setAgenda(items);
  }, [eventTime]);

  const submit = useCallback(async () => {
    if (submitted || submitting) return;
    const err = validateStep(3) ?? validateStep(2) ?? validateStep(1);
    if (err) {
      setError(err);
      return;
    }
    if (!user?.id) return;
    setSubmitting(true);
    setError(null);
    const uploaded: string[] = [];
    for (const a of attachments) {
      const url = await uploadProposalAttachment(user.id, 'event', a.uri, a.name);
      if (url) uploaded.push(url);
    }
    const proposedDate = proposedDateIsoFromPickers(eventDate, eventTime);
    const cap = parseInt(maxAttendance.replace(/\D/g, ''), 10);
    const result = await runProposalSubmitFlow(
      {
        kind: 'event',
        payload: {
          title: title.trim(),
          pitch: pitch.trim(),
          proposed_date: proposedDate,
          venue: venue.trim(),
          level,
          agenda_split: agendaSplit,
          agenda,
          max_attendance: cap,
        },
        attachmentUrls: uploaded,
      },
      { masterControl: user.masterControl === true, userId: user.id },
    );
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSubmitted(true);
    showProposalSubmittedAlert(() => navigation.goBack(), {
      masterPublished: result.publishedLive,
    });
  }, [
    submitted,
    submitting,
    validateStep,
    user?.id,
    attachments,
    eventDate,
    eventTime,
    title,
    pitch,
    venue,
    level,
    agendaSplit,
    agenda,
    maxAttendance,
    user?.masterControl,
    navigation,
  ]);

  if (step === 1) {
    return (
      <WizardChrome
        title="Event proposal"
        step={1}
        totalSteps={TOTAL_STEPS}
        onBack={() => navigation.goBack()}
        onNext={() => goNext(2)}
        errorMessage={error}
      >
        <Text style={styles.lead}>Tell us about the event you want to host on The Dalton Grant Academy.</Text>
        <Text style={styles.quota}>{quotaHint}</Text>
        <Text style={styles.label}>Event title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={(t) => {
            clearError();
            setTitle(t);
          }}
          placeholder="Strength camp — spring session"
          placeholderTextColor={DS.color.textMuted}
        />
        <Text style={styles.label}>Summary</Text>
        <TextInput
          style={[styles.input, styles.multi]}
          value={pitch}
          onChangeText={(t) => {
            clearError();
            setPitch(t);
          }}
          multiline
          textAlignVertical="top"
          placeholder="Who it is for, format, capacity, and why athletes should attend…"
          placeholderTextColor={DS.color.textMuted}
        />
      </WizardChrome>
    );
  }

  if (step === 2) {
    return (
      <WizardChrome
        title="Event proposal"
        step={2}
        totalSteps={TOTAL_STEPS}
        onBack={() => {
          clearError();
          setStep(1);
        }}
        onNext={() => goNext(3)}
        errorMessage={error}
      >
        <Text style={styles.label}>Date</Text>
        <Pressable style={styles.pickerBtn} onPress={() => setShowDatePicker(true)}>
          <FontAwesome name="calendar" size={16} color={DS.color.gold} />
          <Text style={styles.pickerBtnText}>{formatDate(eventDate)}</Text>
        </Pressable>
        {showDatePicker ? (
          <DateTimePicker
            value={eventDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={minSelectableDate}
            onChange={(e, d) => onPickerChange('date', e, d)}
          />
        ) : null}

        <Text style={[styles.label, styles.labelSpaced]}>Start time</Text>
        <Pressable style={styles.pickerBtn} onPress={() => setShowTimePicker(true)}>
          <FontAwesome name="clock-o" size={16} color={DS.color.gold} />
          <Text style={styles.pickerBtnText}>{formatTime(eventTime)}</Text>
        </Pressable>
        {showTimePicker ? (
          <DateTimePicker
            value={eventTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(e, d) => onPickerChange('time', e, d)}
          />
        ) : null}

        <Text style={[styles.label, styles.labelSpaced]}>Venue / location</Text>
        <TextInput
          style={styles.input}
          value={venue}
          onChangeText={(t) => {
            clearError();
            setVenue(t);
          }}
          placeholder="City, facility, or online"
          placeholderTextColor={DS.color.textMuted}
        />
        <Text style={[styles.label, styles.labelSpaced]}>Expected attendance *</Text>
        <TextInput
          style={styles.input}
          value={maxAttendance}
          onChangeText={(t) => {
            clearError();
            setMaxAttendance(t);
          }}
          keyboardType="number-pad"
          placeholder="e.g. 40"
          placeholderTextColor={DS.color.textMuted}
        />
        <Text style={[styles.label, styles.labelSpaced]}>Level</Text>
        <View style={styles.chipWrap}>
          {LEVELS.map((lv) => (
            <Pressable
              key={lv}
              onPress={() => setLevel(lv)}
              style={[styles.chip, level === lv && styles.chipOn]}
            >
              <Text style={[styles.chipTxt, level === lv && styles.chipTxtOn]}>{lv}</Text>
            </Pressable>
          ))}
        </View>
      </WizardChrome>
    );
  }

  if (step === 3) {
    return (
      <WizardChrome
        title="Event proposal"
        step={3}
        totalSteps={TOTAL_STEPS}
        onBack={() => {
          clearError();
          setStep(2);
        }}
        onNext={() => goNext(4)}
        errorMessage={error}
      >
        <Text style={styles.lead}>Agenda time slots</Text>
        <View style={styles.chipWrap}>
          {(
            [
              ['15', 'Every 15 min'],
              ['30', 'Every 30 min'],
              ['60', 'Every 1 hour'],
              ['custom', 'Custom'],
            ] as const
          ).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => applyAgendaSplit(key)}
              style={[styles.chip, agendaSplit === key && styles.chipOn]}
            >
              <Text style={[styles.chipTxt, agendaSplit === key && styles.chipTxtOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <ScrollView style={styles.agendaScroll} nestedScrollEnabled>
          {agenda.map((row, i) => (
            <View key={`ag-${i}`} style={styles.agendaRow}>
              <TextInput
                style={[styles.input, styles.agendaTime]}
                value={row.time}
                onChangeText={(t) =>
                  setAgenda((rows) => rows.map((r, j) => (j === i ? { ...r, time: t } : r)))
                }
                placeholder="10:00"
                placeholderTextColor={DS.color.textMuted}
              />
              <TextInput
                style={[styles.input, styles.agendaTitle]}
                value={row.title}
                onChangeText={(t) =>
                  setAgenda((rows) => rows.map((r, j) => (j === i ? { ...r, title: t } : r)))
                }
                placeholder="Session title"
                placeholderTextColor={DS.color.textMuted}
              />
            </View>
          ))}
        </ScrollView>
        <Pressable
          style={styles.addRowBtn}
          onPress={() => setAgenda((rows) => [...rows, { title: '', time: '' }])}
        >
          <Text style={styles.addRowBtnText}>+ Add agenda item</Text>
        </Pressable>
      </WizardChrome>
    );
  }

  if (step === 4) {
    return (
      <WizardChrome
        title="Event proposal"
        step={4}
        totalSteps={TOTAL_STEPS}
        onBack={() => setStep(3)}
        onNext={() => goNext(5)}
        nextLabel="Review"
        errorMessage={error}
      >
        <Text style={styles.lead}>Add photos or videos (optional). Tap to preview.</Text>
        <View style={styles.mediaActions}>
          <Pressable style={styles.mediaPickBtn} onPress={() => void pickMedia('image')}>
            <FontAwesome name="picture-o" size={16} color={DS.color.gold} />
            <Text style={styles.mediaPickTxt}> Images</Text>
          </Pressable>
          <Pressable style={styles.mediaPickBtn} onPress={() => void pickMedia('video')}>
            <FontAwesome name="video-camera" size={16} color={DS.color.gold} />
            <Text style={styles.mediaPickTxt}> Videos</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewRow}>
          {attachments.map((a) => (
            <View key={a.uri} style={styles.previewCard}>
              <Pressable
                style={styles.previewRemove}
                onPress={() => setAttachments((prev) => prev.filter((x) => x.uri !== a.uri))}
              >
                <FontAwesome name="times" size={10} color={DS.color.white} />
              </Pressable>
              {a.kind === 'image' ? (
                <Image source={{ uri: a.uri }} style={styles.previewMedia} resizeMode="cover" />
              ) : (
                <Video
                  source={{ uri: a.uri }}
                  style={styles.previewMedia}
                  resizeMode={ResizeMode.COVER}
                  useNativeControls
                />
              )}
            </View>
          ))}
        </ScrollView>
      </WizardChrome>
    );
  }

  return (
    <WizardChrome
      title="Event proposal"
      step={5}
      totalSteps={TOTAL_STEPS}
      onBack={() => !submitted && setStep(4)}
      onNext={submitted ? undefined : () => void submit()}
      nextLabel={submitting ? 'Submitting…' : 'Submit event for review'}
      nextDisabled={submitting || submitted}
      errorMessage={error}
    >
      <Text style={styles.reviewTitle}>{title}</Text>
      <Text style={styles.reviewMeta}>
        {formatDate(eventDate)} · {formatTime(eventTime)} · {venue || 'Venue TBC'} · {level}
      </Text>
      <Text style={styles.reviewBody}>{pitch}</Text>
      <Text style={styles.reviewHint}>
        {agenda.length} agenda item{agenda.length === 1 ? '' : 's'} · {attachments.length} attachment
        {attachments.length === 1 ? '' : 's'}
      </Text>
    </WizardChrome>
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
  quota: {
    fontFamily: DS.font.body,
    fontSize: 12,
    color: DS.color.gold,
    marginBottom: DS.space.md,
  },
  label: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 13,
    color: DS.color.screenTitle,
    marginBottom: DS.space.xs,
  },
  labelSpaced: { marginTop: DS.space.md },
  input: {
    backgroundColor: DS.color.input,
    borderRadius: DS.radius.lg,
    padding: DS.space.md,
    color: DS.color.text,
    fontFamily: DS.font.body,
    fontSize: 15,
    marginBottom: DS.space.md,
  },
  multi: { minHeight: 120, textAlignVertical: 'top' },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    backgroundColor: DS.color.input,
    borderRadius: DS.radius.lg,
    padding: DS.space.md,
    marginBottom: DS.space.md,
  },
  pickerBtnText: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 16,
    color: DS.color.text,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: DS.space.sm, marginBottom: DS.space.md },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: DS.color.input,
  },
  chipOn: { backgroundColor: DS.color.gold },
  chipTxt: { fontFamily: DS.font.bodyMedium, fontSize: 13, color: DS.color.text },
  chipTxtOn: { color: DS.color.background, fontWeight: '700' },
  agendaScroll: { maxHeight: 220, marginBottom: DS.space.sm },
  agendaRow: { flexDirection: 'row', gap: DS.space.sm, marginBottom: DS.space.sm },
  agendaTime: { width: 88, marginBottom: 0 },
  agendaTitle: { flex: 1, marginBottom: 0 },
  addRowBtn: { alignSelf: 'flex-start', paddingVertical: DS.space.sm },
  addRowBtnText: { fontFamily: DS.font.bodyMedium, fontSize: 14, color: DS.color.gold },
  mediaActions: { flexDirection: 'row', gap: DS.space.md, marginBottom: DS.space.md },
  mediaPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: DS.space.md,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    borderColor: DS.color.goldTint30,
  },
  mediaPickTxt: { fontFamily: DS.font.bodyMedium, fontSize: 14, color: DS.color.gold },
  previewRow: { gap: DS.space.md, paddingBottom: DS.space.md },
  previewCard: {
    width: 120,
    height: 120,
    borderRadius: DS.radius.lg,
    overflow: 'hidden',
    backgroundColor: DS.color.surface,
  },
  previewMedia: { width: '100%', height: '100%' },
  previewRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.goldTint30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
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
    marginBottom: DS.space.md,
  },
  reviewHint: {
    fontFamily: DS.font.body,
    fontSize: 13,
    color: DS.color.textMuted,
  },
});
