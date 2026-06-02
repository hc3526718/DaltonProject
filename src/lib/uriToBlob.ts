import { Platform } from 'react-native';
import { readLocalFileAsArrayBuffer } from './readLocalFileBytes';

/** Read a local file URI into a Blob (web only — native uploads should use `uploadLocalUriToStorage`). */
export async function uriToBlob(uri: string, mimeType?: string): Promise<Blob> {
  if (Platform.OS !== 'web') {
    throw new Error(
      'uriToBlob is not supported on native. Use uploadLocalUriToStorage with ArrayBuffer instead.',
    );
  }
  const buffer = await readLocalFileAsArrayBuffer(uri);
  return new Blob([buffer], { type: mimeType ?? 'application/octet-stream' });
}
