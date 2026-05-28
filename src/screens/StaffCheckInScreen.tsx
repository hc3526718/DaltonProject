import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useActionBanner } from '../actionBanner/ActionBannerContext';
import { verifyTicketToken } from '../booking/ticketToken';
import { ScreenHeader } from '../components/ScreenHeader';
import { DS } from '../designSystem';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { EventsStackParamList } from '../navigation/types';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { FontAwesome } from '@expo/vector-icons';

type Props = NativeStackScreenProps<EventsStackParamList, 'StaffCheckIn'>;

export function StaffCheckInScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const showBanner = useActionBanner();
  const [raw, setRaw] = useState('');
  const [scanMode, setScanMode] = useState(false);
  const [lastScan, setLastScan] = useState<string>('');
  const [permission, requestPermission] = useCameraPermissions();

  const canScan = useMemo(() => Platform.OS !== 'web', []);

  useEffect(() => {
    if (!scanMode) return;
    if (!permission) return;
    if (permission.granted) return;
    void requestPermission();
  }, [scanMode, permission, requestPermission]);

  const validate = () => {
    const token = raw.trim();
    if (!token) {
      Alert.alert('Paste token', 'Scan or paste the attendee QR payload.');
      return;
    }
    void (async () => {
      const res = await verifyTicketToken(token);
      if (!res.ok) {
        Alert.alert('Invalid', res.reason);
        return;
      }
      showBanner(
        'Ticket verified',
        `Ref ${res.payload.ref} · Guest ${res.payload.uid}${res.payload.eventId ? ` · Event ${res.payload.eventId}` : ''}`,
      );
    })();
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Staff check-in" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.help}>
          Use camera scan (dev client / EAS) or paste the token string from an attendee QR.
        </Text>

        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.toggleBtn, scanMode ? styles.toggleOn : styles.toggleOff]}
            onPress={() => setScanMode(true)}
            disabled={!canScan}
          >
            <FontAwesome name="camera" size={14} color={scanMode ? DS.color.background : DS.color.textMuted} />
            <Text style={[styles.toggleTxt, scanMode ? styles.toggleTxtOn : styles.toggleTxtOff]}> Scan</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, !scanMode ? styles.toggleOn : styles.toggleOff]}
            onPress={() => setScanMode(false)}
          >
            <FontAwesome name="clipboard" size={14} color={!scanMode ? DS.color.background : DS.color.textMuted} />
            <Text style={[styles.toggleTxt, !scanMode ? styles.toggleTxtOn : styles.toggleTxtOff]}> Paste</Text>
          </Pressable>
        </View>

        {scanMode && canScan ? (
          permission?.granted ? (
            <View style={styles.cameraCard}>
              <CameraView
                style={styles.camera}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={(e) => {
                  const data = String(e.data || '');
                  if (!data || data === lastScan) return;
                  setLastScan(data);
                  setRaw(data);
                  void (async () => {
                    const res = await verifyTicketToken(data);
                    if (!res.ok) {
                      Alert.alert('Invalid', res.reason);
                      return;
                    }
                    showBanner(
                      'Ticket verified',
                      `Ref ${res.payload.ref} · Guest ${res.payload.uid}${res.payload.eventId ? ` · Event ${res.payload.eventId}` : ''}`,
                    );
                  })();
                }}
              />
              <Text style={styles.scanHint}>Point camera at a QR code</Text>
            </View>
          ) : (
            <Pressable style={styles.btn} onPress={() => void requestPermission()}>
              <Text style={styles.btnTxt}>Enable camera</Text>
            </Pressable>
          )
        ) : null}

        <TextInput
          style={styles.input}
          value={raw}
          onChangeText={setRaw}
          placeholder="Ticket token…"
          placeholderTextColor={DS.color.textMuted}
          multiline
          autoCapitalize="none"
        />
        <Pressable style={styles.btn} onPress={validate}>
          <Text style={styles.btnTxt}>Validate locally</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.color.background },
  body: { padding: DS.space.lg },
  help: {
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.textMuted,
    lineHeight: 21,
    marginBottom: DS.space.lg,
  },
  toggleRow: { flexDirection: 'row', gap: DS.space.sm, marginBottom: DS.space.md },
  toggleBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: DS.space.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  toggleOn: { backgroundColor: DS.color.gold, borderColor: DS.color.gold },
  toggleOff: { backgroundColor: DS.color.surface, borderColor: DS.color.borderWhite5 },
  toggleTxt: { fontFamily: DS.font.bodyMedium, fontSize: 13 },
  toggleTxtOn: { color: DS.color.background },
  toggleTxtOff: { color: DS.color.textMuted },
  cameraCard: {
    backgroundColor: DS.color.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.borderWhite5,
    overflow: 'hidden',
    marginBottom: DS.space.lg,
  },
  camera: { width: '100%', height: 240 },
  scanHint: { fontFamily: DS.font.body, fontSize: 12, color: DS.color.textMuted, padding: DS.space.md },
  input: {
    minHeight: 120,
    backgroundColor: DS.color.input,
    borderRadius: 12,
    padding: DS.space.md,
    fontFamily: DS.font.body,
    fontSize: 13,
    color: DS.color.text,
    textAlignVertical: 'top',
    marginBottom: DS.space.lg,
  },
  btn: {
    backgroundColor: DS.color.gold,
    paddingVertical: DS.space.base,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnTxt: { fontFamily: DS.font.bodyBold, color: DS.color.background, fontSize: 16 },
});
