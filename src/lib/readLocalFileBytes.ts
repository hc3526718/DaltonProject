import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/** Read a device file URI into bytes for Supabase storage (RN Blob upload is unreliable). */
export async function readLocalFileAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const trimmed = uri.trim();
  if (!trimmed) {
    throw new Error('Missing file URI');
  }

  if (Platform.OS === 'web') {
    const res = await fetch(trimmed);
    if (!res.ok) {
      throw new Error(`Could not read file (${res.status})`);
    }
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength === 0) {
      throw new Error('File is empty');
    }
    return buffer;
  }

  try {
    const file = new File(trimmed);
    const buffer = await file.arrayBuffer();
    if (buffer.byteLength > 0) {
      return buffer;
    }
  } catch {
    /* try legacy */
  }

  const base64 = await FileSystemLegacy.readAsStringAsync(trimmed, {
    encoding: FileSystemLegacy.EncodingType.Base64,
  });
  if (!base64.length) {
    throw new Error('File is empty');
  }
  const buffer = base64ToArrayBuffer(base64);
  if (buffer.byteLength === 0) {
    throw new Error('File is empty');
  }
  return buffer;
}
