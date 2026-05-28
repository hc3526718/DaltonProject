import AsyncStorage from '@react-native-async-storage/async-storage';

const RECENT_KEY = 'dalton_events_recent_searches';
const SAVED_KEY = 'dalton_events_saved_keys';
const MAX_RECENT = 12;

export async function getRecentEventSearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function addRecentEventSearch(query: string): Promise<void> {
  const q = query.trim();
  if (q.length < 2) return;
  const prev = await getRecentEventSearches();
  const next = [q, ...prev.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, MAX_RECENT);
  await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export async function clearRecentEventSearches(): Promise<void> {
  await AsyncStorage.removeItem(RECENT_KEY);
}

export async function getSavedEventKeys(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    const list = Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
    return new Set(list);
  } catch {
    return new Set();
  }
}

export async function addSavedEventKey(key: string): Promise<void> {
  const s = await getSavedEventKeys();
  s.add(key);
  await AsyncStorage.setItem(SAVED_KEY, JSON.stringify([...s]));
}

export async function removeSavedEventKey(key: string): Promise<void> {
  const s = await getSavedEventKeys();
  s.delete(key);
  await AsyncStorage.setItem(SAVED_KEY, JSON.stringify([...s]));
}

export async function isEventKeySaved(key: string): Promise<boolean> {
  const s = await getSavedEventKeys();
  return s.has(key);
}

export function unifiedEventSlug(params: {
  source: 'db' | 'html';
  id?: string | null;
  title: string;
  dateHint?: string;
}): string {
  if (params.source === 'db' && params.id) return `db:${params.id}`;
  const t = params.title.trim().slice(0, 80).toLowerCase().replace(/\s+/g, '-');
  return `html:${t}:${params.dateHint ?? ''}`;
}
