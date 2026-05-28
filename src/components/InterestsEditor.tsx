import { useCallback, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { DS } from '../designSystem';
import { capitalizeProfileTag } from '../lib/capitalizeProfileTags';
import { INTEREST_OPTIONS } from '../onboarding/onboardingCopy';

function normalizeInterest(raw: string): string {
  return capitalizeProfileTag(raw.trim());
}

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  maxItems?: number;
  hint?: string;
};

export function InterestsEditor({ value, onChange, maxItems = 30, hint }: Props) {
  const [query, setQuery] = useState('');

  const selectedKeys = useMemo(() => new Set(value.map((v) => v.toLowerCase())), [value]);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return INTEREST_OPTIONS.filter((opt) => {
      if (selectedKeys.has(opt.toLowerCase())) return false;
      if (!q) return true;
      return opt.toLowerCase().includes(q);
    });
  }, [query, selectedKeys]);

  const toggle = useCallback(
    (label: string) => {
      const key = label.toLowerCase();
      if (selectedKeys.has(key)) {
        onChange(value.filter((v) => v.toLowerCase() !== key));
        return;
      }
      if (value.length >= maxItems) return;
      onChange([...value, normalizeInterest(label)]);
    },
    [maxItems, onChange, selectedKeys, value],
  );

  const addCustom = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed || value.length >= maxItems) return;
    const next = normalizeInterest(trimmed);
    if (!next || selectedKeys.has(next.toLowerCase())) {
      setQuery('');
      return;
    }
    onChange([...value, next]);
    setQuery('');
  }, [maxItems, onChange, query, selectedKeys, value]);

  const onSearchKeyPress = useCallback(
    (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      if (e.nativeEvent.key === 'Enter') addCustom();
    },
    [addCustom],
  );

  return (
    <View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <Text style={styles.label}>Search or add your own</Text>
      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder="Type an interest and press Enter"
        placeholderTextColor={DS.color.textMuted}
        returnKeyType="done"
        blurOnSubmit={false}
        onSubmitEditing={addCustom}
        onKeyPress={onSearchKeyPress}
      />
      {Platform.OS === 'web' ? (
        <Text style={styles.webEnterHint}>Press Enter to add a custom interest.</Text>
      ) : null}

      {value.length > 0 ? (
        <View style={styles.selectedBlock}>
          <Text style={styles.label}>Selected</Text>
          <View style={styles.chipGrid}>
            {value.map((item) => (
              <Pressable
                key={item}
                style={[styles.chip, styles.chipOn]}
                onPress={() => toggle(item)}
                accessibilityLabel={`Remove ${item}`}
              >
                <Text style={[styles.chipText, styles.chipTextOn]}>{item}</Text>
                <FontAwesome name="times" size={12} color={DS.color.gold} style={styles.chipX} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <Text style={[styles.label, styles.suggestLabel]}>Suggestions</Text>
      <View style={styles.chipGrid}>
        {filteredOptions.map((opt) => (
          <Pressable key={opt} onPress={() => toggle(opt)} style={styles.chip}>
            <Text style={styles.chipText}>{opt}</Text>
          </Pressable>
        ))}
      </View>
      {filteredOptions.length === 0 && query.trim() ? (
        <Text style={styles.emptyHint}>No matches — press Enter to add “{query.trim()}”.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.textMuted,
    lineHeight: 20,
    marginBottom: DS.space.md,
  },
  label: {
    fontFamily: DS.font.bodyMedium,
    fontSize: DS.type.labelUppercaseSize,
    fontWeight: '700',
    color: DS.color.gold,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: DS.space.sm,
  },
  suggestLabel: { marginTop: DS.space.lg },
  search: {
    backgroundColor: DS.color.input,
    borderRadius: DS.apple.radiusField,
    paddingVertical: 14,
    paddingHorizontal: DS.space.md,
    fontSize: 16,
    color: DS.color.text,
    fontFamily: DS.font.body,
    marginBottom: DS.space.xs,
  },
  webEnterHint: {
    fontFamily: DS.font.body,
    fontSize: 12,
    color: DS.color.textMuted,
    marginBottom: DS.space.md,
  },
  selectedBlock: { marginTop: DS.space.md, marginBottom: DS.space.sm },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: DS.space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: DS.space.md,
    borderRadius: DS.apple.radiusButton,
    backgroundColor: DS.apple.fillSecondary,
    borderWidth: 1,
    borderColor: DS.apple.separator,
  },
  chipOn: {
    backgroundColor: DS.color.goldTint10,
    borderColor: DS.color.gold,
  },
  chipText: { fontFamily: DS.font.bodyMedium, fontSize: 15, color: DS.color.text },
  chipTextOn: { color: DS.color.gold },
  chipX: { marginLeft: 8 },
  emptyHint: {
    fontFamily: DS.font.body,
    fontSize: 13,
    color: DS.color.textMuted,
    marginTop: DS.space.sm,
  },
});
