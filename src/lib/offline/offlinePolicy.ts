/** How long cached data remains readable while offline (ms). */
export const OFFLINE_TTL = {
  /** DM inbox + thread messages */
  messages: 7 * 24 * 60 * 60 * 1000,
  /** Settings help centre articles */
  helpCentre: 30 * 24 * 60 * 60 * 1000,
  /** Booked / seen events from last online session */
  eventsBooked: 14 * 24 * 60 * 60 * 1000,
  /** Event detail snapshots user opened while online */
  eventsSeen: 14 * 24 * 60 * 60 * 1000,
} as const;

export type OfflineCacheKey =
  | 'messages:inbox'
  | 'messages:thread'
  | 'help:centre'
  | 'events:booked'
  | 'events:seen';
