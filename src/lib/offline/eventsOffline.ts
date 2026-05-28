import type { BookingWithEvent } from '../../roadmap/types';
import { readOfflineCache, writeOfflineCache } from './offlineCache';
import { OFFLINE_TTL } from './offlinePolicy';

export async function cacheBookedEvents(userId: string, bookings: BookingWithEvent[]): Promise<void> {
  await writeOfflineCache('events:booked', bookings, OFFLINE_TTL.eventsBooked, userId);
}

export async function loadCachedBookedEvents(userId: string): Promise<BookingWithEvent[] | null> {
  return readOfflineCache<BookingWithEvent[]>('events:booked', userId);
}

export type SeenEventSnapshot = {
  eventStorageKey: string;
  title: string;
  imageUri?: string;
  seenAt: number;
};

export async function rememberSeenEvent(userId: string, snapshot: SeenEventSnapshot): Promise<void> {
  const existing = (await readOfflineCache<SeenEventSnapshot[]>('events:seen', userId)) ?? [];
  const next = [snapshot, ...existing.filter((e) => e.eventStorageKey !== snapshot.eventStorageKey)].slice(
    0,
    40,
  );
  await writeOfflineCache('events:seen', next, OFFLINE_TTL.eventsSeen, userId);
}

export async function loadSeenEvents(userId: string): Promise<SeenEventSnapshot[]> {
  return (await readOfflineCache<SeenEventSnapshot[]>('events:seen', userId)) ?? [];
}
