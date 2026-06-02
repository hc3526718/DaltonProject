import AsyncStorage from '@react-native-async-storage/async-storage';

const RECENT_KEY = 'dalton_community_recent_searches';
const MAX_RECENT = 12;

export async function getRecentCommunitySearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function addRecentCommunitySearch(query: string): Promise<void> {
  const q = query.trim();
  if (q.length < 1) return;
  const prev = await getRecentCommunitySearches();
  const next = [q, ...prev.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, MAX_RECENT);
  await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export async function removeRecentCommunitySearch(query: string): Promise<void> {
  const prev = await getRecentCommunitySearches();
  const next = prev.filter((x) => x !== query);
  await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
}
