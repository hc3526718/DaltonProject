import { Platform } from 'react-native';

export type PickedWebFile = {
  uri: string;
  mimeType?: string;
  name?: string;
};

/** Pick image or video on web via hidden file input. Returns blob: URI for upload. */
export function pickWebMediaFile(kind: 'image' | 'video'): Promise<PickedWebFile | null> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = kind === 'image' ? 'image/*' : 'video/*';
    input.style.display = 'none';
    document.body.appendChild(input);
    const cleanup = () => {
      input.remove();
    };
    input.onchange = () => {
      const file = input.files?.[0];
      cleanup();
      if (!file) {
        resolve(null);
        return;
      }
      const uri = URL.createObjectURL(file);
      resolve({ uri, mimeType: file.type, name: file.name });
    };
    input.oncancel = () => {
      cleanup();
      resolve(null);
    };
    input.click();
  });
}
