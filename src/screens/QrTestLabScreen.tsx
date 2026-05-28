import { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FontAwesome } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { signTicketPayload, verifyTicketToken, type TicketPayloadV1 } from '../booking/ticketToken';
import { BookingQrCode } from '../components/BookingQrCode';
import { ScreenHeader } from '../components/ScreenHeader';
import { DS } from '../designSystem';
import type { ProfileStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'QrTestLab'>;

export function QrTestLabScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [ref, setRef] = useState('DG-TEST-0001');
  const [eventId, setEventId] = useState('');
  const [uid, setUid] = useState(user?.id ?? 'test-user');
  const [days, setDays] = useState('14');
  const [token, setToken] = useState<string | null>(null);

  const exp = useMemo(() => {
    const n = Math.max(1, Math.min(90, parseInt(days, 10) || 14));
    return Math.floor(Date.now() / 1000) + n * 24 * 3600;
  }, [days]);

  const payload: TicketPayloadV1 = useMemo(
    () => ({
      v: 1,
      ref: ref.trim() || 'DG-TEST-0001',
      uid: uid.trim() || 'test-user',
      ...(eventId.trim() ? { eventId: eventId.trim() } : {}),
      exp,
    }),
    [ref, uid, eventId, exp],
  );

  const generate = useCallback(() => {
    void (async () => {
      try {
        const t = await signTicketPayload(payload);
        setToken(t);
      } catch (e) {
        Alert.alert('QR generate failed', e instanceof Error ? e.message : 'Could not sign token');
      }
    })();
  }, [payload]);

  const verify = useCallback(() => {
    if (!token) return;
    void (async () => {
      const res = await verifyTicketToken(token);
      if (!res.ok) {
        Alert.alert('Invalid', res.reason);
        return;
      }
      Alert.alert(
        'Valid token',
        `ref: ${res.payload.ref}\nuid: ${res.payload.uid}${res.payload.eventId ? `\neventId: ${res.payload.eventId}` : ''}`,
      );
    })();
  }, [token]);

  return (
    <View style={styles.root}>
      <ScreenHeader title="QR test lab" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.help}>
          Generate a signed ticket token and display it as a QR code. Use this to test camera scanning on a dev client / EAS build.
        </Text>

        <Field label="Reference (booking ref)">
          <TextInput style={styles.input} value={ref} onChangeText={setRef} placeholder="DG-XXXX-YYYY" placeholderTextColor={DS.color.textMuted} autoCapitalize="characters" />
        </Field>
        <Field label="Event ID (optional)">
          <TextInput style={styles.input} value={eventId} onChangeText={setEventId} placeholder="uuid…" placeholderTextColor={DS.color.textMuted} autoCapitalize="none" />
        </Field>
        <Field label="User ID (uid)">
          <TextInput style={styles.input} value={uid} onChangeText={setUid} placeholder="auth uid…" placeholderTextColor={DS.color.textMuted} autoCapitalize="none" />
        </Field>
        <Field label="Expires in (days)">
          <TextInput style={styles.input} value={days} onChangeText={setDays} placeholder="14" placeholderTextColor={DS.color.textMuted} keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'} />
        </Field>

        <View style={styles.row}>
          <Pressable style={styles.btn} onPress={generate}>
            <FontAwesome name="qrcode" size={16} color={DS.color.background} />
            <Text style={styles.btnTxt}> Generate</Text>
          </Pressable>
          <Pressable style={[styles.btn, !token ? styles.btnDisabled : null]} onPress={verify} disabled={!token}>
            <FontAwesome name="check" size={16} color={DS.color.background} />
            <Text style={styles.btnTxt}> Verify</Text>
          </Pressable>
        </View>

        {token ? (
          <View style={styles.qrWrap}>
            <BookingQrCode value={token} />
            <Text style={styles.tokenLabel}>Token (copy/paste fallback)</Text>
            <Text selectable style={styles.tokenMono}>
              {token}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: DS.space.md }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.color.background },
  body: { padding: DS.space.lg },
  help: { fontFamily: DS.font.body, fontSize: 13, color: DS.color.textMuted, lineHeight: 20 },
  label: { fontFamily: DS.font.bodyMedium, fontSize: 12, color: DS.color.gold, marginBottom: 8, letterSpacing: 1.2 },
  input: {
    backgroundColor: DS.color.input,
    borderRadius: 12,
    paddingHorizontal: DS.space.md,
    paddingVertical: DS.space.base,
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.text,
  },
  row: { flexDirection: 'row', gap: DS.space.md, marginTop: DS.space.lg },
  btn: {
    flex: 1,
    backgroundColor: DS.color.gold,
    paddingVertical: DS.space.base,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  btnDisabled: { opacity: 0.5 },
  btnTxt: { fontFamily: DS.font.bodyBold, color: DS.color.background, fontSize: 15 },
  qrWrap: { marginTop: DS.space.xl, gap: DS.space.md, alignItems: 'center' },
  tokenLabel: { fontFamily: DS.font.bodyMedium, fontSize: 12, color: DS.color.textMuted, marginTop: DS.space.md },
  tokenMono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 11,
    color: DS.color.textMuted,
  },
});

