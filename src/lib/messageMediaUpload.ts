import type { ComposerMedia } from './mediaComposer';
import { inferContentType, inferExt } from './mediaComposer';
import { getSupabase } from './supabase';
import { uriToBlob } from './uriToBlob';

/** Upload DM attachment to `media_assets` and return row id + public URL. */
export async function uploadMessageMedia(
  userId: string,
  conversationId: string,
  media: ComposerMedia,
): Promise<{ assetId: string; publicUrl: string } | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const blob = await (await fetch(media.uri)).blob();
    const ext = inferExt(media.kind, media.uri);
    const storage_path = `messages/${conversationId}/${userId}/${Date.now()}.${ext}`;
    const up = await supabase.storage.from('media_assets').upload(storage_path, blob, {
      contentType,
      upsert: false,
    });
    if (up.error) return null;
    const pub = supabase.storage.from('media_assets').getPublicUrl(storage_path);
    const public_url = pub.data.publicUrl ?? null;
    if (!public_url) return null;
    const { data, error } = await supabase
      .from('media_assets')
      .insert({
        owner_id: userId,
        kind: media.kind,
        storage_path,
        public_url,
        mime_type: contentType,
        visibility: 'public',
      })
      .select('id')
      .single();
    if (error || !data) return null;
    return { assetId: (data as { id: string }).id, publicUrl: public_url };
  } catch {
    return null;
  }
}
