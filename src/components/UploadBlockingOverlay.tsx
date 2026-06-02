import { Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DS } from '../designSystem';
import { AppLoadingIndicator } from './AppLoadingIndicator';

type Props = {
  visible: boolean;
  message: string;
  submessage?: string;
};

/** Full-screen blocker while a large file upload is in progress. */
export function UploadBlockingOverlay({ visible, message, submessage }: Props) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={[styles.backdrop, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.card}>
          <AppLoadingIndicator size={56} />
          <Text style={styles.title}>{message}</Text>
          {submessage ? <Text style={styles.sub}>{submessage}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: DS.space.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: DS.color.surface,
    borderRadius: DS.radius.xl,
    padding: DS.space.xl,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.cardBorder,
  },
  title: {
    marginTop: DS.space.lg,
    fontFamily: DS.font.bodyMedium,
    fontSize: 16,
    lineHeight: 22,
    color: DS.color.gold,
    textAlign: 'center',
  },
  sub: {
    marginTop: DS.space.sm,
    fontFamily: DS.font.body,
    fontSize: 14,
    lineHeight: 20,
    color: DS.color.textMuted,
    textAlign: 'center',
  },
});
