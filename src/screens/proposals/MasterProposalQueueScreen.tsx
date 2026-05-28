import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../auth/AuthContext';
import { isMasterGateUnlocked } from '../../master/masterGateStorage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppLoadingIndicator } from '../../components/AppLoadingIndicator';
import { ScreenHeader } from '../../components/ScreenHeader';
import { DS } from '../../designSystem';
import type { ProfileStackParamList } from '../../navigation/types';
import {
  listPendingProposalsForMaster,
  type ContentProposalRow,
} from '../../roadmap/proposalService';

type Props = NativeStackScreenProps<ProfileStackParamList, 'MasterProposalQueue'>;

export function MasterProposalQueueScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [rows, setRows] = useState<ContentProposalRow[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        if (!user?.id || user.masterControl !== true) return;
        const ok = await isMasterGateUnlocked(user.id);
        if (alive && !ok) {
          navigation.replace('MasterGate', { returnTo: 'MasterProposalQueue' });
        }
      })();
      return () => {
        alive = false;
      };
    }, [navigation, user?.id, user?.masterControl]),
  );

  const load = useCallback(async () => {
    setLoading(true);
    const list = await listPendingProposalsForMaster();
    setRows(list);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Proposal review"
        onBack={() => navigation.goBack()}
        largeTitle
        right={
          user?.masterControl ? (
            <Pressable hitSlop={10} onPress={() => navigation.navigate('MasterControlHub')}>
              <FontAwesome name="cog" size={20} color={DS.color.gold} />
            </Pressable>
          ) : null
        }
      />
      {loading ? (
        <AppLoadingIndicator style={{ marginTop: DS.space.xl }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + DS.space.xl }]}
          ListEmptyComponent={
            <Text style={styles.empty}>No pending proposals.</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() =>
                navigation.navigate('MasterProposalDetail', { proposalId: item.id })
              }
            >
              <View style={styles.cardTop}>
                <Text style={styles.kind}>{item.kind.toUpperCase()}</Text>
                {item.opened_at ? (
                  <FontAwesome name="folder-open-o" size={14} color={DS.color.gold} />
                ) : (
                  <FontAwesome name="envelope-o" size={14} color={DS.color.textMuted} />
                )}
              </View>
              <Text style={styles.title}>
                {String(item.payload.title ?? item.payload.brand_name ?? 'Proposal')}
              </Text>
              <Text style={styles.meta}>
                {item.author_display_name ?? 'Member'} ·{' '}
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.color.background },
  list: { paddingHorizontal: DS.space.base, paddingTop: DS.space.md, gap: DS.space.sm },
  empty: {
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.textMuted,
    textAlign: 'center',
    marginTop: DS.space.xl,
  },
  card: {
    backgroundColor: DS.color.surface,
    borderRadius: DS.radius.xl,
    padding: DS.space.base,
    borderWidth: 1,
    borderColor: DS.color.cardBorder,
    marginBottom: DS.space.sm,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: DS.space.xs,
  },
  kind: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 11,
    letterSpacing: 1,
    color: DS.color.gold,
  },
  title: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 16,
    color: DS.color.text,
  },
  meta: {
    fontFamily: DS.font.body,
    fontSize: 12,
    color: DS.color.textMuted,
    marginTop: 4,
  },
});
