import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { AppLoadingIndicator } from '../components/AppLoadingIndicator';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/ScreenHeader';
import { DS } from '../designSystem';
import { getSupabase } from '../lib/supabase';
import { getSignInMethods } from '../lib/authSignInMethods';
import { getDaltonWebUrl } from '../lib/env';
import { BRAND_CONTACT_RESPONSE_WINDOW } from '../constants/brand';
import {
  DEFAULT_NOTIFY_PREFS,
  IN_APP_NOTIFY_LABELS,
  invalidateInAppNotifyPrefsCache,
  loadInAppNotifyPrefs,
  saveInAppNotifyPrefs,
  sanitizeInAppPrefsForAccount,
  type InAppNotifyCategory,
  type InAppNotifyPrefs,
} from '../lib/notificationBannerPrefs';
import { inAppNotifyCategoriesForUser, isMasterControlUser } from '../lib/notifyPrefsAccess';
import { setPushDeliveryEnabled } from '../lib/pushPrefsGate';
import {
  getPushPermissionSnapshot,
  openDeviceNotificationSettings,
  requestPushPermissions,
  tryRegisterPushToken,
  type PushPermissionSnapshot,
} from '../lib/pushRegistration';
import { unregisterDevicePushToken } from '../roadmap/notificationsService';

const BANNER_TOGGLE_SUB: Partial<Record<InAppNotifyCategory, string>> = {
  postInteraction: 'Likes, comments, follows, mentions.',
  messages: 'Direct messages & threads.',
  eventAttendance: 'Check-in and attendance outcomes.',
  eventBooking: 'Reservations & booking confirmations.',
  eventCreation: 'New events you publish for your profile.',
  mediaCreation: 'Media uploads & publishing confirmations.',
  masterProposals: 'Sponsorship, media, and event proposals sent to you.',
  system: 'Anything that does not match the categories above.',
};
import type { AllowMessagesFrom } from '../messaging/messagingPrefs';
import { getAllowMessagesFrom, setAllowMessagesFrom } from '../messaging/messagingPrefs';
import { syncAllowMessagesFromRemote } from '../messaging/dmPolicySync';
import type { ProfileStackParamList } from '../navigation/types';
import { useAccessibility } from '../accessibility/AccessibilityContext';
import { ScreenShell } from '../theme/ScreenShell';
import { ThemedText } from '../theme/ThemedText';
import type { AccessibleColors } from '../lib/accessibilityTheme';
import { useThemeStyles } from '../theme/useThemeStyles';
import { useActionBanner } from '../actionBanner/ActionBannerContext';
import { useAuth } from '../auth/AuthContext';
import { fetchProfileByUserId } from '../roadmap/profileService';
import { fetchUserPrefsDoc, patchUserPrefsDoc } from '../roadmap/userSettingsService';

type PProps<K extends keyof ProfileStackParamList> = NativeStackScreenProps<ProfileStackParamList, K>;

