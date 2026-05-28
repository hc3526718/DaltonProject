import { assertCanMessageRecipient } from '../messaging/messagingPolicy';
import type { AllowMessagesFrom } from '../messaging/messagingPrefs';
import { fetchProfileByUserId } from './profileService';
import { isUserFollowing } from './followService';
import { getSupabase } from '../lib/supabase';

export type MessagePeerGate =
  | { ok: true }
  | { ok: false; message: string };

export async function resolveCanMessagePeer(
  viewerId: string,
  peerUserId: string,
): Promise<MessagePeerGate> {
  if (!viewerId || !peerUserId || viewerId === peerUserId) {
    return { ok: false, message: 'Invalid recipient.' };
  }

  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase.rpc('can_message_peer', {
      other_user_id: peerUserId,
    });
    if (!error && data === false) {
      return {
        ok: false,
        message: 'This user does not accept messages from you. Follow them or check their privacy settings.',
      };
    }
    if (!error && data === true) {
      return { ok: true };
    }
  }

  const profile = await fetchProfileByUserId(peerUserId);
  const pref = (profile?.allow_messages_from ?? 'everyone') as AllowMessagesFrom;
  const following = await isUserFollowing(viewerId, peerUserId);
  const mutual = following && (await isUserFollowing(peerUserId, viewerId));
  const gate = assertCanMessageRecipient({
    recipientPref: pref,
    isFollowingRecipient: following,
    isMutualFriend: mutual,
  });
  if (!gate.ok) {
    return {
      ok: false,
      message:
        gate.reason === 'recipient_blocks_unknown'
          ? 'This user only accepts messages from people they follow or mutual connections.'
          : 'You cannot message this user.',
    };
  }
  return { ok: true };
}
