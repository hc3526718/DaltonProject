import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { AppleHeroButton } from './AppleHeroButton';
import { DS } from '../designSystem';
import { capitalizeProfileTag, capitalizeProfileTags } from '../lib/capitalizeProfileTags';
import { getSupabase } from '../lib/supabase';
import { DISCOVERY_OPTIONS, PERSONA_OPTIONS, SPORT_OPTIONS } from '../onboarding/onboardingCopy';
import {
  allocateAutoUsername,
  checkUsernameAvailable,
  isValidUsernameFormat,
  normalizeUsernameTyping,
} from '../profile/usernameProfile';
import { useUsernameAvailability } from '../profile/useUsernameAvailability';
import { MasterControlRecoverySteps } from './MasterControlRecoverySteps';
import { UsernameSetupFields, canProceedWithUsername } from './UsernameSetupFields';

type Props = {
  visible: boolean;
  onCompleted: () => void;
};

function oauthNameHints(meta: Record<string, unknown> | undefined): { first: string; last: string } {
  const full = typeof meta?.full_name === 'string' ? meta.full_name.trim() : '';
  const given = typeof meta?.given_name === 'string' ? meta.given_name.trim() : '';
  const family = typeof meta?.family_name === 'string' ? meta.family_name.trim() : '';
  if (given || family) return { first: given, last: family };
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return { first: parts[0] ?? '', last: parts.slice(1).join(' ') };
  }
  return { first: full, last: '' };
}

const WIZARD_LAST_INDEX = 4;

