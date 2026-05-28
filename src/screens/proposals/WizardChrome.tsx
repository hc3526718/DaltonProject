import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DS } from '../../designSystem';

type Props = {
  title: string;
  step: number;
  totalSteps: number;
  onBack: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  /** Shown below the progress bar when validation fails */
  errorMessage?: string | null;
  children: ReactNode;
};

export function WizardChrome(props: Props) {
  const {
    title,
    step,
    totalSteps,
    onBack,
    onNext,
    nextLabel = 'Continue',
    nextDisabled,
    children,
  } = props;
  const validationError = props.errorMessage ?? null;

  const insets = useSafeAreaInsets();
  const progress = Math.min(1, step / totalSteps);

  return (
    <View style={styles.root}>
      <View style={[styles.top, { paddingTop: insets.top + DS.space.md }]}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.back}>
          <FontAwesome name="chevron-left" size={20} color={DS.color.gold} />
        </Pressable>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.stepLabel}>
          {step}/{totalSteps}
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      {validationError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{validationError}</Text>
        </View>
      ) : null}
      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      {onNext ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + DS.space.md }]}>
          <Pressable
            style={[styles.nextBtn, nextDisabled && styles.nextBtnDisabled]}
            disabled={nextDisabled}
            onPress={onNext}
          >
            <Text style={styles.nextBtnText}>{nextLabel}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.color.background },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DS.space.base,
    gap: DS.space.sm,
  },
  back: { padding: DS.space.xs },
  title: {
    flex: 1,
    fontFamily: DS.font.heading,
    fontSize: 22,
    color: DS.color.gold,
    letterSpacing: 1,
  },
  stepLabel: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 13,
    color: DS.color.textMuted,
  },
  progressTrack: {
    height: 3,
    backgroundColor: DS.color.input,
    marginTop: DS.space.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: DS.color.gold,
  },
  errorBanner: {
    marginHorizontal: DS.space.base,
    marginTop: DS.space.sm,
    padding: DS.space.md,
    borderRadius: DS.radius.lg,
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.45)',
  },
  errorBannerText: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 14,
    color: '#fca5a5',
    lineHeight: 20,
  },
  bodyScroll: { flex: 1 },
  bodyContent: {
    paddingHorizontal: DS.space.base,
    paddingTop: DS.space.lg,
    paddingBottom: DS.space.lg,
  },
  footer: {
    paddingHorizontal: DS.space.base,
    paddingTop: DS.space.md,
  },
  nextBtn: {
    backgroundColor: DS.color.gold,
    paddingVertical: 14,
    borderRadius: DS.radius.xl,
    alignItems: 'center',
  },
  nextBtnDisabled: { opacity: 0.45 },
  nextBtnText: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 16,
    fontWeight: '700',
    color: DS.color.background,
  },
});
