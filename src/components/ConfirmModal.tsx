import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { DS } from '../designSystem';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Cross-platform confirm dialog (Alert multi-button is unreliable on web). */
export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  destructive,
  busy,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onCancel} disabled={busy}>
              <Text style={styles.cancelTxt}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBtn, destructive && styles.confirmDestructive, busy && styles.busy]}
              onPress={onConfirm}
              disabled={busy}
            >
              <Text style={[styles.confirmTxt, destructive && styles.confirmTxtDestructive]}>
                {busy ? 'Please wait…' : confirmLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: DS.color.surface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.borderWhite5,
    padding: DS.space.lg,
  },
  title: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 18,
    color: DS.color.text,
    marginBottom: DS.space.sm,
  },
  message: {
    fontFamily: DS.font.body,
    fontSize: 15,
    color: DS.color.textMuted,
    lineHeight: 22,
    marginBottom: DS.space.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: DS.space.sm,
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: DS.space.md,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    borderColor: DS.color.borderWhite5,
  },
  cancelTxt: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 15,
    color: DS.color.textMuted,
  },
  confirmBtn: {
    paddingVertical: 12,
    paddingHorizontal: DS.space.md,
    borderRadius: DS.radius.lg,
    backgroundColor: DS.color.gold,
  },
  confirmDestructive: {
    backgroundColor: '#b91c1c',
  },
  busy: { opacity: 0.6 },
  confirmTxt: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 15,
    fontWeight: '700',
    color: DS.color.background,
  },
  confirmTxtDestructive: {
    color: DS.color.white,
  },
});
