import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FontAwesome } from '@expo/vector-icons';
import { useActionBanner } from '../actionBanner/ActionBannerContext';
import { verifyTicketToken } from '../booking/ticketToken';
import { DS } from '../designSystem';
import { getSupabase } from '../lib/supabase';
import { isSupabaseConfigured } from '../lib/env';
import type { EventsStackParamList } from '../navigation/types';
import { getEventById, hostCheckInByReference } from '../roadmap/liveDataService';

/** Header icon — monochrome asset; tint matches non-gold app icons (`DS.color.text`). */
export const QR_SCAN_ICON = require('../../assets/qr_code_scanning.png');

type Nav = NativeStackNavigationProp<EventsStackParamList, 'HostAttendeeScan'>;

function extractQrPayload(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  try {
    if (s.startsWith('http://') || s.startsWith('https://')) {
      const u = new URL(s);
      const q = u.searchParams.get('t') ?? u.searchParams.get('payload') ?? u.searchParams.get('code');
      if (q) return decodeURIComponent(q);
      const hash = u.hash.startsWith('#') ? u.hash.slice(1) : u.hash;
      const hp = new URLSearchParams(hash);
      return hp.get('t') ?? hp.get('payload') ?? s;
    }
  } catch {
    /* fallback */
  }
  return s;
}

export type HostAttendeeScanScreenProps = { navigation: Nav };

export function HostAttendeeScanScreen({ navigation }: HostAttendeeScanScreenProps) {
  const route = useRoute<RouteProp<EventsStackParamList, 'HostAttendeeScan'>>();
  const selectedEventId = route.params?.selectedEventId;

  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [lastPayload, setLastPayload] = useState('');
  const [scanTitle, setScanTitle] = useState('');
  const showActionBanner = useActionBanner();

  const canCam = Platform.OS !== 'web';

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    if (!selectedEventId) {
      navigation.replace('HostScanPickEvent');
    }
  }, [navigation, selectedEventId]);

  useEffect(() => {
    if (!selectedEventId) return;
    void getEventById(selectedEventId).then((ev) => {
      if (ev?.title) setScanTitle(ev.title);
    });
  }, [selectedEventId]);

  useEffect(() => {
    if (!canCam || permission?.granted) return;
    void requestPermission();
  }, [canCam, permission?.granted, requestPermission]);

  const processScanToken = useCallback(
    async (raw: string) => {
      const token = extractQrPayload(raw).trim();
      if (!token) return;
      if (!selectedEventId) {
        Alert.alert(
          'Choose an event first',
          'Go back and select which event you are scanning attendance for.',
        );
        return;
      }
      if (busy) return;

      const v = await verifyTicketToken(token);
      if (!v.ok) {
        showActionBanner('Invalid QR', v.reason);
        return;
      }

      if (v.payload.eventId && v.payload.eventId !== selectedEventId) {
        Alert.alert(
          'Wrong event',
          'This QR code is for a different event than the one you selected. The attendee has not been checked in. Choose the matching event from the list, or ask them to open the correct booking ticket.',
          [{ text: 'OK' }],
        );
        return;
      }

      if (!v.payload.eventId) {
        showActionBanner(
          'Ticket missing event',
          'This QR has no event id. Re-book to generate a new ticket.',
        );
        return;
      }

      setBusy(true);
      try {
        if (!isSupabaseConfigured()) {
          showActionBanner('Checked in', `Ref ${v.payload.ref}`);
          return;
        }

        const supabase = getSupabase();
        if (!supabase) {
          showActionBanner('Offline', 'Supabase client not configured.');
          return;
        }

        const host = await hostCheckInByReference(v.payload.ref);
        if (!host.ok) {
          showActionBanner(
            'Could not check in',
            host.reason ??
              'Ensure you deployed `backend/rpc_host_check_in.sql` and you created this event.',
          );
          return;
        }

        const titleEv = host.eventTitle ?? 'Event';

        showActionBanner(
          host.alreadyCheckedIn ? 'Already checked in' : 'Attendance confirmed',
          `${titleEv} · ${v.payload.uid} · Ref ${v.payload.ref}`,
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, selectedEventId, showActionBanner],
  );

  const onBarcodeScanned = useCallback(
    (raw: string) => {
      if (!raw || raw === lastPayload) return;
      setLastPayload(raw);
      void processScanToken(raw);
    },
    [lastPayload, processScanToken],
  );

  const body = useMemo(() => {
    if (!canCam) {
      return (
        <View style={styles.noCam}>
          <Text style={styles.help}>Camera QR scan works on native iOS / Android builds.</Text>
        </View>
      );
    }
    if (!permission?.granted) {
      return (
        <Pressable style={styles.permBtn} onPress={() => void requestPermission()}>
          <Text style={styles.permTxt}>Enable camera access</Text>
        </Pressable>
      );
    }
    return (
      <View style={styles.camWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          facing="back"
          onBarcodeScanned={(e) => onBarcodeScanned(String(e.data || ''))}
        />
        <ScanMaskOverlay />
      </View>
    );
  }, [canCam, permission?.granted, requestPermission, onBarcodeScanned]);

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: insets.top + DS.space.sm }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
          <FontAwesome name="arrow-left" size={22} color={DS.color.text} />
        </Pressable>
        <Text style={styles.title}>CHECK IN ATTENDEES</Text>
        <View style={{ width: 40 }} />
      </View>
      {scanTitle ? (
        <Text style={styles.scanningFor} numberOfLines={2}>
          Scanning for:{' '}
          <Text style={styles.scanningForGold}>{scanTitle}</Text>
        </Text>
      ) : selectedEventId ? (
        <Text style={styles.scanningForMuted}>Loading event…</Text>
      ) : null}
      {body}
      {busy ? (
        <View style={styles.busyBadge} pointerEvents="none">
          <Text style={styles.busyTxt}>Processing…</Text>
        </View>
      ) : null}
    </View>
  );
}

