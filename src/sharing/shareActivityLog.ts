import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'dalton_share_activity_v1';
const MAX = 40;

export type ShareActivityEntry = {
  at: number;
  kind: 'post' | 'external';
  title: string;
  detail?: string;
};

export async function logShareActivity(entry: Omit<ShareActivityEntry, 'at'>): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const prev: ShareActivityEntry[] = raw ? (JSON.parse(raw) as ShareActivityEntry[]) : [];
    const next: ShareActivityEntry[] = [{ ...entry, at: Date.now() }, ...prev].slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export async function loadShareActivity(): Promise<ShareActivityEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ShareActivityEntry[];
  } catch {
    return [];
  }
}
