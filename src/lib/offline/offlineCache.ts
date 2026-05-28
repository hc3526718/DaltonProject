import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OfflineCacheKey } from './offlinePolicy';

type CacheEnvelope<T> = {
  savedAt: number;
  ttlMs: number;
  data: T;
};

function storageKey(key: OfflineCacheKey, suffix?: string): string {
  return `@dalton/offline/${key}${suffix ? `/${suffix}` : ''}`;
}

export async function writeOfflineCache<T>(
  key: OfflineCacheKey,
  data: T,
  ttlMs: number,
  suffix?: string,
): Promise<void> {
  const envelope: CacheEnvelope<T> = { savedAt: Date.now(), ttlMs, data };
  await AsyncStorage.setItem(storageKey(key, suffix), JSON.stringify(envelope));
}

export async function readOfflineCache<T>(
  key: OfflineCacheKey,
  suffix?: string,
): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(key, suffix));
    if (!raw) return null;
    const envelope = JSON.parse(raw) as CacheEnvelope<T>;
    if (!envelope?.savedAt || !envelope.ttlMs) return null;
    if (Date.now() - envelope.savedAt > envelope.ttlMs) {
      await AsyncStorage.removeItem(storageKey(key, suffix));
      return null;
    }
    return envelope.data;
  } catch {
    return null;
  }
}

export async function clearOfflineCache(key: OfflineCacheKey, suffix?: string): Promise<void> {
  await AsyncStorage.removeItem(storageKey(key, suffix));
}
