import { StyleSheet, Text, View } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { DS } from '../designSystem';
import type { ParsedEventDescription } from '../lib/eventDescriptionParse';

type Props = {
  parsed: ParsedEventDescription;
  entryPaymentLine?: string | null;
};

export function EventDetailSections({ parsed, entryPaymentLine }: Props) {
  const hasMeta =
    Boolean(parsed.level) ||
    Boolean(parsed.cap) ||
    Boolean(parsed.tags && parsed.tags !== '—') ||
    Boolean(parsed.duration);

  return (
    <>
      {entryPaymentLine ? (
        <View style={styles.entryPaymentCard}>
          <FontAwesome name="info-circle" size={16} color={DS.color.gold} />
          <Text style={styles.entryPaymentText}>{entryPaymentLine}</Text>
        </View>
      ) : null}

      <Text style={styles.kicker}>OVERVIEW</Text>
      {parsed.baseDescription ? (
        <Text style={styles.body}>{parsed.baseDescription}</Text>
      ) : (
        <Text style={[styles.body, styles.muted]}>No description from the host yet.</Text>
      )}

      {hasMeta ? (
        <>
          <Text style={styles.kicker}>DETAILS</Text>
          <View style={styles.metaGrid}>
            {parsed.level ? (
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>Level</Text>
                <Text style={styles.metaValue}>{parsed.level}</Text>
              </View>
            ) : null}
            {parsed.cap ? (
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>Capacity</Text>
                <Text style={styles.metaValue}>{parsed.cap}</Text>
              </View>
            ) : null}
            {parsed.tags && parsed.tags !== '—' ? (
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>Tags</Text>
                <Text style={styles.metaValue}>{parsed.tags}</Text>
              </View>
            ) : null}
            {parsed.duration ? (
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>Duration</Text>
                <Text style={styles.metaValue}>{parsed.duration}</Text>
              </View>
            ) : null}
          </View>
        </>
      ) : null}

      {parsed.agenda.length > 0 ? (
        <>
          <Text style={styles.kicker}>AGENDA</Text>
          {parsed.agenda.map((row, i) => (
            <View key={`${row.time}-${i}`} style={styles.agendaRow}>
              <Text style={styles.agendaTime}>{row.time}</Text>
              <Text style={styles.agendaTitle}>{row.title}</Text>
            </View>
          ))}
        </>
      ) : null}

      {parsed.bring && parsed.bring !== '—' ? (
        <>
          <Text style={styles.kicker}>WHAT TO BRING</Text>
          <View style={styles.metaCellWide}>
            <Text style={styles.metaValue}>{parsed.bring}</Text>
          </View>
        </>
      ) : null}

      {parsed.faqs.length > 0 ? (
        <>
          <Text style={styles.kicker}>FREQUENTLY ASKED</Text>
          {parsed.faqs.map((f) => (
            <View key={f.q} style={styles.faqBlock}>
              <Text style={styles.faqQ}>{f.q}</Text>
              <Text style={styles.faqA}>{f.a}</Text>
            </View>
          ))}
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  kicker: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 11,
    letterSpacing: 2,
    color: DS.color.gold,
    marginTop: DS.space.lg,
    marginBottom: DS.space.sm,
  },
  body: {
    fontFamily: DS.font.body,
    fontSize: 15,
    lineHeight: 22,
    color: DS.color.text,
  },
  muted: { color: DS.color.textMuted },
  entryPaymentCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: DS.space.sm,
    padding: DS.space.md,
    borderRadius: DS.radius.lg,
    backgroundColor: DS.color.goldTint10,
    borderWidth: 1,
    borderColor: DS.color.goldTint30,
    marginTop: DS.space.md,
  },
  entryPaymentText: {
    flex: 1,
    fontFamily: DS.font.body,
    fontSize: 14,
    lineHeight: 20,
    color: DS.color.text,
  },
  metaGrid: { gap: DS.space.sm },
  metaCell: {
    padding: DS.space.md,
    borderRadius: DS.radius.lg,
    backgroundColor: DS.apple.fillSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.apple.separator,
  },
  metaCellWide: {
    padding: DS.space.md,
    borderRadius: DS.radius.lg,
    backgroundColor: DS.apple.fillSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.apple.separator,
  },
  metaLabel: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.5,
    color: DS.color.gold,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  metaValue: {
    fontFamily: DS.font.body,
    fontSize: 15,
    color: DS.color.text,
    lineHeight: 21,
  },
  agendaRow: {
    flexDirection: 'row',
    gap: DS.space.md,
    paddingVertical: DS.space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.apple.separator,
  },
  agendaTime: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 14,
    color: DS.color.gold,
    minWidth: 72,
  },
  agendaTitle: {
    flex: 1,
    fontFamily: DS.font.body,
    fontSize: 15,
    color: DS.color.text,
  },
  faqBlock: {
    paddingVertical: DS.space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.apple.separator,
  },
  faqQ: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 15,
    color: DS.color.text,
    marginBottom: 6,
  },
  faqA: {
    fontFamily: DS.font.body,
    fontSize: 14,
    lineHeight: 20,
    color: DS.color.textMuted,
  },
});
