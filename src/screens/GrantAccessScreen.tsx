import { useCallback, useState } from 'react';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
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
import { ScreenHeader } from '../components/ScreenHeader';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { AuthWelcomeRiveHero } from '../components/AuthWelcomeRiveHero';
import { DS } from '../designSystem';
import { isSupabaseConfigured } from '../lib/env';
import type { AuthStackParamList } from '../navigation/types';
import { AuthWebBackBar } from '../components/AuthWebBackBar';
import { authBackHandler } from '../lib/authNavigation';
import { AuthFormField, authScreenSharedStyles as S } from './onboardingScreens';

type Nav = NativeStackNavigationProp<AuthStackParamList>;
type GrantRoute = RouteProp<AuthStackParamList, 'GrantAccess'>;

function socialLabelStyle() {
  return {
    fontFamily: DS.font.bodyMedium,
    fontSize: 16,
    fontWeight: '600' as const,
    color: DS.color.text,
  };
}

/** Sign-up form only. Opened from Welcome hub with `{ startAt: 'signup' }`. */
export default function GrantAccessScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<GrantRoute>();
  const { login, signUp, signInWithGoogle, signInWithApple, oAuthBusy } = useAuth();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signupConfirmEmail, setSignupConfirmEmail] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (route.params?.startAt !== 'signup') {
        navigation.replace('LogIn');
      }
    }, [navigation, route.params?.startAt]),
  );

  const tryCreateAccount = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed || !password) {
      Alert.alert('Missing fields', 'Enter email and password.');
      return;
    }
    if (isSupabaseConfigured()) {
      const result = await signUp(trimmed, password);
      if (!result.ok) {
        Alert.alert('Create account', result.message);
        return;
      }
      if (result.needsEmailConfirmation) {
        setSignupConfirmEmail(trimmed);
        Alert.alert(
          'Confirm your email',
          `We sent a confirmation link to ${trimmed}. Open that email to verify, then use Log In.`,
        );
        return;
      }
      setSignupConfirmEmail(null);
    }
    const ok = await login(trimmed, password);
    if (ok) return;
    Alert.alert(
      'Could not finish sign-up',
      'Please check your details and internet connection. If you already have an account, use Log In.',
    );
  }, [email, password, login, signUp]);

  const dismissConfirmBanner = useCallback(() => {
    setSignupConfirmEmail(null);
  }, []);

  const goWelcome = useCallback(() => {
    navigation.navigate('WelcomeHub');
  }, [navigation]);

  if (route.params?.startAt !== 'signup') {
    return <View style={local.hold} />;
  }

  return (
    <KeyboardAvoidingView style={local.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AuthWebBackBar />
      <ScreenHeader
        title="Create Account"
        onBack={Platform.OS === 'web' ? undefined : authBackHandler(navigation, goWelcome)}
      />
      <ScrollView
        contentContainerStyle={[S.scrollPad, S.scrollPadCompact, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={S.loginLogoRow}>
          <AuthWelcomeRiveHero height={120} />
        </View>
        {signupConfirmEmail ? (
          <View style={local.confirmBanner}>
            <Text style={local.confirmBannerTitle}>Check your email</Text>
            <Text style={local.confirmBannerBody}>
              Please confirm your signup using the link sent to{' '}
              <Text style={local.confirmBannerEm}>{signupConfirmEmail}</Text>. Then return here and tap Log In.
            </Text>
            <Pressable onPress={dismissConfirmBanner} hitSlop={10}>
              <Text style={local.confirmBannerDismiss}>Dismiss</Text>
            </Pressable>
          </View>
        ) : null}
        <AuthFormField label="Email">
          <TextInput
            style={S.inputCompact}
            placeholder="athlete@example.com"
            placeholderTextColor={DS.color.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />
        </AuthFormField>
        <AuthFormField label="Password">
          <View style={S.inputRow}>
            <TextInput
              style={[S.inputCompact, S.inputFlex]}
              placeholder="••••••••"
              placeholderTextColor={DS.color.textMuted}
              secureTextEntry={!passwordVisible}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable onPress={() => setPasswordVisible((v) => !v)} hitSlop={8}>
              <FontAwesome
                name={passwordVisible ? 'eye-slash' : 'eye'}
                size={18}
                color={DS.color.textMuted}
              />
            </Pressable>
          </View>
        </AuthFormField>
        <AppleHeroButton style={{ marginTop: DS.space.sm }} onPress={() => void tryCreateAccount()}>
          Sign Up
        </AppleHeroButton>
        <View style={S.orRow}>
          <View style={S.orLine} />
          <Text style={S.orText}>OR</Text>
          <View style={S.orLine} />
        </View>
        {Platform.OS === 'ios' ? (
          <AppleHeroButton
            variant="social"
            loading={oAuthBusy}
            onPress={() => void signInWithApple()}
            style={S.socialBtnMargin}
          >
            <View style={S.socialInner}>
              <FontAwesome5 name="apple" size={20} color={DS.color.text} brand />
              <Text style={socialLabelStyle()}>Continue with Apple</Text>
            </View>
          </AppleHeroButton>
        ) : null}
        <AppleHeroButton
          variant="social"
          loading={oAuthBusy}
          onPress={() => void signInWithGoogle()}
          style={S.socialBtnMargin}
        >
          <View style={S.socialInner}>
            <FontAwesome5 name="google" size={18} color={DS.color.text} brand />
            <Text style={socialLabelStyle()}>Continue with Google</Text>
          </View>
        </AppleHeroButton>
        <View style={S.footerRow}>
          <Text style={S.muted}>Already have an account? </Text>
          <Pressable onPress={() => navigation.navigate('LogIn')}>
            <Text style={S.gold}>Log In</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const local = StyleSheet.create({
  hold: {
    flex: 1,
    backgroundColor: DS.color.background,
  },
  root: {
    flex: 1,
    backgroundColor: DS.color.background,
  },
  confirmBanner: {
    marginBottom: DS.space.md,
    padding: DS.space.md,
    borderRadius: DS.apple.radiusCard,
    borderWidth: 1,
    borderColor: 'rgba(200, 168, 75, 0.45)',
    backgroundColor: 'rgba(200, 168, 75, 0.12)',
    gap: DS.space.sm,
  },
  confirmBannerTitle: {
    fontFamily: DS.font.bodyBold,
    fontSize: 15,
    color: DS.color.gold,
  },
  confirmBannerBody: {
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.text,
    lineHeight: 21,
  },
  confirmBannerEm: {
    fontFamily: DS.font.bodyBold,
    color: DS.color.text,
  },
  confirmBannerDismiss: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 13,
    color: DS.color.textMuted,
    textDecorationLine: 'underline',
  },
});