export function OAuthProfileSetupModal({ visible, onCompleted }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [wizardStep, setWizardStep] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [personaRole, setPersonaRole] = useState('');
  const [sports, setSports] = useState<string[]>([]);
  const [primarySport, setPrimarySport] = useState('');
  const [discoverySource, setDiscoverySource] = useState('');
  const [username, setUsername] = useState('');
  const [usernameSkipped, setUsernameSkipped] = useState(false);
  const [saving, setSaving] = useState(false);

  const supabase = getSupabase();
  const availability = useUsernameAvailability(
    supabase,
    user?.id,
    username,
    usernameSkipped || !visible,
  );

  useEffect(() => {
    if (!visible || !user) return;
    setWizardStep(0);
    setPersonaRole('');
    setSports([]);
    setPrimarySport('');
    setDiscoverySource('');
    setUsername('');
    setUsernameSkipped(false);
    setFirstName('');
    setLastName('');
    let cancelled = false;
    void (async () => {
      const s = getSupabase();
      if (!s) return;
      const { data } = await s.auth.getUser();
      if (cancelled || !data.user) return;
      const hints = oauthNameHints(data.user.user_metadata as Record<string, unknown> | undefined);
      setFirstName(hints.first);
      setLastName(hints.last);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, user?.id]);

  const pickPrimarySport = useCallback((s: string) => {
    setPrimarySport(s);
    setSports((prev) => (prev.includes(s) ? prev : [...prev, s]));
  }, []);

  const save = useCallback(async () => {
    if (!supabase || !user) {
      Alert.alert('Unable to save', 'Sign in again to finish setup.');
      return;
    }
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn || !ln) {
      Alert.alert('Name required', 'Please enter your first and last name.');
      return;
    }
    if (!personaRole) {
      Alert.alert('Role required', 'Tell us how you use Dalton.');
      return;
    }
    if (!primarySport.trim()) {
      Alert.alert('Sport required', 'Select your current sport so we can structure your recent results.');
      return;
    }
    if (!discoverySource) {
      Alert.alert('Almost there', 'Let us know how you heard about Dalton.');
      return;
    }
    setSaving(true);
    let usernameFinal: string;
    try {
      if (usernameSkipped) {
        usernameFinal = await allocateAutoUsername(supabase, fn, user.id);
      } else {
        usernameFinal = normalizeUsernameTyping(username);
        if (!isValidUsernameFormat(usernameFinal)) {
          setSaving(false);
          Alert.alert('Username', 'Choose a valid username.');
          return;
        }
        const avail = await checkUsernameAvailable(supabase, usernameFinal, user.id);
        if (!avail) {
          setSaving(false);
          Alert.alert('Username taken', 'Pick another username.');
          return;
        }
      }
    } catch (e) {
      setSaving(false);
      Alert.alert('Username', e instanceof Error ? e.message : 'Could not set username.');
      return;
    }

    const displayName = `${fn} ${ln}`.trim();
    const { error } = await supabase.from('profiles').upsert(
      {
        id: user.id,
        username: usernameFinal,
        first_name: fn,
        last_name: ln,
        display_name: displayName,
        persona_role: personaRole,
        sports: capitalizeProfileTags(sports),
        primary_sport: capitalizeProfileTag(primarySport.trim()),
        discovery_source: discoverySource,
        onboarding_completed_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
    setSaving(false);
    if (error) {
      if (error.code === '23505') {
        Alert.alert('Username taken', 'That username was just claimed. Try another.');
      } else {
        Alert.alert('Could not save profile', error.message);
      }
      return;
    }
    onCompleted();
  }, [
    discoverySource,
    firstName,
    lastName,
    onCompleted,
    personaRole,
    sports,
    supabase,
    user,
    username,
    usernameSkipped,
  ]);

  const canAdvanceFromStep = useCallback((): boolean => {
    if (wizardStep === 0) return firstName.trim().length > 0 && lastName.trim().length > 0;
    if (wizardStep === 1)
      return canProceedWithUsername(usernameSkipped, username, availability);
    if (wizardStep === 2) return Boolean(personaRole);
    if (wizardStep === 3) return Boolean(primarySport.trim());
    if (wizardStep === 4) return Boolean(discoverySource);
    return false;
  }, [
    availability,
    discoverySource,
    firstName,
    lastName,
    personaRole,
    primarySport,
    username,
    usernameSkipped,
    wizardStep,
  ]);

  const goNext = useCallback(() => {
    if (!canAdvanceFromStep()) return;
    if (wizardStep >= WIZARD_LAST_INDEX) {
      void save();
      return;
    }
    setWizardStep((s) => Math.min(WIZARD_LAST_INDEX, s + 1));
  }, [canAdvanceFromStep, save, wizardStep]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        Alert.alert(
          'Finish setup',
          'Complete this quick profile so the community knows who you are.',
        );
      }}
    >
      <KeyboardAvoidingView
        style={styles.scrim}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.card, { marginTop: Math.max(insets.top, DS.space.base) }]}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <Text style={styles.stepBadge}>
              Step {wizardStep + 1} of {WIZARD_LAST_INDEX + 1}
            </Text>
            {wizardStep === 0 ? (
              <>
                <Text style={styles.title}>Welcome</Text>
                <Text style={styles.lead}>
                  You signed in with Apple or Google. Tell us your name so the community knows who you are.
                </Text>
                <Field label="First name">
                  <TextInput
                    value={firstName}
                    onChangeText={setFirstName}
                    style={styles.input}
                    placeholder="First name"
                    placeholderTextColor={DS.color.textMuted}
                    autoCapitalize="words"
                  />
                </Field>
                <Field label="Last name">
                  <TextInput
                    value={lastName}
                    onChangeText={setLastName}
                    style={styles.input}
                    placeholder="Last name"
                    placeholderTextColor={DS.color.textMuted}
                    autoCapitalize="words"
                  />
                </Field>
              </>
            ) : null}

            {wizardStep === 1 ? (
              <>
                <Text style={styles.title}>Choose a username</Text>
                <Text style={styles.lead}>
                  This is how you&apos;ll appear across Dalton — or skip and we&apos;ll assign one from your first
                  name.
                </Text>
                <Text style={styles.fieldHint}>Choose your handle or skip for an auto-assigned name.</Text>
                <UsernameSetupFields
                  firstNameForPreview={firstName}
                  usernameInput={username}
                  onUsernameInputChange={setUsername}
                  skipped={usernameSkipped}
                  onSkippedChange={(skipped) => {
                    setUsernameSkipped(skipped);
                    if (skipped) setUsername('');
                  }}
                  availability={availability}
                />
              </>
            ) : null}

            {wizardStep === 2 ? (
              <>
                <Text style={styles.title}>Your role</Text>
                <Text style={styles.lead}>How do you mainly use Dalton?</Text>
                <View style={styles.chipGrid}>
                  {PERSONA_OPTIONS.map((o) => {
                    const on = personaRole === o.id;
                    return (
                      <Pressable
                        key={o.id}
                        onPress={() => setPersonaRole(o.id)}
                        style={[styles.chip, on && styles.chipOn]}
                      >
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            {wizardStep === 3 ? (
              <>
                <Text style={styles.title}>Sport you currently compete in</Text>
                <Text style={styles.lead}>
                  This is used to structure recent results. You can add more sports later from your profile.
                </Text>
                <View style={styles.chipGrid}>
                  {SPORT_OPTIONS.map((s) => {
                    const on = primarySport === s;
                    return (
                      <Pressable
                        key={s}
                        onPress={() => pickPrimarySport(s)}
                        style={[styles.chip, on && styles.chipPrimary]}
                      >
                        <Text style={[styles.chipText, on && styles.chipPrimaryText]}>{s}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            {wizardStep === 4 ? (
              <>
                <Text style={styles.title}>How did you find us?</Text>
                <Text style={styles.lead}>Helps us improve how we reach athletes and coaches.</Text>
                <View style={styles.choiceCol}>
                  {DISCOVERY_OPTIONS.map((o) => {
                    const on = discoverySource === o.id;
                    return (
                      <Pressable
                        key={o.id}
                        onPress={() => setDiscoverySource(o.id)}
                        style={[styles.choiceRow, on && styles.choiceRowOn]}
                      >
                        <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{o.label}</Text>
                        {on ? <FontAwesome5 name="check" size={16} color={DS.color.gold} solid /> : null}
                      </Pressable>
                    );
                  })}
                </View>
                <MasterControlRecoverySteps
                  style={{ marginTop: DS.space.lg, marginBottom: DS.space.sm }}
                  includesPasswordGate={false}
                />
              </>
            ) : null}
          </ScrollView>
          <View style={[styles.wizardFooter, { paddingBottom: insets.bottom + DS.space.md }]}>
            {wizardStep === 0 ? (
              <AppleHeroButton
                disabled={!canAdvanceFromStep() || saving}
                loading={false}
                onPress={() => void goNext()}
              >
                Continue
              </AppleHeroButton>
            ) : (
              <View style={styles.footerRow}>
                <AppleHeroButton
                  variant="ghost"
                  style={styles.footerHalf}
                  onPress={() => setWizardStep((s) => Math.max(0, s - 1))}
                  disabled={saving}
                >
                  Back
                </AppleHeroButton>
                <AppleHeroButton
                  style={styles.footerHalf}
                  disabled={!canAdvanceFromStep() || saving}
                  loading={saving && wizardStep === WIZARD_LAST_INDEX}
                  onPress={() => void goNext()}
                >
                  {wizardStep === WIZARD_LAST_INDEX ? 'Save & continue' : 'Continue'}
                </AppleHeroButton>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
  scrim: {
    flex: 1,
    backgroundColor: DS.color.overlayDark80,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: DS.space.lg,
    paddingBottom: DS.space.md,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '92%',
    backgroundColor: 'rgba(16,16,16,0.97)',
    borderRadius: DS.radius.xl,
    borderWidth: 1,
    borderColor: DS.color.goldTint30,
    paddingHorizontal: DS.space.lg,
    paddingTop: DS.space.lg,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: DS.space.md,
  },
  stepBadge: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 12,
    letterSpacing: 1.2,
    color: DS.color.gold,
    textTransform: 'uppercase',
    marginBottom: DS.space.md,
  },
  wizardFooter: {
    paddingTop: DS.space.md,
    borderTopWidth: 1,
    borderTopColor: DS.color.goldTint30,
    marginTop: DS.space.sm,
  },
  footerRow: { flexDirection: 'row', gap: DS.space.md },
  footerHalf: { flex: 1 },
  title: {
    fontFamily: DS.font.heading,
    fontSize: 22,
    letterSpacing: 0.8,
    color: DS.color.text,
    marginBottom: DS.space.sm,
  },
  lead: {
    fontFamily: DS.font.body,
    fontSize: 14,
    lineHeight: 21,
    color: DS.color.textMuted,
    marginBottom: DS.space.lg,
  },
  field: { marginBottom: DS.space.md },
  fieldHint: {
    fontFamily: DS.font.body,
    fontSize: 13,
    color: DS.color.textMuted,
    marginBottom: DS.space.sm,
  },
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
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: DS.space.sm },
  chip: {
    paddingVertical: 10,
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
  chipText: { fontFamily: DS.font.bodyMedium, fontSize: 14, color: DS.color.text },
  chipTextOn: { color: DS.color.gold },
  chipPrimary: {
    backgroundColor: DS.color.gold,
    borderColor: DS.color.gold,
  },
  chipPrimaryText: { color: DS.color.background, fontFamily: DS.font.bodyMedium },
  choiceCol: { gap: DS.space.sm },
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
  choiceText: { fontFamily: DS.font.body, fontSize: 15, color: DS.color.text, flex: 1 },
  choiceTextOn: { fontFamily: DS.font.bodyMedium, color: DS.color.gold },
});
