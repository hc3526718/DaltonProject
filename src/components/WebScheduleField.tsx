import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { DS } from '../designSystem';

type Props = {
  mode: 'date' | 'time';
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  label: string;
  formatDisplay: (d: Date) => string;
};

/** Native date/time picker; on web uses HTML5 inputs (DateTimePicker is unsupported). */
export function WebScheduleField({
  mode,
  value,
  onChange,
  minimumDate,
  label,
  formatDisplay,
}: Props) {
  if (Platform.OS === 'web') {
    const isoDate = value.toISOString().slice(0, 10);
    const hh = String(value.getHours()).padStart(2, '0');
    const mm = String(value.getMinutes()).padStart(2, '0');
    const timeVal = `${hh}:${mm}`;
    const minIso = minimumDate?.toISOString().slice(0, 10);

    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>{label}</Text>
        {mode === 'date' ? (
          // eslint-disable-next-line react/forbid-elements
          <input
            type="date"
            value={isoDate}
            min={minIso}
            onChange={(e) => {
              const next = new Date(value);
              const [y, m, d] = e.target.value.split('-').map(Number);
              if (y && m && d) {
                next.setFullYear(y, m - 1, d);
                onChange(next);
              }
            }}
            style={webInputStyle}
          />
        ) : (
          // eslint-disable-next-line react/forbid-elements
          <input
            type="time"
            value={timeVal}
            onChange={(e) => {
              const [h, min] = e.target.value.split(':').map(Number);
              const next = new Date(value);
              if (!Number.isNaN(h) && !Number.isNaN(min)) {
                next.setHours(h, min, 0, 0);
                onChange(next);
              }
            }}
            style={webInputStyle}
          />
        )}
        <Text style={styles.hint}>{formatDisplay(value)}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <DateTimePicker
        value={value}
        mode={mode}
        minimumDate={mode === 'date' ? minimumDate : undefined}
        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        onChange={(e: DateTimePickerEvent, selected?: Date) => {
          if (e.type === 'dismissed' || !selected) return;
          onChange(selected);
        }}
      />
    </View>
  );
}

const webInputStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(0,0,0,0.35)',
  color: '#D4D0C8',
  fontSize: 15,
  fontFamily: 'DM Sans, system-ui, sans-serif',
  boxSizing: 'border-box' as const,
};

const styles = StyleSheet.create({
  wrap: { marginBottom: DS.space.md },
  label: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 13,
    color: DS.color.textMuted,
    marginBottom: DS.space.xs,
  },
  hint: {
    fontFamily: DS.font.body,
    fontSize: 12,
    color: DS.color.textMuted,
    marginTop: DS.space.xs,
  },
});
