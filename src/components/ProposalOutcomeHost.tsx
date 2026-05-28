import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { getSupabase } from '../lib/supabase';
import { isSupabaseConfigured } from '../lib/env';
import { useActionBanner } from '../actionBanner/ActionBannerContext';
import {
  fetchProposalById,
  listAuthorPendingOutcomeProposals,
  type ContentProposalRow,
} from '../roadmap/proposalService';
import { registerProposalOutcomeOpener } from '../lib/proposalOutcomeBridge';
import { ProposalOutcomeModal } from './ProposalOutcomeModal';

/**
 * Shows proposal decision modal on cold start / login; while app is active, decision
 * notifications only show a tappable banner that opens the modal.
 */
export function ProposalOutcomeHost({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const showBanner = useActionBanner();
  const [modalProposal, setModalProposal] = useState<ContentProposalRow | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const appActiveSince = useRef(Date.now());
  const initialModalDone = useRef(false);

  const openModal = useCallback(async (proposalId: string) => {
    const row = await fetchProposalById(proposalId);
    if (!row || !row.show_author_modal) return;
    setModalProposal(row);
    setModalVisible(true);
  }, []);

  useEffect(() => {
    registerProposalOutcomeOpener((id) => {
      void openModal(id);
    });
    return () => registerProposalOutcomeOpener(() => {});
  }, [openModal]);

  const checkPendingOnLaunch = useCallback(async () => {
    if (!user?.id || user.id.startsWith('demo-') || !isSupabaseConfigured()) return;
    const pending = await listAuthorPendingOutcomeProposals();
    if (pending.length > 0 && !initialModalDone.current) {
      initialModalDone.current = true;
      await openModal(pending[0]!.id);
    }
  }, [openModal, user?.id]);

  useEffect(() => {
    initialModalDone.current = false;
    void checkPendingOnLaunch();
  }, [checkPendingOnLaunch, user?.id]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        appActiveSince.current = Date.now();
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!user?.id || user.id.startsWith('demo-')) return;
    const supabase = getSupabase();
    if (!supabase) return;

    const channel = supabase
      .channel(`proposal-outcome-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'in_app_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as {
            link_type?: string | null;
            link_id?: string | null;
            title?: string;
            body?: string;
          };
          if (row.link_type !== 'proposal_outcome' || !row.link_id) return;

          const msSinceActive = Date.now() - appActiveSince.current;
          const appWasRunning = msSinceActive < 120_000 && initialModalDone.current;

          if (appWasRunning) {
            showBanner(row.title ?? 'Proposal update', row.body ?? 'Tap to view', {
              onPress: () => void openModal(row.link_id!),
            });
            return;
          }
          void openModal(row.link_id);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [openModal, showBanner, user?.id]);

  return (
    <>
      {children}
      <ProposalOutcomeModal
        visible={modalVisible}
        proposal={modalProposal}
        onClose={() => {
          setModalVisible(false);
          setModalProposal(null);
        }}
      />
    </>
  );
}
