import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { ScreenHeader } from '../components/ScreenHeader';
import { AppButton } from '../components/ui/AppButton';
import { DS } from '../designSystem';
import { endsAtAfterDuration } from '../lib/eventFormParse';
import { combineDateAndTime } from '../lib/scheduleValidation';
import type { EventsStackParamList } from '../navigation/types';
import { canCreateVerifiedContent } from '../creator/creatorAccess';
import { getEventById, updateCommunityEvent } from '../roadmap/liveDataService';
import type { EventRow } from '../roadmap/types';

type Props = NativeStackScreenProps<EventsStackParamList, 'EditEvent'>;

function parseFromDescription(desc?: string | null): { level?: string; cap?: string; tags?: string; duration?: string } {
  const txt = desc ?? '';
  const pick = (prefix: string) => {
    const m = txt.match(new RegExp(`^${prefix}\\s*:\\s*(.+)$`, 'mi'));
    return m?.[1]?.trim();
  };
  return {
    level: pick('Level'),
    cap: pick('Capacity'),
    tags: pick('Tags'),
    duration: pick('Duration'),
  };
}

export function EditEventScreen({ navigation, route }: Props) {
  // Legacy screen kept for compatibility; route now renders `EditEventWizardScreen`.
  useEffect(() => {
    navigation.replace('EditEvent', { eventId: route.params.eventId });
  }, [navigation, route.params.eventId]);
  return <View style={styles.root} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.color.background },
  pad: { padding: DS.space.lg },
  kicker: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 12,
    color: DS.color.textMuted,
    letterSpacing: 2,
    marginBottom: DS.space.sm,
    marginTop: DS.space.md,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: DS.color.surfaceAlt,
    borderRadius: DS.radius.xl,
    borderWidth: 1,
    borderColor: DS.color.borderHairline,
    padding: DS.space.base,
    marginBottom: DS.space.lg,
  },
  label: { fontSize: 12, color: DS.color.textMuted, marginBottom: 6, marginTop: DS.space.sm },
  input: {
    backgroundColor: DS.color.input,
    borderRadius: DS.radius.lg,
    padding: DS.space.md,
    color: DS.color.text,
    fontSize: 15,
  },
  multi: { minHeight: 120 },
  muted: { fontSize: 14, color: DS.color.textMuted, lineHeight: 20 },
  row: { flexDirection: 'row', gap: DS.space.md },
  pickerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    backgroundColor: DS.color.surface,
    borderRadius: DS.radius.lg,
    padding: DS.space.md,
    borderWidth: 1,
    borderColor: DS.color.borderHairline,
    justifyContent: 'center',
  },
  pickerTxt: { fontSize: 14, fontWeight: '600', color: DS.color.text },
});

