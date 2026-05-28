import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { DS } from '../designSystem';

export type OptionMenuItem = {
  key: string;
  label: string;
  destructive?: boolean;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  title: string;
  options: OptionMenuItem[];
  onClose: () => void;
};

/** Web-friendly action menu (Alert.alert multi-button is unreliable on web). */
export function OptionMenuModal({ visible, title, options, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          {options.map((opt) => (
            <Pressable
              key={opt.key}
              style={styles.row}
              onPress={() => {
                onClose();
                opt.onPress();
              }}
            >
              <Text style={[styles.rowText, opt.destructive && styles.destructive]}>{opt.label}</Text>
            </Pressable>
          ))}
          <Pressable style={[styles.row, styles.cancelRow]} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: DS.color.surface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.borderWhite5,
    overflow: 'hidden',
  },
  title: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 15,
    color: DS.color.textMuted,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
  },
  row: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DS.color.borderWhite5,
  },
  rowText: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 16,
    color: DS.color.text,
  },
  destructive: {
    color: DS.color.error,
  },
  cancelRow: {
    backgroundColor: DS.color.surfaceAlt,
  },
  cancelText: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 16,
    color: DS.color.textMuted,
    textAlign: 'center',
  },
});
