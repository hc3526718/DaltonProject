import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'dalton_master_gate_v1';

type Payload = { userId: string; until: number };

export async function setMasterGateUnlocked(userId: string, minutes = 25): Promise<void> {
  const until = Date.now() + minutes * 60_000;
  await AsyncStorage.setItem(KEY, JSON.stringify({ userId, until } satisfies Payload));
}

export async function isMasterGateUnlocked(userId: string): Promise<boolean> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return false;
  try {
    const j = JSON.parse(raw) as Payload;
    if (j.userId !== userId) return false;
    return Date.now() < j.until;
  } catch {
    return false;
  }
}

export async function clearMasterGate(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
