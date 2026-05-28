import { Alert } from 'react-native';
import type { ProposalKind } from '../roadmap/proposalService';
import {
  canSubmitContentProposal,
  contentProposalsUsedThisMonth,
  submitContentProposal,
} from '../roadmap/proposalService';
import { masterInstantPublish } from './masterInstantPublish';

export type ProposalSubmitInput = {
  kind: ProposalKind;
  payload: Record<string, unknown>;
  attachmentUrls?: string[];
  /** Local files for master media publish (uri + name). */
  localFiles?: { uri: string; name: string }[];
};

export type ProposalSubmitFlowResult =
  | { ok: true; id: string; publishedLive?: boolean }
  | { ok: false; error: string; limitReached?: boolean };

/** Client-side monthly cap check + submit (or master instant publish). */
export async function runProposalSubmitFlow(
  input: ProposalSubmitInput,
  options?: { masterControl?: boolean; userId?: string },
): Promise<ProposalSubmitFlowResult> {
  if (options?.masterControl && options.userId) {
    const published = await masterInstantPublish(
      options.userId,
      input.kind,
      input.payload,
      input.attachmentUrls ?? [],
      input.localFiles ?? [],
    );
    if (!published.ok) return { ok: false, error: published.error };
    const id =
      published.sponsorPageId ?? published.mediaAssetId ?? published.eventId ?? 'master-live';
    return { ok: true, id, publishedLive: true };
  }

  const allowed = await canSubmitContentProposal();
  if (!allowed) {
    const used = await contentProposalsUsedThisMonth();
    return {
      ok: false,
      limitReached: true,
      error: `You have used ${used} of 3 proposals this month. Wait until next month to submit again.`,
    };
  }

  const result = await submitContentProposal(input);
  if (!result.ok) {
    const limitReached =
      result.error.includes('3') && result.error.toLowerCase().includes('month');
    return { ok: false, error: result.error, limitReached };
  }
  return { ok: true, id: result.id };
}

export function showProposalSubmittedAlert(
  onOk: () => void,
  options?: { masterPublished?: boolean },
): void {
  if (options?.masterPublished) {
    Alert.alert('Published', 'Your content is now live in the app.', [{ text: 'OK', onPress: onOk }]);
    return;
  }
  Alert.alert(
    'Submitted for review',
    'Your proposal has been sent to the Dalton team. Please wait for a response — you cannot submit another copy of the same proposal here.',
    [{ text: 'OK', onPress: onOk }],
  );
}
