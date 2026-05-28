import { fetchUserPrefsDoc, patchUserPrefsDoc, type UserPrefsDoc } from '../roadmap/userSettingsService';

const MAX_SAVED = 120;

export async function listSavedMediaIds(userId: string): Promise<string[]> {
  const doc = await fetchUserPrefsDoc(userId);
  const raw = (doc as { saved_media_ids?: unknown }).saved_media_ids;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string').slice(0, MAX_SAVED);
}

export async function toggleSavedMediaId(userId: string, mediaId: string): Promise<boolean> {
  const ids = await listSavedMediaIds(userId);
  const set = new Set(ids);
  if (set.has(mediaId)) set.delete(mediaId);
  else {
    set.add(mediaId);
    if (set.size > MAX_SAVED) {
      const arr = [...set];
      arr.shift();
      set.clear();
      arr.forEach((id) => set.add(id));
    }
  }
  const patch: Partial<UserPrefsDoc> = { saved_media_ids: [...set] };
  return patchUserPrefsDoc(userId, patch);
}

export async function isMediaIdSaved(userId: string, mediaId: string): Promise<boolean> {
  const ids = await listSavedMediaIds(userId);
  return ids.includes(mediaId);
}
