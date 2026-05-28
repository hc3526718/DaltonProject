import type { AllowMessagesFrom } from './messagingPrefs';

export type MessageGateReason = 'ok' | 'recipient_blocks_unknown' | 'sender_must_follow';

/**
 * When the recipient restricts DMs, block new threads from senders who are not allowed contacts.
 */
export function assertCanMessageRecipient(params: {
  recipientPref: AllowMessagesFrom;
  isFollowingRecipient: boolean;
  isMutualFriend?: boolean;
}): { ok: true } | { ok: false; reason: MessageGateReason } {
  const { recipientPref, isFollowingRecipient, isMutualFriend = false } = params;
  if (recipientPref === 'everyone') {
    return { ok: true };
  }
  if (recipientPref === 'followers_only') {
    if (isFollowingRecipient) return { ok: true };
    return { ok: false, reason: 'recipient_blocks_unknown' };
  }
  if (recipientPref === 'friends_only') {
    if (isMutualFriend) return { ok: true };
    return { ok: false, reason: 'recipient_blocks_unknown' };
  }
  return { ok: true };
}
