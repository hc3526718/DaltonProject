import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../auth/AuthContext';
import { AppLoadingIndicator } from '../../components/AppLoadingIndicator';
import { ScreenHeader } from '../../components/ScreenHeader';
import { DS } from '../../designSystem';
import { getOrCreateConversationId } from '../../roadmap/messagingService';
import type { ProfileStackParamList } from '../../navigation/types';
import type { SponsorsStackParamList } from '../../navigation/types';
import {
  deleteContentProposal,
  listMyProposals,
  type ContentProposalRow,
} from '../../roadmap/proposalService';

type ProfileProps = NativeStackScreenProps<ProfileStackParamList, 'MyProposals'>;
type SponsorProps = NativeStackScreenProps<SponsorsStackParamList, 'MySponsorProposals'>;

export function MyProposalsScreen({ navigation }: ProfileProps) {
  return <MyProposalsList navigation={navigation} kindFilter={undefined} />;
}

export function MySponsorProposalsScreen({ navigation }: SponsorProps) {
  return <MyProposalsList navigation={navigation} kindFilter="sponsor" />;
}

function MyProposalsList({
  navigation,
  kindFilter,
}: {
  navigation: ProfileProps['navigation'] | SponsorProps['navigation'];
  kindFilter?: 'sponsor';
}) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [rows, setRows] = useState<ContentProposalRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let list = await listMyProposals();
    if (kindFilter) list = list.filter((r) => r.kind === kindFilter);
    setRows(list);
    setLoading(false);
  }, [kindFilter]);

  const confirmDelete = useCallback(
    (row: ContentProposalRow) => {
      Alert.alert('Delete proposal?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const res = await deleteContentProposal(row.id);
              if (!res.ok) {
                Alert.alert('Could not delete', res.error ?? 'Try again.');
                return;
              }
              await load();
            })();
          },
        },
      ]);
    },
    [load],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openMessages = useCallback(
    async (row: ContentProposalRow) => {
      if (!row.reviewed_by || !row.discussion_unlocked) return;
      const cid = await getOrCreateConversationId(row.reviewed_by);
      if (!cid) {
        Alert.alert('Messages', 'Could not start a conversation.');
        return;
      }
      (navigation as ProfileProps['navigation']).getParent()?.navigate('Community' as never, {
        screen: 'MessageThread',
        params: {
          conversationId: cid,
          peerUserId: row.reviewed_by,
          name: 'Dalton partnerships',
        },
      } as never);
    },
    [navigation],
  );

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={kindFilter === 'sponsor' ? 'My sponsor proposals' : 'My proposals'}
        onBack={() => navigation.goBack()}
        largeTitle
      />
      {loading ? (
        <AppLoadingIndicator style={{ marginTop: DS.space.xl }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + DS.space.xl }]}
          ListEmptyComponent={<Text style={styles.empty}>No proposals yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.kind}>{item.kind} · {item.status}</Text>
              <Text style={styles.title}>
                {String(item.payload.title ?? item.payload.brand_name ?? 'Proposal')}
              </Text>
              <Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text>
              {item.status === 'approved' &&
              item.discussion_unlocked &&
              item.reviewed_by ? (
                <Pressable style={styles.msgBtn} onPress={() => void openMessages(item)}>
                  <FontAwesome name="comment" size={14} color={DS.color.background} />
                  <Text style={styles.msgBtnTxt}>Continue in Messages</Text>
                </Pressable>
              ) : null}
              {item.status === 'rejected' ? (
                <Text style={styles.rejectedNote}>
                  This proposal was not accepted. You may submit again if slots remain this month.
                </Text>
              ) : null}
              {(item.status === 'pending' || user?.masterControl) ? (
                <Pressable style={styles.deleteBtn} onPress={() => confirmDelete(item)}>
                  <FontAwesome name="trash-o" size={14} color={DS.color.error} />
                  <Text style={styles.deleteBtnTxt}>Delete</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.color.background },
  list: { paddingHorizontal: DS.space.base, paddingTop: DS.space.md },
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
    marginBottom: DS.space.sm,
    borderWidth: 1,
    borderColor: DS.color.cardBorder,
  },
  kind: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 12,
    color: DS.color.gold,
    textTransform: 'capitalize',
  },
  title: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 16,
    color: DS.color.text,
    marginTop: 4,
  },
  date: {
    fontFamily: DS.font.body,
    fontSize: 12,
    color: DS.color.textMuted,
    marginTop: 4,
  },
  msgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    backgroundColor: DS.color.gold,
    paddingVertical: 10,
    paddingHorizontal: DS.space.md,
    borderRadius: DS.radius.lg,
    marginTop: DS.space.md,
    alignSelf: 'flex-start',
  },
  msgBtnTxt: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 14,
    fontWeight: '700',
    color: DS.color.background,
  },
  rejectedNote: {
    fontFamily: DS.font.body,
    fontSize: 13,
    color: DS.color.textMuted,
    marginTop: DS.space.sm,
    lineHeight: 18,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    marginTop: DS.space.md,
    alignSelf: 'flex-start',
  },
  deleteBtnTxt: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 14,
    color: DS.color.error,
  },
});
