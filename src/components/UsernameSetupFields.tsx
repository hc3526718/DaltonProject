import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { DS } from '../designSystem';
import {
  USERNAME_MAX,
  USERNAME_MIN,
  isValidUsernameFormat,
  normalizeUsernameTyping,
  slugifyFirstNameForUsername,
} from '../profile/usernameProfile';
import type { UsernameAvailabilityState } from '../profile/useUsernameAvailability';

type Props = {
  firstNameForPreview: string;
  usernameInput: string;
  onUsernameInputChange: (v: string) => void;
  skipped: boolean;
  onSkippedChange: (skipped: boolean) => void;
  availability: UsernameAvailabilityState;
};

export function UsernameSetupFields({
  firstNameForPreview,
  usernameInput,
  onUsernameInputChange,
  skipped,
  onSkippedChange,
  availability,
}: Props) {
  const { normalized, checking, available } = availability;

  const previewBase = slugifyFirstNameForUsername(firstNameForPreview || 'Name');
  const previewExample = `${previewBase}4829`;

  let statusText = '';
  let statusColor = DS.color.textMuted;
  if (skipped) {
    statusText = `We&apos;ll assign something like ${previewExample} (your first name + four random digits).`;
    statusColor = DS.color.textMuted;
  } else if (!usernameInput.trim()) {
    statusText = `${USERNAME_MIN}–${USERNAME_MAX} characters: lowercase letters, numbers, underscores.`;
  } else if (normalized.length < USERNAME_MIN) {
    statusText = `Keep typing — at least ${USERNAME_MIN} characters.`;
  } else if (!isValidUsernameFormat(normalized)) {
    statusText = 'Use only letters, numbers, and underscores.';
    statusColor = DS.color.textMuted;
  } else if (checking) {
    statusText = 'Checking availability…';
  } else if (available === true) {
    statusText = 'This username is available.';
    statusColor = DS.color.gold;
  } else if (available === false) {
    statusText = 'That username is already taken.';
    statusColor = '#ff6b6b';
  }

  return (
    <View style={styles.block}>
      <Text style={styles.label}>USERNAME</Text>
      <Text style={styles.hint}>Shown as @{skipped ? previewExample : normalized || 'yourname'}</Text>

      {!skipped ? (
        <View style={styles.handleRow}>
          <Text style={styles.handleAt}>@</Text>
          <TextInput
            style={[styles.input, styles.inputHandle]}
            placeholder="username"
            placeholderTextColor={DS.color.textMuted}
            value={usernameInput}
            onChangeText={(t) => onUsernameInputChange(normalizeUsernameTyping(t))}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={USERNAME_MAX}
          />
        </View>
      ) : null}

      <Text style={[styles.status, { color: statusColor }]}>{statusText}</Text>

      <Pressable
        hitSlop={8}
        onPress={() => {
          const next = !skipped;
          onSkippedChange(next);
          if (next) onUsernameInputChange('');
        }}
        style={styles.skipBtn}
      >
        <Text style={styles.skipTxt}>
          {skipped ? 'Choose my own username instead' : 'Skip — use my first name + random digits'}
        </Text>
      </Pressable>
    </View>
  );
}

export function canProceedWithUsername(
  skipped: boolean,
  usernameInput: string,
  availability: { normalized: string; checking: boolean; available: boolean | null },
): boolean {
  if (skipped) return true;
  const n = availability.normalized;
  if (!isValidUsernameFormat(n)) return false;
  if (availability.checking) return false;
  return availability.available === true && normalizeUsernameTyping(usernameInput) === n;
}

const styles = StyleSheet.create({
  block: { marginBottom: DS.space.md },
  label: {
    fontFamily: DS.font.bodyMedium,
    fontSize: DS.type.labelUppercaseSize,
    fontWeight: '700',
    color: DS.color.gold,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: DS.space.xs,
  },
  hint: {
    fontFamily: DS.font.body,
    fontSize: 13,
    color: DS.color.textMuted,
    marginBottom: DS.space.sm,
  },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: DS.apple.radiusField,
    backgroundColor: DS.color.input,
    paddingHorizontal: DS.space.md,
  },
  handleAt: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 16,
    color: DS.color.textMuted,
    marginRight: 4,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: DS.color.text,
    fontFamily: DS.font.body,
  },
  inputHandle: {
    paddingHorizontal: 0,
  },
  status: {
    marginTop: DS.space.sm,
    fontFamily: DS.font.body,
    fontSize: 13,
    lineHeight: 18,
  },
  skipBtn: {
    marginTop: DS.space.md,
    alignSelf: 'flex-start',
    paddingVertical: DS.space.xs,
  },
  skipTxt: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 14,
    color: DS.color.gold,
    textDecorationLine: 'underline',
  },
});
