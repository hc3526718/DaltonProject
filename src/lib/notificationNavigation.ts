import type { NavigationProp } from '@react-navigation/native';
import type { MainTabParamList } from '../navigation/types';
import { requestProposalOutcomeModal } from './proposalOutcomeBridge';

export type NotificationIconKind =
  | 'message'
  | 'proposal'
  | 'event'
  | 'post'
  | 'follow'
  | 'system';

export function notificationIconForLink(
  linkType?: string | null,
  title?: string,
): NotificationIconKind {
  const t = (title ?? '').toLowerCase();
  const lt = (linkType ?? '').toLowerCase();
  if (lt.includes('message') || lt === 'dm' || t.includes('message')) return 'message';
  if (lt.includes('proposal') || t.includes('proposal')) return 'proposal';
  if (lt.includes('event') || t.includes('event')) return 'event';
  if (lt.includes('post') || t.includes('post')) return 'post';
  if (lt.includes('follow')) return 'follow';
  return 'system';
}

/** Navigate from an in-app notification row tap. */
export function navigateFromInAppNotification(
  navigation: NavigationProp<MainTabParamList>,
  linkType?: string | null,
  linkId?: string | null,
  _title?: string,
): boolean {
  const lt = (linkType ?? '').trim().toLowerCase();
  const id = linkId?.trim();

  if (lt === 'proposal_outcome' && id) {
    requestProposalOutcomeModal(id);
    return true;
  }
  if ((lt === 'proposal' || lt === 'content_proposal') && id) {
    navigation.navigate('Profile', {
      screen: 'MyProposals',
    } as never);
    return true;
  }
  if (lt === 'conversation' || lt === 'dm' || lt === 'message') {
    if (id) {
      navigation.navigate('Community', {
        screen: 'MessageThread',
        params: { conversationId: id },
      } as never);
      return true;
    }
    navigation.navigate('Community', { screen: 'MessagesInbox' } as never);
    return true;
  }
  if (lt === 'event' && id) {
    navigation.navigate('Events', {
      screen: 'EventDetails',
      params: { supabaseEventId: id },
    } as never);
    return true;
  }
  if (lt === 'post' && id) {
    navigation.navigate('Community', { screen: 'CommunityFeed' } as never);
    return true;
  }
  return false;
}
