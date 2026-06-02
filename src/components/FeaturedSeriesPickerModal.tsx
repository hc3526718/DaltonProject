import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { DS } from '../designSystem';
import {
  listMediaSeriesOptions,
  setFeaturedMediaSeries,
  type MediaSeriesOption,
} from '../roadmap/liveDataService';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function FeaturedSeriesPickerModal({ visible, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [options, setOptions] = useState<MediaSeriesOption[]>([]);
  const [featuredTitle, setFeaturedTitle] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { options: opts, featuredSeriesTitle } = await listMediaSeriesOptions();
    setOptions(opts);
    setFeaturedTitle(featuredSeriesTitle);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    void load();
  }, [visible, load]);

  const pick = async (seriesTitle: string | null) => {
    setBusy(true);
    const ok = await setFeaturedMediaSeries(seriesTitle);
    setBusy(false);
    if (ok) {
      onSaved();
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Featured series</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <FontAwesome name="times" size={20} color={DS.color.textMuted} />
            </Pressable>
          </View>
          <Text style={styles.hint}>
            Choose which video series appears at the top of Media. Only series with a series title are listed.
          </Text>
          {loading ? (
            <ActivityIndicator color={DS.color.gold} style={{ marginVertical: 24 }} />
          ) : (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              <Pressable
                style={[styles.row, !featuredTitle && styles.rowOn]}
                disabled={busy}
                onPress={() => void pick(null)}
              >
                <Text style={styles.rowTitle}>None (hide featured hero)</Text>
              </Pressable>
              {options.map((opt) => (
                <Pressable
                  key={opt.seriesTitle}
                  style={[styles.row, featuredTitle === opt.seriesTitle && styles.rowOn]}
                  disabled={busy}
                  onPress={() => void pick(opt.seriesTitle)}
                >
                  <Text style={styles.rowTitle}>{opt.seriesTitle}</Text>
                  <Text style={styles.rowSub}>
                    {opt.partCount} video{opt.partCount === 1 ? '' : 's'}
                    {opt.featured ? ' · Featured' : ''}
                  </Text>
                </Pressable>
              ))}
              {options.length === 0 ? (
                <Text style={styles.empty}>
                  No series yet. Add a series title when uploading or editing media.
                </Text>
              ) : null}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    maxHeight: '70%',
    backgroundColor: DS.color.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: DS.space.lg,
    borderTopWidth: 1,
    borderColor: DS.color.borderHairline,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: DS.space.sm,
  },
  title: {
    fontFamily: DS.font.heading,
    fontSize: 20,
    color: DS.color.text,
  },
  hint: {
    fontFamily: DS.font.body,
    fontSize: 13,
    color: DS.color.textMuted,
    marginBottom: DS.space.md,
    lineHeight: 18,
  },
  list: { maxHeight: 360 },
  row: {
    paddingVertical: DS.space.md,
    paddingHorizontal: DS.space.sm,
    borderRadius: DS.radius.md,
    marginBottom: DS.space.xs,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowOn: {
    borderColor: DS.color.gold,
    backgroundColor: DS.color.goldTint10,
  },
  rowTitle: {
    fontFamily: DS.font.bodyBold,
    fontSize: 15,
    color: DS.color.text,
  },
  rowSub: {
    fontFamily: DS.font.body,
    fontSize: 12,
    color: DS.color.textMuted,
    marginTop: 4,
  },
  empty: {
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.textMuted,
    paddingVertical: DS.space.lg,
    textAlign: 'center',
  },
});
