import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@dalton/media_watch_progress_v1';

export type MediaWatchEntry = {
  mediaId: string;
  title: string;
  thumb?: string;
  /** 0–1 fraction watched */
  progress: number;
  updatedAt: number;
};

type Store = Record<string, MediaWatchEntry>;

async function readStore(): Promise<Store> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Store;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeStore(store: Store): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(store));
}

export async function getMediaWatchProgress(mediaId: string): Promise<MediaWatchEntry | null> {
  const store = await readStore();
  return store[mediaId] ?? null;
}

export async function setMediaWatchProgress(entry: Omit<MediaWatchEntry, 'updatedAt'>): Promise<void> {
  if (entry.progress >= 0.98) {
    await clearMediaWatchProgress(entry.mediaId);
    return;
  }
  const store = await readStore();
  store[entry.mediaId] = { ...entry, updatedAt: Date.now() };
  await writeStore(store);
}

export async function clearMediaWatchProgress(mediaId: string): Promise<void> {
  const store = await readStore();
  delete store[mediaId];
  await writeStore(store);
}

function isDemoMediaId(mediaId: string): boolean {
  return mediaId.startsWith('demo:');
}

/** Drop stale / demo entries; pass known live `media_assets` ids when available. */
export async function pruneContinueWatching(validMediaIds?: Set<string>): Promise<void> {
  const store = await readStore();
  let changed = false;
  for (const [id, entry] of Object.entries(store)) {
    if (isDemoMediaId(id) || isDemoMediaId(entry.mediaId)) {
      delete store[id];
      changed = true;
      continue;
    }
    if (validMediaIds && !validMediaIds.has(id)) {
      delete store[id];
      changed = true;
    }
  }
  if (changed) await writeStore(store);
}

/** In progress: started but not finished (< 98%). */
export async function listContinueWatching(): Promise<MediaWatchEntry[]> {
  const store = await readStore();
  return Object.values(store)
    .filter(
      (e) =>
        !isDemoMediaId(e.mediaId) &&
        e.progress > 0.02 &&
        e.progress < 0.98,
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function listFullyWatchedIds(): Promise<Set<string>> {
  const store = await readStore();
  const ids = Object.values(store)
    .filter((e) => e.progress >= 0.98)
    .map((e) => e.mediaId);
  return new Set(ids);
}
