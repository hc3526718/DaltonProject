/** Read a local file URI (native or web blob:) into a Blob for Supabase storage upload. */
export async function uriToBlob(uri: string, mimeType?: string): Promise<Blob> {
  const res = await fetch(uri);
  if (!res.ok) {
    throw new Error(`Could not read file (${res.status})`);
  }
  const blob = await res.blob();
  if (mimeType && blob.type !== mimeType) {
    return blob.slice(0, blob.size, mimeType);
  }
  return blob;
}
