import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DS } from '../../designSystem';

type Props = {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export function FormField({ label, required, hint, error, children }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.req}> *</Text> : null}
      </Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {children}
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: DS.apple.fieldGap,
  },
  label: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 13,
    color: DS.color.textMuted,
    marginBottom: DS.space.xs,
    letterSpacing: 0.15,
  },
  req: { color: DS.color.error },
  hint: {
    fontFamily: DS.font.body,
    fontSize: 12,
    color: DS.color.textMuted,
    opacity: 0.85,
    marginBottom: DS.space.sm,
    lineHeight: 17,
  },
  err: {
    fontFamily: DS.font.body,
    fontSize: 12,
    color: DS.color.error,
    marginTop: DS.space.xs,
  },
});