const FRAME_SIZE = Math.min(300, 300);

function ScanMaskOverlay() {
  const dim = 'rgba(0,0,0,0.62)';
  return (
    <View style={scanMask.absolute} pointerEvents="none">
      <View style={{ flex: 1.1, backgroundColor: dim }}>
        <Text style={scanMask.hint}>Scan QR / Wallet pass QR inside the frame</Text>
        <Image source={QR_SCAN_ICON} style={scanMask.qrGraphic} tintColor={DS.color.text} />
      </View>
      <View style={scanMask.midRow}>
        <View style={scanMask.sideDim(dim)} />
        <View style={scanMask.window} />
        <View style={scanMask.sideDim(dim)} />
      </View>
      <View style={[scanMask.bottomDim(dim)]}>
        <Text style={scanMask.micro}>Bookings QR from the attendee confirmation screen also work.</Text>
      </View>
    </View>
  );
}

const scanMask = StyleSheet.create({
  absolute: { ...StyleSheet.absoluteFillObject, zIndex: 2 },
  midRow: { flexDirection: 'row', height: FRAME_SIZE },
  window: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: DS.color.goldTint30,
    backgroundColor: 'transparent',
  },
  sideDim: (dark: string) =>
    ({
      flex: 1,
      height: FRAME_SIZE,
      backgroundColor: dark,
    }) as const,
  bottomDim: (dark: string) =>
    ({
      flex: 1.4,
      width: '100%',
      backgroundColor: dark,
    }) as const,
  hint: {
    marginTop: 48,
    textAlign: 'center',
    color: DS.color.white,
    fontFamily: DS.font.bodyMedium,
    fontSize: 15,
    paddingHorizontal: DS.space.lg,
  },
  qrGraphic: { alignSelf: 'center', marginTop: DS.space.md, width: 44, height: 44 },
  micro: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontFamily: DS.font.body,
    marginTop: DS.space.sm,
    paddingHorizontal: DS.space.lg,
  },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.color.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DS.space.md,
    paddingBottom: DS.space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.color.borderHairline,
  },
  backBtn: { padding: DS.space.sm },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: DS.font.heading,
    fontSize: 14,
    letterSpacing: 1.6,
    color: DS.color.gold,
  },
  scanningFor: {
    paddingHorizontal: DS.space.lg,
    paddingVertical: DS.space.sm,
    fontFamily: DS.font.body,
    fontSize: 13,
    color: DS.color.textMuted,
  },
  scanningForGold: { color: DS.color.gold, fontFamily: DS.font.bodyMedium },
  scanningForMuted: {
    paddingHorizontal: DS.space.lg,
    paddingVertical: DS.space.sm,
    fontFamily: DS.font.body,
    fontSize: 13,
    color: DS.color.textMuted,
  },
  help: {
    padding: DS.space.lg,
    color: DS.color.textMuted,
    textAlign: 'center',
    fontFamily: DS.font.body,
  },
  noCam: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: DS.space.xl },
  permBtn: {
    marginHorizontal: DS.space.xl,
    marginTop: DS.space.xl,
    backgroundColor: DS.color.gold,
    paddingVertical: DS.space.base,
    borderRadius: DS.radius.lg,
    alignItems: 'center',
  },
  permTxt: { fontFamily: DS.font.bodyBold, color: DS.color.background },
  camWrap: { flex: 1, overflow: 'hidden', position: 'relative' },
  busyBadge: {
    position: 'absolute',
    bottom: 56,
    alignSelf: 'center',
    backgroundColor: DS.color.surface,
    paddingHorizontal: DS.space.lg,
    paddingVertical: DS.space.sm,
    borderRadius: DS.radius.lg,
  },
  busyTxt: { fontFamily: DS.font.bodyMedium, color: DS.color.text },
});
