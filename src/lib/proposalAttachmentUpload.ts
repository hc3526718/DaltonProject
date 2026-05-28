import { getSupabase } from './supabase';

function inferExt(uri: string, fallback: string): string {
  const m = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  const ext = m?.[1]?.toLowerCase();
  if (ext && ext.length <= 8 && /^[a-z0-9]+$/.test(ext)) return ext;
  return fallback;
}

/** Upload proposal supplementary file to `media_assets` bucket. */
export async function uploadProposalAttachment(
  userId: string,
  proposalKind: string,
  localUri: string,
  fileName?: string,
): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const blob = await (await fetch(localUri)).blob();
    const ext = inferExt(localUri, fileName?.split('.').pop() ?? 'pdf');
    const rand = Math.random().toString(36).slice(2, 8);
    const storage_path = `proposals/${userId}/${proposalKind}-${Date.now()}-${rand}.${ext}`;
    const contentType = blob.type || 'application/octet-stream';
    const { error } = await supabase.storage
      .from('media_assets')
      .upload(storage_path, blob, { contentType, upsert: false });
    if (error) return null;
    const pub = supabase.storage.from('media_assets').getPublicUrl(storage_path);
    return pub.data.publicUrl ?? null;
  } catch {
    return null;
  }
}
