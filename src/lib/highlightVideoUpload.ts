import { getSupabase } from './supabase';
import { uriToBlob } from './uriToBlob';

/** Upload highlight clip to storage; returns public HTTPS URL. */
export async function uploadHighlightVideo(userId: string, uri: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const contentType = 'video/mp4';
    const blob = await uriToBlob(uri, contentType);
    const storage_path = `profiles/${userId}/highlights/${Date.now()}.mp4`;
    const { error } = await supabase.storage
      .from('media_assets')
      .upload(storage_path, blob, { contentType, upsert: false });
    if (error) return null;
    return supabase.storage.from('media_assets').getPublicUrl(storage_path).data.publicUrl ?? null;
  } catch {
    return null;
  }
}
