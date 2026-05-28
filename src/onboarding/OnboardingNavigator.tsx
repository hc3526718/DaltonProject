import { createContext, useCallback, useContext, useMemo, useState } from 'react';
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { FontAwesome5 } from '@expo/vector-icons';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { AppleHeroButton } from '../components/AppleHeroButton';
import { BrandLogo } from '../components/BrandLogo';
import { DS } from '../designSystem';
import { capitalizeProfileTag, capitalizeProfileTags } from '../lib/capitalizeProfileTags';
import { getSupabase } from '../lib/supabase';
import type { OnboardingStackParamList } from '../navigation/types';
import { BOOT_USE_RIVE, getDaltonBootRiveDisplayMode } from '../constants/riveBoot';
import { BouncingBrandLogo } from '../components/BouncingBrandLogo';
import { DaltonBootRiveDisplay } from '../components/DaltonBootRiveDisplay';
import { UsernameSetupFields, canProceedWithUsername } from '../components/UsernameSetupFields';
import {
  allocateAutoUsername,
  checkUsernameAvailable,
  isValidUsernameFormat,
  normalizeUsernameTyping,
} from '../profile/usernameProfile';
import { useUsernameAvailability } from '../profile/useUsernameAvailability';
import { InterestsEditor } from '../components/InterestsEditor';
import { DISCOVERY_OPTIONS, PERSONA_OPTIONS, SPORT_OPTIONS } from './onboardingCopy';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

function showCompeteOrCoachSportStep(personaRole: string): boolean {
  return personaRole === 'athlete' || personaRole === 'coach';
}

export type OnboardingDraft = {
  firstName: string;
  lastName: string;
  username: string;
  usernameSkipped: boolean;
  primarySport: string;
  personaRole: string;
  sports: string[];
  /** Athlete-only follow-up: broader topics (stored in `profiles.interests`). */
  interests: string[];
  discoverySource: string;
};

const defaultDraft = (): OnboardingDraft => ({
  firstName: '',
  lastName: '',
  username: '',
  usernameSkipped: false,
  primarySport: '',
  personaRole: '',
  sports: [],
  interests: [],
  discoverySource: '',
});

type OnboardingCtx = {
  draft: OnboardingDraft;
  setDraft: (p: Partial<OnboardingDraft>) => void;
  resetDraft: () => void;
  onFinished: () => void;
};

const Ctx = createContext<OnboardingCtx | null>(null);

function useOnboardingCtx() {
  const v = useContext(Ctx);
  if (!v) throw new Error('Onboarding context missing');
  return v;
}

/** Expo Go uses WebView embed when display mode is `embed`; otherwise bounce. */
function OnboardingCompleteRive({
  riveFailed,
  onRiveFailed,
}: {
  riveFailed: boolean;
  onRiveFailed: () => void;
}) {
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  if (riveFailed || !BOOT_USE_RIVE) {
    return <BouncingBrandLogo width={180} height={180} />;
  }
  if (isExpoGo && getDaltonBootRiveDisplayMode() !== 'embed') {
    return <BouncingBrandLogo width={180} height={180} />;
  }
  return (
    <DaltonBootRiveDisplay
      style={{ width: 220, height: 220, maxWidth: '90%' }}
      onNativeError={() => onRiveFailed()}
      onEmbedError={() => onRiveFailed()}
    />
  );
}

type Props = { onFinished: () => void };

