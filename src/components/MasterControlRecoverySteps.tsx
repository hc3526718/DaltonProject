import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { DS } from '../designSystem';

function buildSteps(includePassword: boolean): string[] {
  const unlockLine = includePassword
    ? 'Unlock with your account password, then the email verification code, then your 6-digit Master PIN.'
    : 'If you use Google sign-in, you can re-verify with Google from Master verification (or use the email code). Then enter your 6-digit Master PIN.';
  return [
    'Your account must have Master access enabled on your Dalton profile (admin / database).',
    'In the app, open Profile → Master control.',
    unlockLine,
    'If you reset data or never set a PIN: ask for Master to be restored on your profile, open Master control, then use Change PIN to create a new PIN.',
  ];
}

type Props = {
  /** Extra margin/padding when stacked below other content */
  style?: ViewStyle | ViewStyle[];
  /**
   * When false, copy assumes Apple/Google-only (no password on file) — reuse this with Master Gate federated flow.
   */
  includesPasswordGate?: boolean;
};

export function MasterControlRecoverySteps({ style, includesPasswordGate = true }: Props) {
  const steps = buildSteps(includesPasswordGate);
  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.title}>Getting Master control again</Text>
      <Text style={styles.intro}>
        Use these steps if you had Master access before and need to unlock tools after a fresh install, database reset,
        or PIN loss.
      </Text>
      {steps.map((line, i) => (
        <View key={i} style={styles.row}>
          <Text style={styles.idx}>{i + 1}.</Text>
          <Text style={styles.line}>{line}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    borderColor: DS.color.goldTint30,
    backgroundColor: DS.color.goldTint10,
    padding: DS.space.md,
    gap: DS.space.sm,
  },
  title: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 15,
    color: DS.color.gold,
    marginBottom: DS.space.xs,
  },
  intro: {
    fontFamily: DS.font.body,
    fontSize: 13,
    lineHeight: 19,
    color: DS.color.textMuted,
    marginBottom: DS.space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: DS.space.sm,
  },
  idx: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 13,
    color: DS.color.textMuted,
    width: 22,
  },
  line: {
    flex: 1,
    fontFamily: DS.font.body,
    fontSize: 13,
    lineHeight: 19,
    color: DS.color.text,
  },
});