export function AccountSecurityScreen({ navigation }: PProps<'AccountSecurity'>) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const showBanner = useActionBanner();
  const isDemo = !user?.id || user.id.startsWith('demo-');
  const [signingOutOthers, setSigningOutOthers] = useState(false);
  const [hasEmailPassword, setHasEmailPassword] = useState<boolean | null>(null);
  const [oauthLabel, setOauthLabel] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        if (isDemo) {
          if (alive) {
            setHasEmailPassword(false);
            setOauthLabel(null);
          }
          return;
        }
        const methods = await getSignInMethods();
        if (!alive) return;
        if (!methods) {
          setHasEmailPassword(null);
          setOauthLabel(null);
          return;
        }
        setHasEmailPassword(methods.hasEmailPassword);
        if (!methods.hasEmailPassword) {
          if (methods.hasGoogle && methods.hasApple) setOauthLabel('Google and Apple');
          else if (methods.hasGoogle) setOauthLabel('Google');
          else if (methods.hasApple) setOauthLabel('Apple');
          else setOauthLabel('your sign-in provider');
        } else {
          setOauthLabel(null);
        }
      })();
      return () => {
        alive = false;
      };
    }, [isDemo]),
  );

  const onSignOutOthers = useCallback(() => {
    if (isDemo) {
      showBanner('Sign in required', 'This action only works for live accounts.');
      return;
    }
    Alert.alert(
      'Sign out other sessions?',
      'This signs you out everywhere except this device. Use it if you suspect another device has access to your account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out others',
          style: 'destructive',
          onPress: () => {
            const supabase = getSupabase();
            if (!supabase) {
              showBanner('Not available', 'Supabase is not configured for this build.');
              return;
            }
            setSigningOutOthers(true);
            void (async () => {
              const { error } = await supabase.auth.signOut({ scope: 'others' });
              setSigningOutOthers(false);
              if (error) {
                showBanner('Could not sign out', error.message);
                return;
              }
              showBanner('Signed out others', 'All other sessions for your account have been ended.');
            })();
          },
        },
      ],
    );
  }, [isDemo, showBanner]);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Account & Security" onBack={() => navigation.goBack()} largeTitle />
      <ScrollView
        contentContainerStyle={[styles.padded, { paddingBottom: 32 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.cardKicker}>Sign-in</Text>
        <View style={styles.card}>
          <Text style={styles.labelSm}>Email</Text>
          <TextInput
            style={styles.input}
            value={user?.email?.trim() || '—'}
            placeholderTextColor={DS.color.textMuted}
            editable={false}
          />
          {hasEmailPassword ? (
            <>
              <Text style={styles.labelSmSpaced}>Password</Text>
              <Pressable
                style={styles.rowBtn}
                onPress={() => {
                  if (isDemo) {
                    showBanner('Sign in required', 'Password changes work for live accounts only.');
                    return;
                  }
                  navigation.navigate('ChangePassword');
                }}
              >
                <Text style={styles.rowBtnText}>Change password</Text>
                <FontAwesome name="chevron-right" size={12} color={DS.color.textMuted} />
              </Pressable>
            </>
          ) : hasEmailPassword === false && oauthLabel ? (
            <Text style={[styles.toggleSub, { marginTop: DS.space.md }]}>
              You signed in with {oauthLabel}. Passwords are managed by that provider — there is
              nothing to change here.
            </Text>
          ) : null}
        </View>

        <Text style={styles.cardKickerSpaced}>Two-factor authentication</Text>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Authenticator app</Text>
              <Text style={styles.toggleSub}>
                Two-factor authentication is managed in Supabase Auth for your account. In-app enrollment will be added
                in a future release; contact Support if you need MFA enabled before then.
              </Text>
            </View>
            <View style={styles.statusPillMuted}>
              <Text style={styles.statusPillMutedText}>Coming soon</Text>
            </View>
          </View>
        </View>

        <Text style={styles.cardKickerSpaced}>Sessions</Text>
        <View style={styles.card}>
          <View style={styles.sessionRow}>
            <FontAwesome name="mobile" size={16} color={DS.color.gold} />
            <Text style={styles.sessionText}>This device — currently signed in</Text>
          </View>
          <Text style={[styles.toggleSub, { marginTop: 4 }]}>
            Supabase Auth does not list every refresh token here. Use the action below to invalidate other
            sessions on suspicion of compromise.
          </Text>
        </View>
        <Pressable
          style={[styles.dangerOutline, signingOutOthers && { opacity: 0.6 }]}
          onPress={onSignOutOthers}
          disabled={signingOutOthers}
        >
          {signingOutOthers ? (
            <AppLoadingIndicator size={24} />
          ) : (
            <Text style={styles.dangerOutlineText}>Sign out all other sessions</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

export function ChangePasswordScreen({ navigation }: PProps<'ChangePassword'>) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const showBanner = useActionBanner();
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        if (!user?.id || user.id.startsWith('demo-')) {
          if (alive) setAllowed(false);
          return;
        }
        const methods = await getSignInMethods();
        if (!alive) return;
        const ok = methods?.hasEmailPassword === true;
        setAllowed(ok);
        if (!ok) {
          Alert.alert(
            'Not available',
            'Password changes apply only to email-and-password accounts. Google and Apple sign-in manage passwords separately.',
            [{ text: 'OK', onPress: () => navigation.goBack() }],
          );
        }
      })();
      return () => {
        alive = false;
      };
    }, [navigation, user?.id]),
  );

  const submit = useCallback(() => {
    if (busy) return;
    if (!user?.id || user.id.startsWith('demo-')) {
      Alert.alert('Sign in required', 'Password changes work for live accounts only.');
      return;
    }
    const errs: string[] = [];
    if (next.length < 8) errs.push('Use at least 8 characters.');
    if (!/[A-Z]/.test(next) || !/[a-z]/.test(next) || !/\d/.test(next)) {
      errs.push('Mix upper/lowercase letters and at least one number.');
    }
    if (next !== confirm) errs.push('New password and confirmation do not match.');
    if (errs.length) {
      Alert.alert('Check password', errs.join('\n'));
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      Alert.alert('Not available', 'Supabase is not configured for this build.');
      return;
    }
    setBusy(true);
    void (async () => {
      const { error } = await supabase.auth.updateUser({ password: next });
      setBusy(false);
      if (error) {
        Alert.alert('Could not change password', error.message);
        return;
      }
      setNext('');
      setConfirm('');
      showBanner('Password updated', 'Your password has been changed.');
      navigation.goBack();
    })();
  }, [busy, user?.id, next, confirm, navigation, showBanner]);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Change password" onBack={() => navigation.goBack()} largeTitle />
      <ScrollView
        contentContainerStyle={[styles.padded, { paddingBottom: 32 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {allowed === false ? (
          <Text style={styles.bodyMuted}>
            This screen is only for accounts created with email and password.
          </Text>
        ) : (
          <Text style={styles.bodyMuted}>
            Choose a new password. We recommend a unique password you do not use elsewhere — at least 8
            characters with letters and a number.
          </Text>
        )}

        <View style={styles.card}>
          <Text style={styles.labelSm}>New password</Text>
          <TextInput
            style={[styles.input, { color: DS.color.text }]}
            value={next}
            onChangeText={setNext}
            placeholder="At least 8 characters"
            placeholderTextColor={DS.color.textMuted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
          />
          <Text style={styles.labelSmSpaced}>Confirm new password</Text>
          <TextInput
            style={[styles.input, { color: DS.color.text }]}
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Repeat the password"
            placeholderTextColor={DS.color.textMuted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
          />
        </View>

        <Pressable
          style={[styles.primaryBtn, (busy || allowed !== true) && { opacity: 0.6 }]}
          onPress={submit}
          disabled={busy || allowed !== true}
        >
          {busy ? (
            <AppLoadingIndicator size={24} />
          ) : (
            <Text style={styles.primaryBtnText}>Update password</Text>
          )}
        </Pressable>
        <Pressable style={styles.ghostBtn} onPress={() => navigation.goBack()} disabled={busy}>
          <Text style={styles.ghostBtnText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

export function PrivacyVisibilityScreen({ navigation }: PProps<'PrivacyVisibility'>) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const showBanner = useActionBanner();
  const [showResults, setShowResults] = useState(true);
  const [dataShare, setDataShare] = useState(false);
  const [dmPolicy, setDmPolicy] = useState<AllowMessagesFrom>(() => getAllowMessagesFrom());

  useFocusEffect(
    useCallback(() => {
      if (!user?.id || user.id.startsWith('demo-')) return;
      void (async () => {
        const [p, doc] = await Promise.all([fetchProfileByUserId(user.id), fetchUserPrefsDoc(user.id)]);
        const raw = p?.allow_messages_from?.trim();
        if (raw === 'everyone' || raw === 'followers_only' || raw === 'friends_only') {
          setAllowMessagesFrom(raw);
          setDmPolicy(raw);
        }
        const pr = doc.privacy;
        if (pr?.show_recent_results != null) setShowResults(pr.show_recent_results);
        if (pr?.profile_public === false) {
          void patchUserPrefsDoc(user.id, { privacy: { profile_public: true } });
        }
        if (pr?.partner_analytics != null) setDataShare(pr.partner_analytics);
      })();
    }, [user?.id]),
  );

  const applyDm = (value: AllowMessagesFrom) => {
    const rollback = dmPolicy;
    setAllowMessagesFrom(value);
    setDmPolicy(value);
    if (!user?.id || user.id.startsWith('demo-')) {
      showBanner('Saved here only', 'Sign in to sync this to your account.');
      return;
    }
    void (async () => {
      const ok = await syncAllowMessagesFromRemote(user.id, value);
      if (!ok) {
        setAllowMessagesFrom(rollback);
        setDmPolicy(rollback);
        showBanner('Could not save', 'Check your connection. Restored your previous choice.');
      } else {
        showBanner('Saved', 'Who can message you is updated on your account.');
      }
    })();
  };

  const applyPrivacy = useCallback(
    (
      patch: Partial<{ show_recent_results: boolean; partner_analytics: boolean }>,
      rollback: { showResults: boolean; dataShare: boolean },
    ) => {
      if (patch.show_recent_results != null) setShowResults(patch.show_recent_results);
      if (patch.partner_analytics != null) setDataShare(patch.partner_analytics);

      if (!user?.id || user.id.startsWith('demo-')) {
        showBanner('Saved here only', 'Sign in to sync privacy preferences to your account.');
        return;
      }
      void (async () => {
        const ok = await patchUserPrefsDoc(user.id, {
          privacy: { ...patch, profile_public: true },
        });
        if (!ok) {
          setShowResults(rollback.showResults);
          setDataShare(rollback.dataShare);
          showBanner('Could not save', 'Check your connection. Restored your previous choices.');
        } else {
          showBanner('Saved', 'Privacy preferences updated.');
        }
      })();
    },
    [user?.id, showBanner],
  );

  return (
    <View style={styles.root}>
      <ScreenHeader title="Privacy & Visibility" onBack={() => navigation.goBack()} largeTitle />
      <ScrollView
        contentContainerStyle={[styles.padded, { paddingBottom: 32 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.bodyMuted}>
          All member profiles are public and visible in search and community. Control messaging and
          how your information is used below.
        </Text>
        <Text style={styles.cardKicker}>Direct messages</Text>
        <Text style={styles.bodyMutedSm}>Who can start a new conversation with you.</Text>
        <View style={styles.card}>
          {(
            [
              { key: 'everyone' as const, label: 'Everyone', sub: 'Including people you do not follow' },
              { key: 'followers_only' as const, label: 'Followers only', sub: 'Must follow you first' },
              { key: 'friends_only' as const, label: 'Friends only', sub: 'Mutual follows / accepted requests' },
            ] as const
          ).map((opt) => (
            <Pressable
              key={opt.key}
              style={[styles.dmRow, dmPolicy === opt.key && styles.dmRowOn]}
              onPress={() => applyDm(opt.key)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.dmRowTitle}>{opt.label}</Text>
                <Text style={styles.dmRowSub}>{opt.sub}</Text>
              </View>
              <View style={[styles.radioOuter, dmPolicy === opt.key && styles.radioOuterOn]}>
                {dmPolicy === opt.key ? <View style={styles.radioInner} /> : null}
              </View>
            </Pressable>
          ))}
        </View>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Show recent results</Text>
              <Text style={styles.toggleSub}>Display meet marks on your profile.</Text>
            </View>
            <Switch
              value={showResults}
              onValueChange={(v) => applyPrivacy({ show_recent_results: v }, { showResults, dataShare })}
              trackColor={{ true: DS.color.goldTint30 }}
            />
          </View>
          {isMasterControlUser(user) ? (
            <>
              <View style={styles.hairline} />
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Partner analytics</Text>
                  <Text style={styles.toggleSub}>Share anonymized usage with sponsors.</Text>
                </View>
                <Switch
                  value={dataShare}
                  onValueChange={(v) =>
                    applyPrivacy({ partner_analytics: v }, { showResults, dataShare })
                  }
                  trackColor={{ true: DS.color.goldTint30 }}
                />
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function pushPermissionLabel(snapshot: PushPermissionSnapshot): string {
  if (snapshot.status === 'granted') return 'Allowed on this device';
  if (snapshot.status === 'denied') return 'Blocked on this device — open system settings';
  if (snapshot.status === 'undetermined') return 'Not set yet — tap Enable below';
  return 'Unavailable in this build (reinstall dev client with notifications)';
}

export function NotificationPrefsScreen({ navigation }: PProps<'NotificationPrefs'>) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const showBanner = useActionBanner();
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(true);
  const [events, setEvents] = useState(true);
  const [community, setCommunity] = useState(false);
  const [masterProposals, setMasterProposals] = useState(true);
  const [bannerPrefs, setBannerPrefs] = useState<InAppNotifyPrefs>(DEFAULT_NOTIFY_PREFS);
  const [pushPermission, setPushPermission] = useState<PushPermissionSnapshot>({
    status: 'undetermined',
    canAskAgain: true,
  });
  const isMaster = isMasterControlUser(user);
  const bannerToggleOrder = inAppNotifyCategoriesForUser(isMaster);

  const refreshPushPermission = useCallback(async () => {
    setPushPermission(await getPushPermissionSnapshot());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await refreshPushPermission();
        if (user?.id && !user.id.startsWith('demo-')) {
          void tryRegisterPushToken(user.id);
        }
        let prefs = await loadInAppNotifyPrefs();
        if (user?.id && !user.id.startsWith('demo-')) {
          const doc = await fetchUserPrefsDoc(user.id);
          const ch = doc.notification_channels;
          if (ch?.push != null) {
            setPush(ch.push);
            setPushDeliveryEnabled(ch.push);
          }
          if (ch?.email != null) setEmail(ch.email);
          if (ch?.event_reminders != null) setEvents(ch.event_reminders);
          if (ch?.community_mentions != null) setCommunity(ch.community_mentions);
          if (ch?.master_proposals != null) setMasterProposals(ch.master_proposals);
          if (doc.in_app_notify) {
            prefs = sanitizeInAppPrefsForAccount(
              { ...prefs, ...doc.in_app_notify },
              isMaster,
            );
            invalidateInAppNotifyPrefsCache();
            await saveInAppNotifyPrefs(prefs);
          }
        }
        setBannerPrefs(sanitizeInAppPrefsForAccount(prefs, isMaster));
      })();
    }, [isMaster, refreshPushPermission, user?.id]),
  );

  const onEnableDevicePush = useCallback(async () => {
    const next = await requestPushPermissions();
    setPushPermission(next);
    if (next.status === 'granted' && user?.id && !user.id.startsWith('demo-')) {
      await tryRegisterPushToken(user.id);
      showBanner('Notifications enabled', 'This device can receive push alerts from the academy.');
    } else if (next.status === 'denied') {
      showBanner('Notifications blocked', 'Open system notification settings to allow alerts.');
    }
  }, [showBanner, user?.id]);

  const patchNotifyChannel = useCallback(
    (
      patch: Partial<{
        push: boolean;
        email: boolean;
        event_reminders: boolean;
        community_mentions: boolean;
        master_proposals: boolean;
      }>,
      rollback: {
        push: boolean;
        email: boolean;
        events: boolean;
        community: boolean;
        masterProposals: boolean;
      },
    ) => {
      if (patch.push != null) {
        setPush(patch.push);
        setPushDeliveryEnabled(patch.push);
      }
      if (patch.email != null) setEmail(patch.email);
      if (patch.event_reminders != null) setEvents(patch.event_reminders);
      if (patch.community_mentions != null) setCommunity(patch.community_mentions);
      if (patch.master_proposals != null) setMasterProposals(patch.master_proposals);

      if (!user?.id || user.id.startsWith('demo-')) {
        showBanner('Saved here only', 'Sign in to sync notification preferences to your account.');
        return;
      }
      void (async () => {
        const ok = await patchUserPrefsDoc(user.id, { notification_channels: patch });
        if (!ok) {
          setPush(rollback.push);
          setEmail(rollback.email);
          setEvents(rollback.events);
          setCommunity(rollback.community);
          setMasterProposals(rollback.masterProposals);
          setPushDeliveryEnabled(rollback.push);
          showBanner('Could not save', 'Check your connection. Restored your previous choices.');
          return;
        }
        if (patch.push === true) {
          await tryRegisterPushToken(user.id);
        } else if (patch.push === false) {
          await unregisterDevicePushToken(user.id);
        }
        showBanner('Saved', 'Notification preferences updated.');
      })();
    },
    [user?.id, showBanner],
  );

  const patchBanner = async (partial: Partial<InAppNotifyPrefs>) => {
    const merged = sanitizeInAppPrefsForAccount(
      { ...(await loadInAppNotifyPrefs()), ...partial },
      isMaster,
    );
    invalidateInAppNotifyPrefsCache();
    await saveInAppNotifyPrefs(merged);
    setBannerPrefs(merged);
    if (user?.id && !user.id.startsWith('demo-')) {
      await patchUserPrefsDoc(user.id, { in_app_notify: merged });
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Notifications" onBack={() => navigation.goBack()} largeTitle />
      <ScrollView
        contentContainerStyle={[styles.padded, { paddingBottom: 32 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.cardKicker}>Device notification manager</Text>
        <Text style={styles.bodyMuted}>
          iOS and Android control alerts in system settings. Enable here first, then choose which types
          of academy notifications you want below.
        </Text>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1, paddingRight: DS.space.md }}>
              <Text style={styles.toggleTitle}>System permission</Text>
              <Text style={styles.toggleSub}>{pushPermissionLabel(pushPermission)}</Text>
            </View>
          </View>
          {pushPermission.status !== 'granted' ? (
            <>
              <View style={styles.hairline} />
              <Pressable style={styles.notifyActionRow} onPress={() => void onEnableDevicePush()}>
                <FontAwesome name="bell-o" size={16} color={DS.color.gold} />
                <Text style={styles.notifyActionTxt}>Enable notifications on this device</Text>
              </Pressable>
            </>
          ) : null}
          <View style={styles.hairline} />
          <Pressable
            style={styles.notifyActionRow}
            onPress={() => {
              openDeviceNotificationSettings();
              void refreshPushPermission();
            }}
          >
            <FontAwesome name="cog" size={16} color={DS.color.gold} />
            <Text style={styles.notifyActionTxt}>Open system notification settings</Text>
          </Pressable>
        </View>

        <Text style={styles.cardKickerSpaced}>Academy channels</Text>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleTitle}>Push notifications</Text>
            <Switch
              value={push}
              onValueChange={(v) =>
                patchNotifyChannel({ push: v }, { push, email, events, community, masterProposals })
              }
              trackColor={{ true: DS.color.goldTint30 }}
            />
          </View>
          <View style={styles.hairline} />
          <View style={styles.toggleRow}>
            <Text style={styles.toggleTitle}>Email digest</Text>
            <Switch
              value={email}
              onValueChange={(v) =>
                patchNotifyChannel({ email: v }, { push, email, events, community, masterProposals })
              }
              trackColor={{ true: DS.color.goldTint30 }}
            />
          </View>
          <View style={styles.hairline} />
          <View style={styles.toggleRow}>
            <Text style={styles.toggleTitle}>Event reminders</Text>
            <Switch
              value={events}
              onValueChange={(v) =>
                patchNotifyChannel({ event_reminders: v }, { push, email, events, community, masterProposals })
              }
              trackColor={{ true: DS.color.goldTint30 }}
            />
          </View>
          <View style={styles.hairline} />
          <View style={styles.toggleRow}>
            <Text style={styles.toggleTitle}>Community mentions</Text>
            <Switch
              value={community}
              onValueChange={(v) =>
                patchNotifyChannel({ community_mentions: v }, { push, email, events, community, masterProposals })
              }
              trackColor={{ true: DS.color.goldTint30 }}
            />
          </View>
          {isMaster ? (
            <>
              <View style={styles.hairline} />
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Master proposals</Text>
                  <Text style={styles.toggleSub}>
                    Push & email when creators submit sponsorship, media, or event proposals.
                  </Text>
                </View>
                <Switch
                  value={masterProposals}
                  onValueChange={(v) =>
                    patchNotifyChannel(
                      { master_proposals: v },
                      { push, email, events, community, masterProposals },
                    )
                  }
                  trackColor={{ true: DS.color.goldTint30 }}
                />
              </View>
            </>
          ) : null}
        </View>

        <Text style={styles.cardKickerSpaced}>In-app banners</Text>
        <Text style={styles.bodyMuted}>
          Controls which in-app banners and popups you see while using the app. Master-only categories appear
          only on master control accounts.
        </Text>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Allow in-app banners</Text>
              <Text style={styles.toggleSub}>Master switch for future in-app notification surfaces.</Text>
            </View>
            <Switch
              value={bannerPrefs.enabled}
              onValueChange={(v) => void patchBanner({ enabled: v })}
              trackColor={{ true: DS.color.goldTint30 }}
            />
          </View>
          {bannerToggleOrder.map((key) => (
            <View key={key}>
              <View style={styles.hairline} />
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>{IN_APP_NOTIFY_LABELS[key]}</Text>
                  <Text style={styles.toggleSub}>{BANNER_TOGGLE_SUB[key] ?? ''}</Text>
                </View>
                <Switch
                  value={bannerPrefs[key]}
                  onValueChange={(v) => void patchBanner({ [key]: v } as Partial<InAppNotifyPrefs>)}
                  trackColor={{ true: DS.color.goldTint30 }}
                  disabled={!bannerPrefs.enabled}
                />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export function AccessibilityScreen({ navigation }: PProps<'Accessibility'>) {
  const insets = useSafeAreaInsets();
  const showBanner = useActionBanner();
  const { prefs, ready, updatePrefs, colors } = useAccessibility();
  const themed = useThemeStyles(createAccessibilityScreenStyles);

  const patch = async (partial: Parameters<typeof updatePrefs>[0], label: string) => {
    await updatePrefs(partial);
    const on = Object.values(partial)[0] === true;
    showBanner(label, on ? 'Enabled' : 'Disabled');
  };

  if (!ready) {
    return (
      <ScreenShell>
        <ScreenHeader title="Accessibility" onBack={() => navigation.goBack()} largeTitle />
        <View style={[styles.padded, { paddingBottom: 32 + insets.bottom }]}>
          <ThemedText variant="muted">Loading…</ThemedText>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <ScreenHeader title="Accessibility" onBack={() => navigation.goBack()} largeTitle />
      <ScrollView
        contentContainerStyle={[styles.padded, { paddingBottom: 32 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText variant="muted" style={{ marginBottom: DS.space.md }}>
          Preferences sync to your account when signed in, so iOS, Android, and web stay aligned.
          The Dalton Grant Academy uses a dark interface by default. Changes below update this screen immediately.
        </ThemedText>

        <View style={[styles.card, themed.card]}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.toggleTitle}>Dark interface</ThemedText>
              <ThemedText variant="muted" style={styles.toggleSub}>
                Always on — optimized for low-light viewing.
              </ThemedText>
            </View>
            <FontAwesome name="check-circle" size={22} color={colors.gold} />
          </View>
        </View>

        <ThemedText variant="muted" style={[styles.cardKickerSpaced, themed.kicker]}>
          Display
        </ThemedText>
        <View style={[styles.card, themed.card]}>
          <View style={styles.toggleRowCol}>
            <ThemedText style={styles.toggleTitle}>Larger Text</ThemedText>
            <ThemedText variant="muted" style={styles.toggleSub}>
              Scale text up to improve readability. Locks at 1×, 2×, or 3×.
            </ThemedText>
            <View style={styles.textScaleRow}>
              {([1, 2, 3] as const).map((level) => {
                const active = prefs.textScaleLevel === level;
                return (
                  <Pressable
                    key={level}
                    style={[themed.textScaleChip, active && themed.textScaleChipActive]}
                    onPress={() =>
                      void patch({ textScaleLevel: level, largerText: level > 1 }, `${level}× text`)
                    }
                  >
                    <Text
                      style={[themed.textScaleChipTxt, active && themed.textScaleChipTxtActive]}
                    >
                      {level}×
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={[styles.hairline, { backgroundColor: colors.borderHairline }]} />
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.toggleTitle}>Differentiate Without Color</ThemedText>
              <ThemedText variant="muted" style={styles.toggleSub}>
                Icons, labels, and borders in addition to color.
              </ThemedText>
            </View>
            <Switch
              value={prefs.differentiateWithoutColor}
              onValueChange={(v) => void patch({ differentiateWithoutColor: v }, 'Differentiate Without Color')}
              trackColor={{ true: colors.goldTint30 }}
            />
          </View>
          <View style={[styles.hairline, { backgroundColor: colors.borderHairline }]} />
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.toggleTitle}>Sufficient Contrast</ThemedText>
              <ThemedText variant="muted" style={styles.toggleSub}>
                Increase contrast between text/icons and backgrounds.
              </ThemedText>
            </View>
            <Switch
              value={prefs.sufficientContrast}
              onValueChange={(v) => void patch({ sufficientContrast: v }, 'Sufficient Contrast')}
              trackColor={{ true: colors.goldTint30 }}
            />
          </View>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

function createAccessibilityScreenStyles(c: AccessibleColors) {
  return {
    card: {
      backgroundColor: DS.apple.fillSecondary,
      borderColor: c.emphasisBorder ?? DS.apple.separator,
    },
    kicker: {
      color: c.textMuted,
    },
    textScaleChip: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: DS.radius.lg,
      borderWidth: 1,
      borderColor: c.emphasisBorder ?? c.borderWhite5,
      alignItems: 'center' as const,
    },
    textScaleChipActive: {
      backgroundColor: c.gold,
      borderColor: c.gold,
    },
    textScaleChipTxt: {
      fontFamily: DS.font.bodyBold,
      fontSize: 15,
      color: c.textMuted,
    },
    textScaleChipTxtActive: {
      color: c.background,
    },
  };
}

export function SupportScreen({ navigation }: PProps<'Support'>) {
  const insets = useSafeAreaInsets();
  const webBase = getDaltonWebUrl();
  const open = useCallback(
    async (path: string) => {
      if (!webBase) {
        Alert.alert(
          'Not configured',
          'Set EXPO_PUBLIC_DALTON_WEB_URL in expo-app/.env (and in EAS env vars) to enable support links.',
        );
        return;
      }
      const url = `${webBase}${path.startsWith('/') ? path : `/${path}`}`;
      const ok = await Linking.canOpenURL(url);
      if (!ok) {
        Alert.alert('Open link', 'Unable to open the website on this device.');
        return;
      }
      await Linking.openURL(url);
    },
    [webBase],
  );
  return (
    <View style={styles.root}>
      <ScreenHeader title="Support" onBack={() => navigation.goBack()} largeTitle />
      <ScrollView
        contentContainerStyle={[styles.padded, { paddingBottom: 32 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={styles.supportCard}
          onPress={() => navigation.navigate('HelpCentre')}
        >
          <FontAwesome5 name="book-open" size={18} color={DS.color.gold} solid />
          <View style={{ flex: 1, marginLeft: DS.space.md }}>
            <Text style={styles.supportTitle}>Help centre</Text>
            <Text style={styles.supportSub}>Search guides, FAQs, and suggested topics.</Text>
          </View>
          <FontAwesome name="chevron-right" size={12} color={DS.color.textMuted} />
        </Pressable>
        <Pressable style={styles.supportCard} onPress={() => void open('/help-center')}>
          <FontAwesome name="globe" size={18} color={DS.color.gold} />
          <View style={{ flex: 1, marginLeft: DS.space.md }}>
            <Text style={styles.supportTitle}>Help on web</Text>
            <Text style={styles.supportSub}>
              Full help centre in your browser — the AI assistant loads in the corner on the site.
            </Text>
          </View>
          <FontAwesome name="chevron-right" size={12} color={DS.color.textMuted} />
        </Pressable>
        <Pressable style={styles.supportCard} onPress={() => void open('/contact-team')}>
          <FontAwesome name="envelope-o" size={18} color={DS.color.gold} />
          <View style={{ flex: 1, marginLeft: DS.space.md }}>
            <Text style={styles.supportTitle}>Email support</Text>
            <Text style={styles.supportSub}>
              Detailed issues, billing, privacy, and safety — secure form on the website. {BRAND_CONTACT_RESPONSE_WINDOW}
            </Text>
          </View>
          <FontAwesome name="chevron-right" size={12} color={DS.color.textMuted} />
        </Pressable>
        <Pressable style={styles.supportCard} onPress={() => void open('/contact-assistant')}>
          <FontAwesome name="comments-o" size={18} color={DS.color.gold} />
          <View style={{ flex: 1, marginLeft: DS.space.md }}>
            <Text style={styles.supportTitle}>AI assistant</Text>
            <Text style={styles.supportSub}>
              Simple how-to questions and learning about the academy — typical reply under a minute.
            </Text>
          </View>
          <FontAwesome name="chevron-right" size={12} color={DS.color.textMuted} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

export function LegalScreen({ navigation }: PProps<'Legal'>) {
  const insets = useSafeAreaInsets();
  const webBase = getDaltonWebUrl();
  const open = useCallback(
    async (path: string) => {
      if (!webBase) {
        Alert.alert(
          'Not configured',
          'Set EXPO_PUBLIC_DALTON_WEB_URL in expo-app/.env (and in EAS env vars) to enable legal links.',
        );
        return;
      }
      const url = `${webBase}${path.startsWith('/') ? path : `/${path}`}`;
      const ok = await Linking.canOpenURL(url);
      if (!ok) {
        Alert.alert('Open link', 'Unable to open the website on this device.');
        return;
      }
      await Linking.openURL(url);
    },
    [webBase],
  );
  const rows = [
    { title: 'Terms of service', sub: 'Platform rules and eligibility', path: '/terms' },
    { title: 'Privacy policy', sub: 'How we handle your data', path: '/privacy' },
    { title: 'Cookie policy', sub: 'Tracking and preferences', path: '/cookie-policy' },
    { title: 'Athlete agreement', sub: 'Dalton Grant Academy program terms', path: '/athlete-agreement' },
  ];
  return (
    <View style={styles.root}>
      <ScreenHeader title="Legal" onBack={() => navigation.goBack()} largeTitle />
      <ScrollView
        contentContainerStyle={[styles.padded, { paddingBottom: 32 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {rows.map((r) => (
          <Pressable key={r.title} style={styles.legalRow} onPress={() => void open(r.path)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.legalTitle}>{r.title}</Text>
              <Text style={styles.legalSub}>{r.sub}</Text>
            </View>
            <FontAwesome name="external-link" size={14} color={DS.color.textMuted} />
          </Pressable>
        ))}
        <Text style={styles.legalFoot}>Document links open in your browser where configured.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.color.background },
  padded: { padding: DS.space.lg },
  cardKicker: {
    fontFamily: DS.font.bodyBold,
    fontSize: 11,
    color: DS.color.textMuted,
    letterSpacing: 2,
    marginBottom: DS.space.sm,
  },
  cardKickerSpaced: {
    fontFamily: DS.font.bodyBold,
    fontSize: 11,
    color: DS.color.textMuted,
    letterSpacing: 2,
    marginTop: DS.space.xl,
    marginBottom: DS.space.sm,
  },
  card: {
    backgroundColor: DS.color.surfaceAlt,
    borderRadius: DS.radius.xl,
    borderWidth: 1,
    borderColor: DS.color.borderHairline,
    padding: DS.space.base,
  },
  labelSm: {
    fontSize: 12,
    color: DS.color.textMuted,
    marginBottom: 6,
  },
  labelSmSpaced: {
    fontSize: 12,
    color: DS.color.textMuted,
    marginTop: DS.space.md,
    marginBottom: 6,
  },
  input: {
    backgroundColor: DS.color.input,
    borderRadius: DS.radius.lg,
    padding: DS.space.md,
    color: DS.color.textMuted,
    fontSize: 15,
  },
  rowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: DS.space.md,
  },
  rowBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: DS.color.text,
  },
  notifyActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
    paddingVertical: DS.space.md,
  },
  notifyActionTxt: {
    flex: 1,
    fontFamily: DS.font.bodyMedium,
    fontSize: 15,
    color: DS.color.gold,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
    paddingVertical: DS.space.sm,
  },
  toggleRowCol: {
    paddingVertical: DS.space.sm,
  },
  textScaleRow: {
    flexDirection: 'row',
    gap: DS.space.sm,
    marginTop: DS.space.md,
  },
  textScaleChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    borderColor: DS.color.borderWhite5,
    alignItems: 'center',
  },
  textScaleChipActive: {
    backgroundColor: DS.color.gold,
    borderColor: DS.color.gold,
  },
  textScaleChipTxt: {
    fontFamily: DS.font.bodyBold,
    fontSize: 15,
    color: DS.color.textMuted,
  },
  textScaleChipTxtActive: {
    color: DS.color.background,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: DS.color.text,
  },
  toggleSub: {
    fontSize: 12,
    color: DS.color.textMuted,
    marginTop: 4,
    lineHeight: 16,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: DS.color.borderHairline,
    marginVertical: DS.space.sm,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
    paddingVertical: DS.space.sm,
  },
  sessionText: {
    fontSize: 14,
    color: DS.color.text,
  },
  dangerOutline: {
    marginTop: DS.space.xl,
    paddingVertical: DS.space.md,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(232, 83, 58, 0.5)',
    alignItems: 'center',
  },
  dangerOutlineText: {
    color: DS.color.error,
    fontWeight: '600',
    fontSize: 14,
  },
  statusPillMuted: {
    paddingHorizontal: DS.space.sm,
    paddingVertical: 4,
    borderRadius: DS.radius.pill,
    backgroundColor: DS.color.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.borderHairline,
  },
  statusPillMutedText: {
    fontSize: 11,
    color: DS.color.textMuted,
    fontWeight: '600',
    letterSpacing: 1,
  },
  primaryBtn: {
    marginTop: DS.space.xl,
    paddingVertical: DS.space.md,
    borderRadius: DS.radius.lg,
    backgroundColor: DS.color.gold,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: DS.color.background,
    fontWeight: '700',
    fontSize: 15,
  },
  ghostBtn: {
    marginTop: DS.space.md,
    paddingVertical: DS.space.md,
    alignItems: 'center',
  },
  ghostBtnText: {
    color: DS.color.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  bodyMuted: {
    fontSize: 14,
    color: DS.color.textMuted,
    lineHeight: 22,
    marginBottom: DS.space.lg,
  },
  bodyMutedSm: {
    fontSize: 12,
    color: DS.color.textMuted,
    lineHeight: 18,
    marginBottom: DS.space.md,
  },
  dmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: DS.space.md,
    paddingHorizontal: DS.space.sm,
    borderRadius: DS.radius.md,
  },
  dmRowOn: {
    backgroundColor: DS.color.goldTint10,
  },
  dmRowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: DS.color.text,
  },
  dmRowSub: {
    fontSize: 12,
    color: DS.color.textMuted,
    marginTop: 2,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: DS.color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterOn: {
    borderColor: DS.color.gold,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: DS.color.gold,
  },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DS.color.surfaceAlt,
    borderRadius: DS.radius.xl,
    borderWidth: 1,
    borderColor: DS.color.borderHairline,
    padding: DS.space.base,
    marginBottom: DS.space.md,
    gap: DS.space.sm,
  },
  supportTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: DS.color.text,
  },
  supportSub: {
    fontSize: 12,
    color: DS.color.textMuted,
    marginTop: 4,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: DS.space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.color.borderHairline,
    gap: DS.space.md,
  },
  legalTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: DS.color.text,
  },
  legalSub: {
    fontSize: 12,
    color: DS.color.textMuted,
    marginTop: 4,
  },
  legalFoot: {
    marginTop: DS.space.xl,
    fontSize: 12,
    color: DS.color.textMuted,
    textAlign: 'center',
  },
});
