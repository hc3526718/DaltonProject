import { Alert, Linking, Platform } from 'react-native';
import type { RefObject } from 'react';
import type { View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

function safeFilename(reference: string): string {
  const base = reference.trim() || 'ticket';
  return `dalton-ticket-${base.replace(/[^a-zA-Z0-9-_]+/g, '-').slice(0, 48)}`;
}

async function captureTicketPng(shotRef: RefObject<View | null>): Promise<string> {
  await new Promise((r) => setTimeout(r, 120));
  return captureRef(shotRef, {
    format: 'png',
    quality: 1,
    result: Platform.OS === 'web' ? 'base64' : 'tmpfile',
  });
}

async function downloadOnWeb(dataUriOrPath: string, filename: string): Promise<void> {
  let href = dataUriOrPath;
  if (Platform.OS === 'web' && !dataUriOrPath.startsWith('data:')) {
    const res = await fetch(dataUriOrPath);
    const blob = await res.blob();
    href = URL.createObjectURL(blob);
  }
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  if (href.startsWith('blob:')) URL.revokeObjectURL(href);
}

async function shareTicketFile(
  uri: string,
  mimeType: string,
  uti: string,
  dialogTitle: string,
): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    Alert.alert('Save ticket', 'Sharing is not available on this device. Try a screenshot of the QR code.');
    return;
  }
  await Sharing.shareAsync(uri, {
    mimeType,
    UTI: uti,
    dialogTitle,
  });
}

async function savePngToCameraRoll(fileUri: string): Promise<'saved' | 'denied' | 'unavailable'> {
  try {
    const MediaLibrary = await import('expo-media-library');
    const perm = await MediaLibrary.requestPermissionsAsync(true);
    if (perm.status !== 'granted') {
      return 'denied';
    }
    await MediaLibrary.saveToLibraryAsync(fileUri);
    return 'saved';
  } catch {
    return 'unavailable';
  }
}

/** Save ticket QR strip as PNG — Photos on mobile, download on web, share sheet fallback. */
export async function saveTicketAsPng(
  shotRef: RefObject<View | null>,
  referenceCode: string,
): Promise<void> {
  try {
    const captured = await captureTicketPng(shotRef);
    const filename = `${safeFilename(referenceCode)}.png`;

    if (Platform.OS === 'web') {
      const dataUri = captured.startsWith('data:')
        ? captured
        : `data:image/png;base64,${captured}`;
      await downloadOnWeb(dataUri, filename);
      Alert.alert(
        'Download started',
        'Your browser should prompt to save the ticket image. Check Downloads if nothing appears.',
      );
      return;
    }

    const fileUri = captured.startsWith('file://') ? captured : `file://${captured}`;
    const roll = await savePngToCameraRoll(fileUri);

    if (roll === 'saved') {
      Alert.alert(
        'Saved to Photos',
        Platform.OS === 'ios'
          ? 'Your ticket QR was added to your camera roll.'
          : 'Your ticket QR was saved to your gallery.',
      );
      return;
    }

    if (roll === 'denied') {
      Alert.alert(
        'Photos permission',
        'Allow photo library access to save your ticket, or use Share to save the file another way.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => void Linking.openSettings(),
          },
          {
            text: 'Share instead',
            onPress: () =>
              void shareTicketFile(fileUri, 'image/png', 'public.png', 'Save ticket PNG'),
          },
        ],
      );
      return;
    }

    await shareTicketFile(fileUri, 'image/png', 'public.png', 'Save ticket PNG');
  } catch (e) {
    Alert.alert('Save ticket', e instanceof Error ? e.message : 'Could not save the ticket image.');
  }
}

/** Save ticket as PDF — share sheet / download (includes QR capture). */
export async function saveTicketAsPdf(
  shotRef: RefObject<View | null>,
  referenceCode: string,
): Promise<void> {
  try {
    const captured = await captureTicketPng(shotRef);
    let base64 = captured;
    if (captured.startsWith('file://') || (!captured.startsWith('data:') && Platform.OS !== 'web')) {
      const path = captured.startsWith('file://') ? captured : captured;
      base64 = await FileSystem.readAsStringAsync(path, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } else if (captured.startsWith('data:image')) {
      base64 = captured.split(',')[1] ?? captured;
    }

    const html = `<html><body style="margin:0;background:#0a0a0a;display:flex;justify-content:center;padding:16px;"><img src="data:image/png;base64,${base64}" style="width:100%;max-width:520px" alt="Ticket QR" /></body></html>`;
    const { uri: pdfUri } = await Print.printToFileAsync({ html });
    const filename = `${safeFilename(referenceCode)}.pdf`;

    if (Platform.OS === 'web') {
      await downloadOnWeb(pdfUri, filename);
      Alert.alert(
        'Download started',
        'Your browser should prompt to save the ticket PDF. Check Downloads if nothing appears.',
      );
      return;
    }

    Alert.alert(
      'Save ticket PDF',
      Platform.OS === 'ios'
        ? 'Choose “Save to Files” or add to your library from the share sheet.'
        : 'Choose where to save the PDF from the share sheet.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () =>
            void shareTicketFile(pdfUri, 'application/pdf', 'com.adobe.pdf', 'Save ticket PDF'),
        },
      ],
    );
  } catch (e) {
    Alert.alert('PDF', e instanceof Error ? e.message : 'Could not build a PDF.');
  }
}
