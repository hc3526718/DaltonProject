import type { ReactNode } from 'react';
import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppleHeroButton } from '../components/AppleHeroButton';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { AuthWebBackBar } from '../components/AuthWebBackBar';
import { AuthWelcomeRiveHero } from '../components/AuthWelcomeRiveHero';
import { ScreenHeader } from '../components/ScreenHeader';
import { authBackHandler } from '../lib/authNavigation';
import { DALTON_BOOT_VIDEO_BG } from '../constants/daltonBootVideo';
import { DS } from '../designSystem';
import { BRAND_NAME } from '../constants/brand';
import { openLegalPage } from '../lib/legalUrls';
import type { AuthStackParamList } from '../navigation/types';

type Props<K extends keyof AuthStackParamList> = NativeStackScreenProps<AuthStackParamList, K>;

function socialLabelStyle() {
  return {
    fontFamily: DS.font.bodyMedium,
    fontSize: 16,
    fontWeight: '600' as const,
    color: DS.color.text,
  };
}

export function WelcomeHubScreen({ navigation }: Props<'WelcomeHub'>) {
  const insets = useSafeAreaInsets();
  const { signInWithGoogle, signInWithApple, oAuthBusy } = useAuth();
  return (
    <View
      style={[
        styles.root,
        { paddingBottom: insets.bottom + DS.space.lg },
        Platform.OS !== 'web' && { paddingTop: insets.top + DS.space.md },
      ]}
    >
      <AuthWebBackBar />
      <ScrollView contentContainerStyle={styles.welcomeScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.welcomeHero}>
          <AuthWelcomeRiveHero height={220} />
          <Text style={styles.welcomeAppName}>{BRAND_NAME}</Text>
        </View>
      </ScrollView>
      <View style={styles.welcomeActions}>
        <AppleHeroButton onPress={() => navigation.navigate('GrantAccess', { startAt: 'signup' })}>
          Sign Up
        </AppleHeroButton>
        <AppleHeroButton variant="ghost" onPress={() => navigation.navigate('LogIn')}>
          Log In
        </AppleHeroButton>
        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>OR</Text>
          <View style={styles.orLine} />
        </View>
        {Platform.OS === 'ios' ? (
          <AppleHeroButton
            variant="social"
            loading={oAuthBusy}
            onPress={() => void signInWithApple()}
            style={styles.socialBtnMargin}
          >
            <View style={styles.socialInner}>
              <FontAwesome5 name="apple" size={20} color={DS.color.text} brand />
              <Text style={socialLabelStyle()}>Continue with Apple</Text>
            </View>
          </AppleHeroButton>
        ) : null}
        <AppleHeroButton
          variant="social"
          loading={oAuthBusy}
          onPress={() => void signInWithGoogle()}
          style={styles.socialBtnMargin}
        >
          <View style={styles.socialInner}>
            <FontAwesome5 name="google" size={18} color={DS.color.text} brand />
            <Text style={socialLabelStyle()}>Continue with Google</Text>
          </View>
        </AppleHeroButton>
        <Text style={styles.legal}>
          By continuing, you agree to our{' '}
          <Text style={styles.gold} onPress={() => void openLegalPage('/terms')}>
            Terms
          </Text>{' '}
          and{' '}
          <Text style={styles.gold} onPress={() => void openLegalPage('/privacy')}>
            Privacy Policy
          </Text>
        </Text>
      </View>
    </View>
  );
}

