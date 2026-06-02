import { getSupabase } from './supabase';
import { readLocalFileAsArrayBuffer } from './readLocalFileBytes';

function inferImageExt(uri: string): string {
  const m = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  const ext = m?.[1]?.toLowerCase();
  if (ext && ext.length <= 5 && /^[a-z0-9]+$/.test(ext)) return ext;
  return 'jpg';
}

function inferImageContentType(uri: string): string {
  const ext = inferImageExt(uri);
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

export type ProfileImageUploadResult =
  | { ok: true; publicUrl: string }
  | { ok: false; error: string };

/** Upload profile avatar or banner to `media_assets` and return public URL. */
export async function uploadProfileImage(
  userId: string,
  uri: string,
  kind: 'avatar' | 'banner',
): Promise<ProfileImageUploadResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Not connected.' };
  try {
    const contentType = inferImageContentType(uri);
    const body = await readLocalFileAsArrayBuffer(uri);
    if (body.byteLength === 0) {
      return { ok: false, error: 'Image file is empty.' };
    }
    const ext = inferImageExt(uri);
    const rand = Math.random().toString(36).slice(2, 8);
    const storage_path = `profiles/${userId}/${kind}-${Date.now()}-${rand}.${ext}`;
    const { error } = await supabase.storage
      .from('media_assets')
      .upload(storage_path, body, { contentType, upsert: false });
    if (error) {
      if (__DEV__) console.warn('[uploadProfileImage]', error.message);
      return { ok: false, error: error.message || 'Storage upload failed.' };
    }
    const pub = supabase.storage.from('media_assets').getPublicUrl(storage_path);
    const publicUrl = pub.data.publicUrl ?? null;
    if (!publicUrl) return { ok: false, error: 'Could not resolve public URL.' };
    return { ok: true, publicUrl };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Upload failed.';
    return { ok: false, error: msg };
  }
}

/** Upload then persist avatar or banner on profiles (auto-save). */
export async function uploadAndSaveProfileImage(
  userId: string,
  uri: string,
  kind: 'avatar' | 'banner',
): Promise<ProfileImageUploadResult> {
  const uploaded = await uploadProfileImage(userId, uri, kind);
  if (!uploaded.ok) return uploaded;
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Not connected.' };
  const patch = kind === 'avatar' ? { avatar_url: uploaded.publicUrl } : { banner_url: uploaded.publicUrl };
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) return { ok: false, error: error.message };
  return uploaded;
}
