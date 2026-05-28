import type { ConversationSummary } from '../../roadmap/messagingService';
import type { MessageRow } from '../../roadmap/types';
import { readOfflineCache, writeOfflineCache } from './offlineCache';
import { OFFLINE_TTL } from './offlinePolicy';

export async function cacheMessageInbox(userId: string, rows: ConversationSummary[]): Promise<void> {
  await writeOfflineCache('messages:inbox', rows, OFFLINE_TTL.messages, userId);
}

export async function loadCachedMessageInbox(userId: string): Promise<ConversationSummary[] | null> {
  return readOfflineCache<ConversationSummary[]>('messages:inbox', userId);
}

export async function cacheMessageThread(
  conversationId: string,
  messages: MessageRow[],
): Promise<void> {
  await writeOfflineCache('messages:thread', messages, OFFLINE_TTL.messages, conversationId);
}

export async function loadCachedMessageThread(conversationId: string): Promise<MessageRow[] | null> {
  return readOfflineCache<MessageRow[]>('messages:thread', conversationId);
}
