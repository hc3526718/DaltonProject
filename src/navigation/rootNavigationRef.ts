import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

export const rootNavigationRef = createNavigationContainerRef<RootStackParamList>();

export function openCommunityMessageThread(conversationId: string): void {
  const nav = rootNavigationRef;
  const go = (): boolean => {
    if (!nav.isReady()) return false;
    nav.navigate(
      'Main',
      {
        screen: 'Community',
        params: {
          screen: 'MessageThread',
          params: { conversationId },
        },
      } as never,
    );
    return true;
  };
  if (go()) return;
  queueMicrotask(() => {
    if (go()) return;
    setTimeout(() => void go(), 320);
  });
}

export function openCommunityMessagesInbox(): void {
  const nav = rootNavigationRef;
  const go = (): boolean => {
    if (!nav.isReady()) return false;
    nav.navigate(
      'Main',
      {
        screen: 'Community',
        params: { screen: 'MessagesInbox' },
      } as never,
    );
    return true;
  };
  if (go()) return;
  queueMicrotask(() => {
    if (go()) return;
    setTimeout(() => void go(), 320);
  });
}
