import { inferContentType, inferExt } from './mediaComposer';
import { getSupabase } from './supabase';
import type { MediaAssetRow } from '../roadmap/types';

export type CatalogMediaUploadResult =
  | { ok: true; asset: MediaAssetRow }
  | { ok: false; error: string };

/** Upload training/catalog video to storage + `media_assets` (public browse). */
export async function uploadCatalogMediaVideo(
  userId: string,
  localUri: string,
  meta: { title: string; description?: string },
): Promise<CatalogMediaUploadResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Not connected.' };
  try {
    const blob = await (await fetch(localUri)).blob();
    const ext = inferExt('video', localUri);
    const contentType = inferContentType('video', localUri);
    const rand = Math.random().toString(36).slice(2, 8);
    const storage_path = `catalog/${userId}/${Date.now()}-${rand}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('media_assets')
      .upload(storage_path, blob, { contentType, upsert: false });
    if (upErr) return { ok: false, error: upErr.message };
    const pub = supabase.storage.from('media_assets').getPublicUrl(storage_path);
    const public_url = pub.data.publicUrl ?? null;
    if (!public_url) return { ok: false, error: 'Could not resolve public URL.' };
    const { data, error } = await supabase
      .from('media_assets')
      .insert({
        owner_id: userId,
        kind: 'video',
        storage_path,
        public_url,
        mime_type: contentType,
        visibility: 'public',
      })
      .select('*')
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? 'Could not save media record.' };
    }
    void meta;
    return { ok: true, asset: data as MediaAssetRow };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Upload failed.' };
  }
}