export function OnboardingNavigator({ onFinished }: Props) {
  const [draft, setDraftState] = useState<OnboardingDraft>(defaultDraft);
  const setDraft = useCallback((p: Partial<OnboardingDraft>) => {
    setDraftState((d) => ({ ...d, ...p }));
  }, []);
  const resetDraft = useCallback(() => {
    setDraftState(defaultDraft());
  }, []);

  const value = useMemo(
    () => ({
      draft,
      setDraft,
      resetDraft,
      onFinished,
    }),
    [draft, setDraft, resetDraft, onFinished],
  );

  return (
    <Ctx.Provider value={value}>
      <Stack.Navigator
        initialRouteName="OnboardingName"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: DS.color.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="OnboardingName" component={NameStep} />
        <Stack.Screen name="OnboardingUsername" component={UsernameStep} />
        <Stack.Screen name="OnboardingRole" component={RoleStep} />
        <Stack.Screen name="OnboardingSports" component={SportsStep} />
        <Stack.Screen name="OnboardingInterests" component={InterestsStep} />
        <Stack.Screen name="OnboardingDiscovery" component={DiscoveryStep} />
        <Stack.Screen name="OnboardingComplete" component={CompleteStep} />
      </Stack.Navigator>
    </Ctx.Provider>
  );
}

type StepProps<K extends keyof OnboardingStackParamList> = NativeStackScreenProps<
  OnboardingStackParamList,
  K
>;

function StepChrome({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + DS.space.md, paddingBottom: insets.bottom + DS.space.lg },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoRow}>
          <BrandLogo width={72} height={72} />
        </View>
        <Text style={styles.stepTitle}>{title}</Text>
        {subtitle ? <Text style={styles.stepSub}>{subtitle}</Text> : null}
        {children}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + DS.space.md }]}>{footer}</View>
    </KeyboardAvoidingView>
  );
}

function NameStep({ navigation }: StepProps<'OnboardingName'>) {
  const { draft, setDraft } = useOnboardingCtx();
  const canNext = draft.firstName.trim().length > 0 && draft.lastName.trim().length > 0;
  return (
    <StepChrome
      title="Welcome"
      subtitle="Tell us your name so the community knows who you are."
      footer={
        <AppleHeroButton
          disabled={!canNext}
          onPress={() => navigation.navigate('OnboardingUsername')}
        >
          Continue
        </AppleHeroButton>
      }
    >
      <Field label="First name">
        <TextInput
          style={styles.input}
          placeholder="First name"
          placeholderTextColor={DS.color.textMuted}
          value={draft.firstName}
          onChangeText={(t) => setDraft({ firstName: t })}
          autoCapitalize="words"
        />
      </Field>
      <Field label="Surname">
        <TextInput
          style={styles.input}
          placeholder="Surname"
          placeholderTextColor={DS.color.textMuted}
          value={draft.lastName}
          onChangeText={(t) => setDraft({ lastName: t })}
          autoCapitalize="words"
        />
      </Field>
    </StepChrome>
  );
}

function UsernameStep({ navigation }: StepProps<'OnboardingUsername'>) {
  const { draft, setDraft } = useOnboardingCtx();
  const { user } = useAuth();
  const supabase = getSupabase();
  const availability = useUsernameAvailability(
    supabase,
    user?.id,
    draft.username,
    draft.usernameSkipped,
  );
  const canNext = canProceedWithUsername(draft.usernameSkipped, draft.username, availability);

  return (
    <StepChrome
      title="Choose a username"
      subtitle="This is how you&apos;ll appear across Dalton. We check what you type against existing members — or skip and we&apos;ll use your first name plus four random digits."
      footer={
        <View style={styles.footerRow}>
          <AppleHeroButton variant="ghost" style={styles.footerHalf} onPress={() => navigation.goBack()}>
            Back
          </AppleHeroButton>
          <AppleHeroButton
            disabled={!canNext}
            style={styles.footerHalf}
            onPress={() => navigation.navigate('OnboardingRole')}
          >
            Continue
          </AppleHeroButton>
        </View>
      }
    >
      <UsernameSetupFields
        firstNameForPreview={draft.firstName}
        usernameInput={draft.username}
        onUsernameInputChange={(v) => setDraft({ username: v })}
        skipped={draft.usernameSkipped}
        onSkippedChange={(skipped) =>
          setDraft({
            usernameSkipped: skipped,
            username: skipped ? '' : draft.username,
          })
        }
        availability={availability}
      />
    </StepChrome>
  );
}

