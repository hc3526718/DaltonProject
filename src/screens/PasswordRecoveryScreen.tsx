import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { AppleHeroButton } from '../components/AppleHeroButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { DS } from '../designSystem';
import { getSupabase } from '../lib/supabase';
import { AuthFormField, authScreenSharedStyles as S } from './onboardingScreens';

/**
 * Shown after opening the password-reset link from email (Supabase `PASSWORD_RECOVERY` session).
 */
export function PasswordRecoveryScreen() {
  const insets = useSafeAreaInsets();
  const { clearPasswordRecoveryFlow } = useAuth();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (pw.length < 8) {
      Alert.alert('Password', 'Use at least 8 characters.');
      return;
    }
    if (pw !== pw2) {
      Alert.alert('Password', 'Passwords do not match.');
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      Alert.alert('Error', 'App is not configured.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      Alert.alert('Could not update password', error.message);
      return;
    }
    clearPasswordRecoveryFlow();
    Alert.alert('Success', 'Your password has been updated.');
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Set new password" onBack={() => clearPasswordRecoveryFlow()} />
      <ScrollView
        contentContainerStyle={[S.scrollPad, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoCard}>
          <View style={styles.infoIconCircle}>
            <FontAwesome name="lock" size={22} color={DS.color.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoCardTitle}>Choose a new password</Text>
            <Text style={styles.infoCardBody}>
              You opened a reset link from your email. Save a new password below, then continue in the app as usual.
            </Text>
          </View>
        </View>
        <AuthFormField label="New password">
          <View style={styles.inputRow}>
            <TextInput
              style={[S.input, styles.inputFlex]}
              placeholder="At least 8 characters"
              placeholderTextColor={DS.color.textMuted}
              secureTextEntry={!show1}
              value={pw}
              onChangeText={setPw}
            />
            <Pressable onPress={() => setShow1((v) => !v)} hitSlop={8}>
              <FontAwesome name={show1 ? 'eye-slash' : 'eye'} size={18} color={DS.color.textMuted} />
            </Pressable>
          </View>
        </AuthFormField>
        <AuthFormField label="Confirm password">
          <View style={styles.inputRow}>
            <TextInput
              style={[S.input, styles.inputFlex]}
              placeholder="Repeat password"
              placeholderTextColor={DS.color.textMuted}
              secureTextEntry={!show2}
              value={pw2}
              onChangeText={setPw2}
            />
            <Pressable onPress={() => setShow2((v) => !v)} hitSlop={8}>
              <FontAwesome name={show2 ? 'eye-slash' : 'eye'} size={18} color={DS.color.textMuted} />
            </Pressable>
          </View>
        </AuthFormField>
        <AppleHeroButton loading={busy} onPress={() => void submit()}>
          Update password
        </AppleHeroButton>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.color.background },
  infoCard: {
    flexDirection: 'row',
    gap: DS.space.md,
    padding: DS.space.md,
    borderRadius: DS.apple.radiusCard,
    borderWidth: 1,
    borderColor: DS.color.cardBorder,
    backgroundColor: DS.apple.fillSecondary,
    marginBottom: DS.space.lg,
  },
  infoIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DS.color.goldTint10,
  },
  infoCardTitle: {
    fontFamily: DS.font.bodyBold,
    fontSize: 16,
    color: DS.color.text,
  },
  infoCardBody: {
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.textMuted,
    lineHeight: 20,
    marginTop: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    backgroundColor: DS.color.input,
    borderRadius: DS.apple.radiusField,
    paddingHorizontal: DS.space.md,
  },
  inputFlex: { flex: 1, borderWidth: 0, backgroundColor: 'transparent' },
});
