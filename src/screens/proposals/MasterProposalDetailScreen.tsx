import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppLoadingIndicator } from '../../components/AppLoadingIndicator';
import { ScreenHeader } from '../../components/ScreenHeader';
import { DS } from '../../designSystem';
import { useActionBanner } from '../../actionBanner/ActionBannerContext';
import type { ProfileStackParamList } from '../../navigation/types';
import { buildProposalOutreachMessage } from '../../lib/proposalOutreachMessage';
import { fetchProfileByUserId } from '../../roadmap/profileService';
import {
  fetchProposalById,
  masterOpenProposal,
  masterReviewProposal,
  type ContentProposalRow,
} from '../../roadmap/proposalService';

type Props = NativeStackScreenProps<ProfileStackParamList, 'MasterProposalDetail'>;

export function MasterProposalDetailScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const showBanner = useActionBanner();
  const proposalId = route.params.proposalId;
  const [row, setRow] = useState<ContentProposalRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [documentOpened, setDocumentOpened] = useState(false);

  const hasAttachments = useMemo(
    () => (row?.attachment_urls?.length ?? 0) > 0,
    [row?.attachment_urls],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    const p = await fetchProposalById(proposalId);
    setRow(p);
    setDocumentOpened(Boolean(p?.opened_at) || (p?.attachment_urls?.length ?? 0) === 0);
    setLoading(false);
  }, [proposalId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const openDocument = useCallback(async () => {
    if (!hasAttachments) return;
    const urls = row?.attachment_urls ?? [];
    const url = urls[0]!;
    const can = await Linking.canOpenURL(url);
    if (!can) {
      Alert.alert('Cannot open', url);
      return;
    }
    const opened = await masterOpenProposal(proposalId);
    if (!opened.ok) {
      Alert.alert('Could not record open', opened.error);
      return;
    }
    setDocumentOpened(true);
    await Linking.openURL(url);
    await reload();
  }, [hasAttachments, proposalId, reload, row?.attachment_urls]);

  const messageApplicant = useCallback(() => {
    if (!row?.author_id) return;
    void (async () => {
      const prof = await fetchProfileByUserId(row.author_id);
      const initialDraft = buildProposalOutreachMessage({
        kind: row.kind,
        payload: row.payload,
        authorFirstName: prof?.first_name ?? null,
        authorUsername: prof?.username ?? null,
        authorDisplayName: prof?.display_name ?? row.author_display_name ?? null,
      });
      navigation.getParent()?.navigate(
        'Community' as never,
        {
          screen: 'MessageThread',
          params: {
            peerUserId: row.author_id,
            name: row.author_display_name ?? 'Applicant',
            markDiscussedProposalId: proposalId,
            initialDraft,
          },
        } as never,
      );
    })();
  }, [navigation, proposalId, row]);

  const decide = useCallback(
    async (decision: 'approved' | 'rejected') => {
      setReviewing(true);
      const res = await masterReviewProposal(proposalId, decision);
      setReviewing(false);
      if (!res.ok) {
        Alert.alert('Review failed', res.error);
        return;
      }
      showBanner('Proposal decision sent', 'The applicant has been notified.');
      navigation.goBack();
    },
    [navigation, proposalId, showBanner],
  );

  if (loading || !row) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Proposal" onBack={() => navigation.goBack()} />
        <AppLoadingIndicator style={{ marginTop: DS.space.xl }} />
      </View>
    );
  }

  const canDecide = row.status === 'pending';

  return (
    <View style={styles.root}>
      <ScreenHeader title="Proposal detail" onBack={() => navigation.goBack()} largeTitle />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.kind}>
          {row.kind.toUpperCase()} · {row.status}
        </Text>
        <Text style={styles.author}>{row.author_display_name ?? 'Member'}</Text>

        {Object.entries(row.payload).map(([k, v]) => (
          <View key={k} style={styles.field}>
            <Text style={styles.fieldLabel}>{k.replace(/_/g, ' ')}</Text>
            <Text style={styles.fieldValue}>{String(v)}</Text>
          </View>
        ))}

        <Pressable style={styles.messageBtn} onPress={messageApplicant}>
          <FontAwesome name="comments" size={18} color={DS.color.gold} />
          <Text style={styles.messageBtnTxt}>Message applicant (optional)</Text>
        </Pressable>

        {hasAttachments ? (
          <Pressable style={styles.openDocBtn} onPress={() => void openDocument()}>
            <FontAwesome name="file-text-o" size={18} color={DS.color.background} />
            <Text style={styles.openDocTxt}>
              {documentOpened ? 'Re-open submitted document' : 'Open submitted document (required)'}
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.hint}>No attachment on this proposal — document review is not required.</Text>
        )}

        {row.status !== 'pending' ? (
          <Text style={styles.decided}>
            Reviewed {row.reviewed_at ? new Date(row.reviewed_at).toLocaleString() : ''} — decision is
            final.
          </Text>
        ) : null}
      </ScrollView>

      {row.status === 'pending' ? (
        <View style={[styles.actions, { paddingBottom: insets.bottom + DS.space.md }]}>
          <Pressable
            style={[styles.rejectBtn, (!canDecide || reviewing) && styles.btnDisabled]}
            disabled={!canDecide || reviewing}
            onPress={() => void decide('rejected')}
          >
            <FontAwesome name="times" size={22} color={DS.color.white} />
          </Pressable>
          <Pressable
            style={[styles.approveBtn, (!canDecide || reviewing) && styles.btnDisabled]}
            disabled={!canDecide || reviewing}
            onPress={() => void decide('approved')}
          >
            <FontAwesome name="check" size={22} color={DS.color.background} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.color.background },
  scroll: { paddingHorizontal: DS.space.base, paddingTop: DS.space.md },
  kind: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 12,
    color: DS.color.gold,
    letterSpacing: 1,
  },
  author: {
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.textMuted,
    marginBottom: DS.space.lg,
  },
  field: { marginBottom: DS.space.md },
  fieldLabel: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 12,
    color: DS.color.textMuted,
    textTransform: 'capitalize',
  },
  fieldValue: {
    fontFamily: DS.font.body,
    fontSize: 15,
    color: DS.color.text,
    lineHeight: 22,
  },
  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DS.space.sm,
    borderWidth: 1,
    borderColor: DS.color.goldTint30,
    paddingVertical: 14,
    borderRadius: DS.radius.xl,
    marginTop: DS.space.md,
  },
  messageBtnTxt: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 15,
    color: DS.color.gold,
  },
  openDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DS.space.sm,
    backgroundColor: DS.color.gold,
    paddingVertical: 14,
    borderRadius: DS.radius.xl,
    marginTop: DS.space.md,
  },
  openDocTxt: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 15,
    fontWeight: '700',
    color: DS.color.background,
  },
  hint: {
    fontFamily: DS.font.body,
    fontSize: 13,
    color: DS.color.textMuted,
    marginTop: DS.space.md,
    lineHeight: 19,
  },
  decided: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 14,
    color: DS.color.gold,
    marginTop: DS.space.lg,
  },
  actions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: DS.space.xl,
    paddingTop: DS.space.md,
    backgroundColor: DS.color.overlayDark80,
  },
  approveBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: DS.color.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: DS.color.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.35 },
});
