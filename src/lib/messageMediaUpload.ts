import type { ComposerMedia } from './mediaComposer';
import { inferContentType, inferExt } from './mediaComposer';
import { getSupabase } from './supabase';
import { uploadLocalUriToStorage } from './uploadLocalFile';

/** Upload DM attachment to `media_assets` and return row id + public URL. */
export async function uploadMessageMedia(
  userId: string,
  conversationId: string,
  media: ComposerMedia,
): Promise<{ assetId: string; publicUrl: string } | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const contentType = media.mimeType ?? inferContentType(media.kind, media.uri);
  const ext = inferExt(media.kind, media.uri);
  const storage_path = `messages/${conversationId}/${userId}/${Date.now()}.${ext}`;
  const up = await uploadLocalUriToStorage(supabase, 'media_assets', storage_path, media.uri, contentType);
  if (!up.ok) return null;
  const { data, error } = await supabase
    .from('media_assets')
    .insert({
      owner_id: userId,
      kind: media.kind,
      storage_path,
      public_url: up.publicUrl,
      mime_type: contentType,
      visibility: 'public',
    })
    .select('id')
    .single();
  if (error || !data) return null;
  return { assetId: (data as { id: string }).id, publicUrl: up.publicUrl };
}