function RoleStep({ navigation }: StepProps<'OnboardingRole'>) {
  const { draft, setDraft } = useOnboardingCtx();
  return (
    <StepChrome
      title="Your role"
      subtitle="How do you mainly use Dalton?"
      footer={
        <View style={styles.footerRow}>
          <AppleHeroButton variant="ghost" style={styles.footerHalf} onPress={() => navigation.goBack()}>
            Back
          </AppleHeroButton>
          <AppleHeroButton
            disabled={!draft.personaRole}
            style={styles.footerHalf}
            onPress={() =>
              navigation.navigate(
                showCompeteOrCoachSportStep(draft.personaRole)
                  ? 'OnboardingSports'
                  : 'OnboardingInterests',
              )
            }
          >
            Continue
          </AppleHeroButton>
        </View>
      }
    >
      <View style={styles.chipGrid}>
        {PERSONA_OPTIONS.map((o) => {
          const on = draft.personaRole === o.id;
          return (
            <Pressable
              key={o.id}
              onPress={() => setDraft({ personaRole: o.id })}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </StepChrome>
  );
}

function SportsStep({ navigation }: StepProps<'OnboardingSports'>) {
  const { draft, setDraft } = useOnboardingCtx();
  const isCoach = draft.personaRole === 'coach';
  const title = isCoach ? 'Sport you mainly coach' : 'Sport you currently compete in';
  const subtitle = isCoach
    ? 'Pick the main sport you work in. You can refine this later in your profile.'
    : 'This is used to structure recent results. You can add more sports later.';
  const toggle = (s: string) => {
    const has = draft.sports.includes(s);
    setDraft({
      sports: has ? draft.sports.filter((x) => x !== s) : [...draft.sports, s],
    });
  };
  return (
    <StepChrome
      title={title}
      subtitle={subtitle}
      footer={
        <View style={styles.footerRow}>
          <AppleHeroButton variant="ghost" style={styles.footerHalf} onPress={() => navigation.goBack()}>
            Back
          </AppleHeroButton>
          <AppleHeroButton
            disabled={!draft.primarySport}
            style={styles.footerHalf}
            onPress={() =>
              navigation.navigate(draft.personaRole === 'athlete' ? 'OnboardingInterests' : 'OnboardingDiscovery')
            }
          >
            Continue
          </AppleHeroButton>
        </View>
      }
    >
      <View style={styles.chipGrid}>
        {SPORT_OPTIONS.map((s) => {
          const on = draft.primarySport === s;
          return (
            <Pressable
              key={s}
              onPress={() => {
                setDraft({ primarySport: s });
                // Keep `sports[]` aligned: ensure primary sport exists in the multi-sport list.
                if (!draft.sports.includes(s)) toggle(s);
              }}
              style={[styles.chip, on && styles.chipPrimary]}
            >
              <Text style={[styles.chipText, on && styles.chipPrimaryText]}>{s}</Text>
            </Pressable>
          );
        })}
      </View>
    </StepChrome>
  );
}

function InterestsStep({ navigation }: StepProps<'OnboardingInterests'>) {
  const { draft, setDraft } = useOnboardingCtx();
  const canNext = draft.interests.length > 0;
  return (
    <StepChrome
      title="What are you interested in?"
      subtitle="Pick topics from the list or type your own and press Enter."
      footer={
        <View style={styles.footerRow}>
          <AppleHeroButton variant="ghost" style={styles.footerHalf} onPress={() => navigation.goBack()}>
            Back
          </AppleHeroButton>
          <AppleHeroButton
            disabled={!canNext}
            style={styles.footerHalf}
            onPress={() => navigation.navigate('OnboardingDiscovery')}
          >
            Continue
          </AppleHeroButton>
        </View>
      }
    >
      <InterestsEditor
        value={draft.interests}
        onChange={(interests) => setDraft({ interests })}
        hint="Choose at least one — you can update these later in your profile."
      />
    </StepChrome>
  );
}

function DiscoveryStep({ navigation }: StepProps<'OnboardingDiscovery'>) {
  const { draft, setDraft } = useOnboardingCtx();
  return (
    <StepChrome
      title="How did you find us?"
      subtitle="Helps us improve how we reach athletes and coaches."
      footer={
        <View style={styles.footerRow}>
          <AppleHeroButton variant="ghost" style={styles.footerHalf} onPress={() => navigation.goBack()}>
            Back
          </AppleHeroButton>
          <AppleHeroButton
            disabled={!draft.discoverySource}
            style={styles.footerHalf}
            onPress={() => navigation.navigate('OnboardingComplete')}
          >
            Continue
          </AppleHeroButton>
        </View>
      }
    >
      <View style={styles.chipCol}>
        {DISCOVERY_OPTIONS.map((o) => {
          const on = draft.discoverySource === o.id;
          return (
            <Pressable
              key={o.id}
              onPress={() => setDraft({ discoverySource: o.id })}
              style={[styles.choiceRow, on && styles.choiceRowOn]}
            >
              <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{o.label}</Text>
              {on ? <FontAwesome5 name="check" size={16} color={DS.color.gold} solid /> : null}
            </Pressable>
          );
        })}
      </View>
    </StepChrome>
  );
}

function CompleteStep({ navigation }: StepProps<'OnboardingComplete'>) {
  const insets = useSafeAreaInsets();
  const { draft, onFinished, resetDraft } = useOnboardingCtx();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [riveFailed, setRiveFailed] = useState(false);

  const saveAndEnter = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase || !user) {
      Alert.alert('Unable to save', 'Sign in again to finish setup.');
      return;
    }
    setSaving(true);
    let usernameFinal: string;
    try {
      if (draft.usernameSkipped) {
        usernameFinal = await allocateAutoUsername(supabase, draft.firstName.trim(), user.id);
      } else {
        usernameFinal = normalizeUsernameTyping(draft.username);
        if (!isValidUsernameFormat(usernameFinal)) {
          setSaving(false);
          Alert.alert('Username', 'Choose a valid username from the previous step.');
          return;
        }
        const avail = await checkUsernameAvailable(supabase, usernameFinal, user.id);
        if (!avail) {
          setSaving(false);
          Alert.alert('Username taken', 'Go back and pick a different username.');
          return;
        }
      }
    } catch (e) {
      setSaving(false);
      Alert.alert('Username', e instanceof Error ? e.message : 'Could not set username.');
      return;
    }

    const displayName = `${draft.firstName.trim()} ${draft.lastName.trim()}`.trim();
    const interestsForDb =
      draft.personaRole === 'athlete' || !showCompeteOrCoachSportStep(draft.personaRole)
        ? draft.interests
        : [];
    const { error } = await supabase.from('profiles').upsert(
      {
        id: user.id,
        username: usernameFinal,
        first_name: draft.firstName.trim(),
        last_name: draft.lastName.trim(),
        display_name: displayName,
        persona_role: draft.personaRole,
        sports: capitalizeProfileTags(draft.sports),
        primary_sport: capitalizeProfileTag(draft.primarySport || (draft.sports[0] ?? '')),
        interests: capitalizeProfileTags(interestsForDb),
        discovery_source: draft.discoverySource,
        onboarding_completed_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
    setSaving(false);
    if (error) {
      if (error.code === '23505') {
        Alert.alert('Username taken', 'That username was just claimed. Go back and choose another.');
      } else {
        Alert.alert('Could not save profile', error.message);
      }
      return;
    }
    onFinished();
  }, [draft, onFinished, user]);

  return (
    <View style={styles.completeRoot}>
      <ScrollView
        style={{ flex: 1, width: '100%' }}
        contentContainerStyle={{
          alignItems: 'center',
          paddingBottom: insets.bottom + DS.space.xl,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.riveBlock}>
          <OnboardingCompleteRive riveFailed={riveFailed} onRiveFailed={() => setRiveFailed(true)} />
        </View>
        <Text style={styles.completeTitle}>You&apos;re in</Text>
        <Text style={styles.completeBody}>
          Welcome to the premium experience. Tutorial flows and deeper profile customization will arrive in a future
          update — for now, dive into the community.
        </Text>
        <AppleHeroButton loading={saving} onPress={() => void saveAndEnter()} style={styles.enterBtn}>
          Enter the community
        </AppleHeroButton>
        <Pressable
          onPress={() => {
            resetDraft();
            navigation.navigate('OnboardingName');
          }}
          hitSlop={12}
        >
          <Text style={styles.restart}>Start over</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.color.background },
  scroll: { paddingHorizontal: DS.space.lg, flexGrow: 1 },
  logoRow: { alignItems: 'center', marginBottom: DS.space.lg },
  stepTitle: {
    fontFamily: DS.font.heading,
    fontSize: 28,
    color: DS.color.text,
    letterSpacing: 1,
    marginBottom: DS.space.sm,
  },
  stepSub: {
    fontFamily: DS.font.body,
    fontSize: 15,
    color: DS.color.textMuted,
    lineHeight: 22,
    marginBottom: DS.space.xl,
  },
  field: { marginBottom: DS.apple.fieldGap },
  label: {
    fontFamily: DS.font.bodyMedium,
    fontSize: DS.type.labelUppercaseSize,
    fontWeight: '700',
    color: DS.color.gold,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: DS.space.sm,
  },
  input: {
    backgroundColor: DS.color.input,
    borderRadius: DS.apple.radiusField,
    paddingVertical: 14,
    paddingHorizontal: DS.space.md,
    fontSize: 16,
    color: DS.color.text,
    fontFamily: DS.font.body,
  },
  footer: {
    paddingHorizontal: DS.space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DS.apple.separator,
    paddingTop: DS.space.md,
    backgroundColor: DS.color.background,
  },
  footerRow: { flexDirection: 'row', gap: DS.space.md },
  footerHalf: { flex: 1 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: DS.space.sm },
  chip: {
    paddingVertical: 12,
    paddingHorizontal: DS.space.md,
    borderRadius: DS.apple.radiusButton,
    backgroundColor: DS.apple.fillSecondary,
    borderWidth: 1,
    borderColor: DS.apple.separator,
  },
  chipOn: {
    backgroundColor: DS.color.goldTint10,
    borderColor: DS.color.gold,
  },
  chipText: { fontFamily: DS.font.bodyMedium, fontSize: 15, color: DS.color.text },
  chipTextOn: { color: DS.color.gold },
  chipPrimary: {
    backgroundColor: DS.color.gold,
    borderColor: DS.color.gold,
  },
  chipPrimaryText: {
    color: DS.color.background,
    fontFamily: DS.font.bodyMedium,
  },
  chipCol: { gap: DS.space.sm },
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: DS.space.base,
    paddingHorizontal: DS.space.md,
    borderRadius: DS.apple.radiusField,
    backgroundColor: DS.apple.fillSecondary,
    borderWidth: 1,
    borderColor: DS.apple.separator,
  },
  choiceRowOn: {
    borderColor: DS.color.gold,
    backgroundColor: DS.color.goldTint10,
  },
  choiceText: { fontFamily: DS.font.body, fontSize: 16, color: DS.color.text, flex: 1 },
  choiceTextOn: { fontFamily: DS.font.bodyMedium, color: DS.color.gold },
  completeRoot: {
    flex: 1,
    backgroundColor: DS.color.background,
    paddingHorizontal: DS.space.lg,
    paddingTop: 56,
    alignItems: 'center',
  },
  riveBlock: {
    height: 220,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: DS.space.lg,
  },
  completeTitle: {
    fontFamily: DS.font.heading,
    fontSize: 32,
    color: DS.color.gold,
    letterSpacing: 2,
    marginBottom: DS.space.md,
    textAlign: 'center',
  },
  completeBody: {
    fontFamily: DS.font.body,
    fontSize: 15,
    color: DS.color.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: DS.space.xl,
    maxWidth: 340,
  },
  enterBtn: { alignSelf: 'stretch', width: '100%' },
  restart: {
    marginTop: DS.space.lg,
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.textMuted,
  },
});
