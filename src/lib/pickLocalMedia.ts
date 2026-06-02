import { Alert, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { pickWebMediaFile } from './webFilePicker';

export type PickedLocalFile = {
  uri: string;
  name: string;
  kind: 'image' | 'video';
};

async function pickFromPhotoLibrary(
  kind: 'image' | 'video',
  multiple: boolean,
): Promise<PickedLocalFile[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Permission needed', 'Allow photo library access to choose media.');
    return [];
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: kind === 'video' ? ['videos'] : ['images'],
    allowsMultipleSelection: multiple && kind === 'image',
    quality: 0.92,
    videoMaxDuration: kind === 'video' ? 300 : undefined,
    preferredAssetRepresentationMode:
      kind === 'video' ? ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible : undefined,
  });
  if (res.canceled) return [];
  return res.assets
    .filter((a) => a.uri)
    .map((a) => ({
      uri: a.uri,
      name: a.fileName ?? (kind === 'video' ? 'video.mp4' : 'image.jpg'),
      kind,
    }));
}

async function pickFromFiles(kind: 'image' | 'video', multiple: boolean): Promise<PickedLocalFile[]> {
  const res = await DocumentPicker.getDocumentAsync({
    multiple,
    copyToCacheDirectory: true,
    type: kind === 'video' ? 'video/*' : 'image/*',
  });
  if (res.canceled) return [];
  return res.assets
    .filter((a) => a.uri)
    .map((a) => ({
      uri: a.uri,
      name: a.name ?? (kind === 'video' ? 'video.mp4' : 'image.jpg'),
      kind,
    }));
}

/**
 * Photo library or device files (master wizards, highlights, sponsor media).
 */
export function pickLocalMedia(
  kind: 'image' | 'video',
  options?: { multiple?: boolean; title?: string },
): Promise<PickedLocalFile[]> {
  const multiple = options?.multiple ?? false;
  if (Platform.OS === 'web') {
    return pickWebMediaFile(kind).then((f) =>
      f ? [{ uri: f.uri, name: f.name || (kind === 'video' ? 'video.mp4' : 'image.jpg'), kind }] : [],
    );
  }
  const videoHint =
    kind === 'video'
      ? 'Large clips: use Browse files (under 50 MB). Photo library may fail for iCloud-only videos.'
      : undefined;

  return new Promise((resolve) => {
    const sources =
      kind === 'video'
        ? [
            {
              text: 'Browse files',
              onPress: () => {
                void pickFromFiles(kind, multiple).then(resolve);
              },
            },
            {
              text: 'Photo library',
              onPress: () => {
                void pickFromPhotoLibrary(kind, multiple).then(resolve);
              },
            },
          ]
        : [
            {
              text: 'Photo library',
              onPress: () => {
                void pickFromPhotoLibrary(kind, multiple).then(resolve);
              },
            },
            {
              text: 'Browse files',
              onPress: () => {
                void pickFromFiles(kind, multiple).then(resolve);
              },
            },
          ];

    Alert.alert(
      options?.title ?? (kind === 'video' ? 'Add video' : 'Add image'),
      videoHint ?? 'Choose a source',
      [...sources, { text: 'Cancel', style: 'cancel', onPress: () => resolve([]) }],
    );
  });
}

export function pickLocalImage(options?: { multiple?: boolean; title?: string }): Promise<PickedLocalFile[]> {
  return pickLocalMedia('image', options);
}

export function pickLocalVideo(options?: { title?: string }): Promise<PickedLocalFile[]> {
  return pickLocalMedia('video', { ...options, multiple: false });
}

async function pickComposerFromPhotoLibrary(): Promise<PickedLocalFile[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Permission needed', 'Allow photo library access to choose media.');
    return [];
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: true,
    quality: 0.92,
    videoMaxDuration: 300,
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  if (res.canceled) return [];
  return res.assets
    .filter((a) => a.uri)
    .map((a) => ({
      uri: a.uri,
      name: a.fileName ?? (a.type === 'video' ? 'video.mp4' : 'image.jpg'),
      kind: (a.type === 'video' ? 'video' : 'image') as 'image' | 'video',
    }));
}

async function pickComposerFromFiles(): Promise<PickedLocalFile[]> {
  const res = await DocumentPicker.getDocumentAsync({
    multiple: true,
    copyToCacheDirectory: true,
    type: ['image/*', 'video/*'],
  });
  if (res.canceled) return [];
  return res.assets
    .filter((a) => a.uri)
    .map((a) => {
      const name = a.name ?? 'file';
      const isVideo = /^video\//i.test(a.mimeType ?? '') || /\.(mp4|mov|m4v|webm)$/i.test(name);
      return {
        uri: a.uri,
        name,
        kind: isVideo ? ('video' as const) : ('image' as const),
      };
    });
}

/** Photos and videos for community post composer (library or files). */
export function pickLocalComposerMedia(options?: { title?: string }): Promise<PickedLocalFile[]> {
  if (Platform.OS === 'web') {
    return pickWebMediaFile('image').then((f) =>
      f ? [{ uri: f.uri, name: f.name || 'image.jpg', kind: 'image' as const }] : [],
    );
  }
  return new Promise((resolve) => {
    Alert.alert(options?.title ?? 'Add media', 'Choose a source', [
      {
        text: 'Photo library',
        onPress: () => {
          void pickComposerFromPhotoLibrary().then(resolve);
        },
      },
      {
        text: 'Browse files',
        onPress: () => {
          void pickComposerFromFiles().then(resolve);
        },
      },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve([]) },
    ]);
  });
}