export function LogInScreen({ navigation }: Props<'LogIn'>) {
  const insets = useSafeAreaInsets();
  const { login, signInWithGoogle, signInWithApple, oAuthBusy } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [remember, setRemember] = useState(true);
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AuthWebBackBar />
      <ScreenHeader
        title="Log In"
        onBack={
          Platform.OS === 'web'
            ? undefined
            : authBackHandler(navigation, () => navigation.navigate('WelcomeHub'))
        }
      />
      <ScrollView
        contentContainerStyle={[styles.scrollPad, styles.scrollPadCompact, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.loginLogoRow}>
          <AuthWelcomeRiveHero height={120} />
        </View>
        <AuthFormField label="Email">
          <TextInput
            style={styles.inputCompact}
            placeholder="athlete@example.com"
            placeholderTextColor={DS.color.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </AuthFormField>
        <AuthFormField label="Password">
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.inputCompact, styles.inputFlex]}
              placeholder="••••••••"
              placeholderTextColor={DS.color.textMuted}
              secureTextEntry={!passwordVisible}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable onPress={() => setPasswordVisible((v) => !v)}>
              <FontAwesome
                name={passwordVisible ? 'eye-slash' : 'eye'}
                size={18}
                color={DS.color.textMuted}
              />
            </Pressable>
          </View>
        </AuthFormField>
        <View style={styles.loginOpts}>
          <Pressable style={styles.rememberRow} onPress={() => setRemember((r) => !r)}>
            <View style={[styles.checkbox, remember && styles.checkboxOn]}>
              {remember ? (
                <FontAwesome name="check" size={12} color={DS.color.background} />
              ) : null}
            </View>
            <Text style={styles.rememberText}>Remember me</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={styles.gold}>Forgot Password?</Text>
          </Pressable>
        </View>
        <AppleHeroButton
          onPress={() => {
            void (async () => {
              const ok = await login(email.trim(), password);
              if (ok) return;
              Alert.alert(
                'Log in failed',
                'Check your email and password, or sign in with Apple or Google.',
              );
            })();
          }}
        >
          Log In
        </AppleHeroButton>
        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>OR</Text>
          <View style={styles.orLine} />
        </View>
        {Platform.OS === 'ios' ? (
          <AppleHeroButton
            variant="social"
            loading={oAuthBusy}
            onPress={() => void signInWithApple()}
            style={styles.socialBtnMargin}
          >
            <View style={styles.socialInner}>
              <FontAwesome5 name="apple" size={20} color={DS.color.text} brand />
              <Text style={socialLabelStyle()}>Continue with Apple</Text>
            </View>
          </AppleHeroButton>
        ) : null}
        <AppleHeroButton
          variant="social"
          loading={oAuthBusy}
          onPress={() => void signInWithGoogle()}
          style={styles.socialBtnMargin}
        >
          <View style={styles.socialInner}>
            <FontAwesome5 name="google" size={18} color={DS.color.text} brand />
            <Text style={socialLabelStyle()}>Continue with Google</Text>
          </View>
        </AppleHeroButton>
        <View style={styles.footerRow}>
          <Text style={styles.muted}>Don&apos;t have an account? </Text>
          <Pressable onPress={() => navigation.navigate('WelcomeHub')}>
            <Text style={styles.gold}>Create Account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function ForgotPasswordScreen({ navigation }: Props<'ForgotPassword'>) {
  const insets = useSafeAreaInsets();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    setBusy(true);
    const result = await requestPasswordReset(email.trim());
    setBusy(false);
    if (!result.ok) {
      Alert.alert('Reset password', result.message);
      return;
    }
    setSent(true);
    Alert.alert(
      'Check your email',
      'We sent you a reset link. Open it on this device so you can choose a new password. If your email isn’t arriving, check spam folders.',
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Forgot Password" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={[styles.scrollPad, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoCard}>
          <View style={styles.infoIconCircle}>
            <FontAwesome name="lock" size={22} color={DS.color.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoCardTitle}>Reset your password</Text>
            <Text style={styles.infoCardBody}>
              Enter the email you used to sign up. We&apos;ll send a secure link — only email/password accounts can use this
              (not Apple or Google sign-in).
            </Text>
          </View>
        </View>
        <AuthFormField label="Email Address">
          <TextInput
            style={styles.input}
            placeholder="athlete@example.com"
            placeholderTextColor={DS.color.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            editable={!sent}
          />
        </AuthFormField>
        <AppleHeroButton loading={busy} disabled={sent} onPress={() => void send()}>
          {sent ? 'Email sent' : 'Send reset link'}
        </AppleHeroButton>
        <View style={styles.footerRow}>
          <Text style={styles.muted}>Remember your password? </Text>
          <Pressable onPress={() => navigation.navigate('LogIn')}>
            <Text style={styles.gold}>Back to Log In</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

export function VerifyResetScreen({ navigation }: Props<'VerifyReset'>) {
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const hiddenRef = useRef<TextInput>(null);
  return (
    <View style={styles.root}>
      <ScreenHeader title="Verify Code" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={[styles.scrollPad, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.infoCard}>
          <View style={styles.infoIconCircle}>
            <FontAwesome name="envelope" size={20} color={DS.color.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoCardTitle}>Check Your Email</Text>
            <Text style={styles.infoCardBody}>
              We sent a 6-digit code to your email.{' '}
              <Text style={styles.gold}>Change Email</Text>
            </Text>
          </View>
        </View>
        <Text style={styles.label}>Enter 6-Digit Code</Text>
        <Pressable style={styles.codeRow} onPress={() => hiddenRef.current?.focus()}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={styles.codeCell}>
              <Text style={styles.codeCellText}>{code[i] ?? ''}</Text>
            </View>
          ))}
        </Pressable>
        <TextInput
          ref={hiddenRef}
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          style={styles.codeHidden}
        />
        <Pressable style={styles.resendRow}>
          <FontAwesome name="refresh" size={14} color={DS.color.gold} />
          <Text style={styles.resendText}> Resend Code</Text>
        </Pressable>
        <AppleHeroButton onPress={() => navigation.navigate('CreatePassword')}>Verify &amp; continue</AppleHeroButton>
        <View style={styles.footerRow}>
          <Text style={styles.muted}>Need help? </Text>
          <Pressable>
            <Text style={styles.gold}>Contact Support</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function passwordStrength(pw: string): { pct: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (/[A-Z]/.test(pw)) score += 1;
  if (/[a-z]/.test(pw)) score += 1;
  if (/[0-9]/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  const labels = ['Enter password', 'Weak', 'Fair', 'Good', 'Strong', 'Strong'];
  const colors = [
    DS.color.textMuted,
    DS.color.error,
    '#F59E0B',
    '#10B981',
    '#4CAF50',
    '#4CAF50',
  ];
  return { pct: (score / 5) * 100, label: labels[score], color: colors[score] };
}

export function CreatePasswordScreen({ navigation }: Props<'CreatePassword'>) {
  const insets = useSafeAreaInsets();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const strength = useMemo(() => passwordStrength(pw), [pw]);
  const reqs = useMemo(
    () => [
      { ok: pw.length >= 8, t: 'At least 8 characters' },
      { ok: /[A-Z]/.test(pw), t: 'One uppercase letter' },
      { ok: /[a-z]/.test(pw), t: 'One lowercase letter' },
      { ok: /[0-9]/.test(pw), t: 'One number' },
      { ok: /[^A-Za-z0-9]/.test(pw), t: 'One special character' },
    ],
    [pw],
  );
  return (
    <View style={styles.root}>
      <ScreenHeader title="Create Password" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={[styles.scrollPad, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoCard}>
          <View style={styles.infoIconCircle}>
            <FontAwesome5 name="shield-alt" size={20} color={DS.color.gold} solid />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoCardTitle}>Secure Your Account</Text>
            <Text style={styles.infoCardBody}>
              Create a strong password to protect your athlete profile and training data.
            </Text>
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>New Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.inputFlex]}
              placeholder="Enter your new password"
              placeholderTextColor={DS.color.textMuted}
              secureTextEntry={!show1}
              value={pw}
              onChangeText={setPw}
            />
            <Pressable onPress={() => setShow1((s) => !s)}>
              <FontAwesome name={show1 ? 'eye-slash' : 'eye'} size={18} color={DS.color.textMuted} />
            </Pressable>
          </View>
          <View style={styles.strengthBlock}>
            <View style={styles.strengthLabels}>
              <Text style={styles.strengthHint}>Password Strength</Text>
              <Text style={[styles.strengthHint, { color: strength.color }]}>{strength.label}</Text>
            </View>
            <View style={styles.strengthTrack}>
              <View
                style={[
                  styles.strengthFill,
                  { width: `${strength.pct}%`, backgroundColor: strength.color },
                ]}
              />
            </View>
          </View>
        </View>
        <AuthFormField label="Confirm Password">
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.inputFlex]}
              placeholder="••••••••"
              placeholderTextColor={DS.color.textMuted}
              secureTextEntry={!show2}
              value={pw2}
              onChangeText={setPw2}
            />
            <Pressable onPress={() => setShow2((s) => !s)}>
              <FontAwesome name={show2 ? 'eye-slash' : 'eye'} size={18} color={DS.color.textMuted} />
            </Pressable>
          </View>
        </AuthFormField>
        <Text style={styles.reqHeading}>Password Requirements</Text>
        {reqs.map((r) => (
          <Text key={r.t} style={[styles.reqLine, r.ok && styles.reqLineOk]}>
            {r.ok ? '✓ ' : '○ '}
            {r.t}
          </Text>
        ))}
        <AppleHeroButton onPress={() => navigation.navigate('LogIn')}>Create password</AppleHeroButton>
        <View style={styles.footerRow}>
          <Text style={styles.muted}>Need help? </Text>
          <Pressable>
            <Text style={styles.gold}>Contact Support</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

export function AuthFormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: DALTON_BOOT_VIDEO_BG,
  },
  scrollPad: {
    paddingHorizontal: DS.space.lg,
    paddingTop: DS.space.md,
    flexGrow: 1,
  },
  scrollPadCompact: {
    paddingTop: DS.space.sm,
  },
  loginLogoRow: {
    alignItems: 'center',
    marginBottom: DS.space.md,
  },
  loginDevHint: {
    fontSize: 11,
    color: DS.color.textMuted,
    lineHeight: 16,
    marginBottom: DS.space.md,
    textAlign: 'center',
  },
  welcomeScroll: {
    flexGrow: 1,
    paddingHorizontal: DS.space.lg,
    paddingTop: DS.space.xl,
    alignItems: 'center',
  },
  welcomeHero: {
    alignItems: 'center',
    marginBottom: DS.space.md,
  },
  welcomeLogo: {
    marginBottom: DS.space.md,
  },
  welcomeAppName: {
    fontFamily: DS.font.heading,
    fontSize: 28,
    letterSpacing: 3,
    color: DS.color.text,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  grant: {
    fontSize: 13,
    color: DS.color.textMuted,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: DS.space.xl,
  },
  welcomeLead: {
    fontSize: 18,
    color: DS.color.text,
    fontWeight: '600',
    marginBottom: DS.space.md,
  },
  welcomeSub: {
    fontSize: 14,
    color: DS.color.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  welcomeActions: {
    paddingHorizontal: DS.space.lg,
    gap: DS.space.md,
  },
  field: {
    marginBottom: DS.space.lg,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: DS.color.gold,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: DS.space.sm,
  },
  input: {
    backgroundColor: DS.color.input,
    borderRadius: DS.radius.lg,
    padding: DS.space.base,
    fontSize: 16,
    color: DS.color.text,
  },
  inputCompact: {
    backgroundColor: DS.color.input,
    borderRadius: DS.radius.md,
    paddingVertical: 12,
    paddingHorizontal: DS.space.md,
    fontSize: 15,
    color: DS.color.text,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DS.color.input,
    borderRadius: DS.radius.md,
    paddingHorizontal: DS.space.md,
    paddingVertical: 10,
  },
  inputFlex: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    marginRight: DS.space.sm,
  },
  loginOpts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: DS.space.sm,
    marginBottom: DS.space.lg,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: DS.color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: DS.color.gold,
    borderColor: DS.color.gold,
  },
  rememberText: {
    fontSize: 14,
    color: DS.color.text,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: DS.space.lg,
  },
  orLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: DS.color.border,
    opacity: 0.3,
  },
  orText: {
    marginHorizontal: DS.space.base,
    color: DS.color.textMuted,
    fontSize: 14,
  },
  socialBtnMargin: {
    marginBottom: DS.space.sm,
  },
  socialInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
  },
  legal: {
    textAlign: 'center',
    fontSize: 12,
    color: DS.color.textMuted,
    marginTop: DS.space.md,
  },
  gold: {
    color: DS.color.gold,
    fontWeight: '600',
  },
  muted: {
    color: DS.color.textMuted,
    fontSize: 15,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: DS.space.xl,
  },
  bodyCenter: {
    textAlign: 'center',
    color: DS.color.textMuted,
    lineHeight: 22,
    marginBottom: DS.space.xl,
  },
  infoCard: {
    flexDirection: 'row',
    gap: DS.space.base,
    backgroundColor: DS.color.surface,
    borderRadius: DS.radius.lg,
    padding: DS.space.lg,
    marginBottom: DS.space.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.border,
  },
  infoIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: DS.color.goldTint10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCardTitle: {
    fontFamily: DS.font.heading,
    fontSize: 18,
    color: DS.color.gold,
    letterSpacing: 1,
    marginBottom: DS.space.sm,
    textTransform: 'uppercase',
  },
  infoCardBody: {
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.textMuted,
    lineHeight: 22,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: DS.space.lg,
  },
  codeCell: {
    flex: 1,
    aspectRatio: 0.85,
    maxHeight: 56,
    backgroundColor: DS.color.input,
    borderRadius: DS.radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeCellText: {
    fontFamily: DS.font.bodyBold,
    fontSize: 22,
    color: DS.color.text,
  },
  codeHidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: DS.space.lg,
  },
  resendText: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 14,
    color: DS.color.gold,
  },
  strengthBlock: {
    marginTop: DS.space.md,
  },
  strengthLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: DS.space.sm,
  },
  strengthHint: {
    fontSize: 12,
    color: DS.color.textMuted,
  },
  strengthTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: DS.color.input,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  reqHeading: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 11,
    color: DS.color.gold,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: DS.space.lg,
    marginBottom: DS.space.sm,
  },
  reqLine: {
    fontFamily: DS.font.body,
    fontSize: 13,
    color: DS.color.textMuted,
    marginBottom: 6,
  },
  reqLineOk: {
    color: '#4CAF50',
  },
});

/** Shared login/sign-up field layout styles (used by `GrantAccessScreen`). */
export const authScreenSharedStyles = styles;
