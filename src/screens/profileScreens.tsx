import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { deleteOwnAccount } from '../auth/accountDeletionService';
import { AppleHeroButton } from '../components/AppleHeroButton';
import { HighlightVideoModal } from '../components/HighlightVideoModal';
import { InterestsEditor } from '../components/InterestsEditor';
import { uploadHighlightVideo } from '../lib/highlightVideoUpload';
import { useActionBanner } from '../actionBanner/ActionBannerContext';
import { BrandLogo } from '../components/BrandLogo';
import { UploadBlockingOverlay } from '../components/UploadBlockingOverlay';
import { useKeyboardInset } from '../hooks/useKeyboardInset';
import { ScreenHeader } from '../components/ScreenHeader';
import { DS } from '../designSystem';
import { isSupabaseConfigured } from '../lib/env';
import { formatAuthorDisplayName } from '../lib/communityPostBody';
import { getSignInMethods } from '../lib/authSignInMethods';
import { getSupabase } from '../lib/supabase';
import type { ProfileStackParamList } from '../navigation/types';
import { useSubscription } from '../subscriptions/SubscriptionContext';
import * as ImagePicker from 'expo-image-picker';
import { DALTON_LOGO_FINAL_IMG } from '../constants/brandAssets';
import { capitalizeProfileTag } from '../lib/capitalizeProfileTags';
import { STRIPE_CUSTOMER_PORTAL_LOGIN_URL } from '../constants/stripePortal';
import type { ProfileRow } from '../roadmap/types';
import {
  fetchProfileByUserId,
  updateProfileAthleteDetails,
  updateProfileBasics,
  type AthleteDetails,
} from '../roadmap/profileService';
import { getFollowCounts } from '../roadmap/followService';
import { uploadAndSaveProfileImage } from '../lib/profileImageUpload';
import {
  highlightTitleFromFileName,
  highlightsToJson,
  isUploadedHighlightMedia,
  parseProfileHighlights,
  resolveHighlightThumbnailUrl,
  type ProfileHighlight,
} from '../lib/profileHighlights';
import { pickLocalImage, pickLocalVideo } from '../lib/pickLocalMedia';
import {
  checkUsernameAvailable,
  isValidUsernameFormat,
  normalizeUsernameTyping,
} from '../profile/usernameProfile';
import { useUsernameAvailability } from '../profile/useUsernameAvailability';
import { isMasterGateUnlocked } from '../master/masterGateStorage';
import {
  interestsForProfileDisplay,
  PROFILE_EMPTY_BIO,
  PROFILE_EMPTY_INTERESTS,
} from '../lib/profileDisplay';

type PProps<K extends keyof ProfileStackParamList> = NativeStackScreenProps<ProfileStackParamList, K>;
type SectionDetailRoute = RouteProp<ProfileStackParamList, 'EditProfileSectionDetail'>;

function isLiveUser(user: { id: string } | null | undefined): boolean {
  return Boolean(isSupabaseConfigured() && user?.id && !user.id.startsWith('demo-'));
}

function computeProfileCompletion(p: ProfileRow | null): { pct: number; hint: string } {
  if (!p) return { pct: 0, hint: 'Add your name and username to complete your profile.' };
  const checks: { key: string; ok: boolean; label: string }[] = [
    { key: 'name', ok: Boolean(p.first_name?.trim() && p.last_name?.trim()), label: 'name' },
    { key: 'username', ok: Boolean(p.username?.trim()), label: 'username' },
    { key: 'role', ok: Boolean(p.persona_role?.trim()), label: 'role' },
    { key: 'sports', ok: Array.isArray(p.sports) && p.sports.length > 0, label: 'sports' },
    { key: 'photo', ok: Boolean(p.avatar_url?.trim()), label: 'profile photo' },
    { key: 'bio', ok: Boolean((p.bio ?? '').toString().trim()), label: 'bio' },
    { key: 'interests', ok: Array.isArray(p.interests) && p.interests.length > 0, label: 'interests' },
  ];
  const done = checks.filter((c) => c.ok).length;
  const pct = Math.round((done / checks.length) * 100);
  const missing = checks.filter((c) => !c.ok).map((c) => c.label);
  const hint =
    missing.length === 0 ? 'Your profile is complete.' : `Add ${missing.slice(0, 2).join(' and ')} to improve visibility.`;
  return { pct, hint };
}

export function AthleteProfileScreen({ navigation }: PProps<'AthleteProfile'>) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isPro } = useSubscription();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [bannerZoomOpen, setBannerZoomOpen] = useState(false);
  const [highlightPlayer, setHighlightPlayer] = useState<{ title: string; url: string } | null>(
    null,
  );
  const live = isLiveUser(user);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        if (!live || !user?.id) {
          if (alive) {
            setProfile(null);
            setFollowCounts({ followers: 0, following: 0 });
          }
          return;
        }
        const [row, counts] = await Promise.all([
          fetchProfileByUserId(user.id),
          getFollowCounts(user.id),
        ]);
        if (!alive) return;
        setProfile(row);
        setFollowCounts(counts);
      })();
      return () => {
        alive = false;
      };
    }, [live, user?.id]),
  );

  const displayName = useMemo(() => {
    if (!profile) return user?.email?.split('@')[0] ?? 'Member';
    const label = formatAuthorDisplayName(profile);
    if (label !== 'Member') return label;
    return user?.email?.split('@')[0] ?? 'Member';
  }, [profile, user?.email]);

  const interestLabels = useMemo(
    () => interestsForProfileDisplay(profile?.interests, profile?.primary_sport, profile?.sports),
    [profile?.interests, profile?.primary_sport, profile?.sports],
  );

  const hasCustomAvatar = Boolean(profile?.avatar_url?.trim());
  const avatarSource = hasCustomAvatar
    ? ({ uri: profile!.avatar_url!.trim() } as const)
    : DALTON_LOGO_FINAL_IMG;

  const showPremiumVerified = false;
  const primarySport = profile?.primary_sport?.trim() || (profile?.sports ?? [])[0] || '';

  const bannerSource =
    profile?.banner_url?.trim()
      ? ({ uri: profile.banner_url.trim() } as const)
      : null;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.profileScroll, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.profileBannerBleed,
            { marginTop: -insets.top, height: 228 + Math.max(insets.top, 0) },
          ]}
          pointerEvents="box-none"
        >
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => {
              if (bannerSource) setBannerZoomOpen(true);
            }}
          >
            {bannerSource ? (
              <Image source={bannerSource} style={styles.bannerImgBleed} resizeMode="cover" />
            ) : (
              <View style={styles.bannerEmpty} />
            )}
          </Pressable>
          <View style={styles.bannerScrim} pointerEvents="none" />
          <Pressable
            style={[styles.bannerSettingsFAB, { top: insets.top + 36 }]}
            hitSlop={8}
            onPress={() => navigation.navigate('Settings')}
          >
            <FontAwesome name="cog" size={26} color="#FFFFFF" />
          </Pressable>
          <Pressable
            style={styles.bannerEditPill}
            onPress={() => navigation.navigate('EditProfileSectionDetail', { slug: 'banner' })}
            hitSlop={8}
          >
            <FontAwesome name="camera" size={14} color={DS.color.background} />
            <Text style={styles.bannerEditTxt}> Edit banner</Text>
          </Pressable>
        </View>
        <View style={[styles.avatarWrap, !hasCustomAvatar && styles.avatarWrapPlaceholder]}>
          <View style={!hasCustomAvatar ? styles.avatarRing : styles.avatarInnerPlain}>
            <Image source={avatarSource} style={styles.avatar} />
          </View>
          {showPremiumVerified ? (
            <View style={styles.badgeOverlay}>
              <FontAwesome name="star" size={14} color={DS.color.background} />
            </View>
          ) : null}
        </View>
        <View style={styles.nameRow}>
          <Text style={styles.profileName}>{displayName}</Text>
          {showPremiumVerified ? (
            <View style={styles.premiumMark}>
              <FontAwesome name="certificate" size={16} color={DS.color.gold} />
            </View>
          ) : null}
        </View>
        {profile?.username?.trim() ? <Text style={styles.profileHandle}>@{profile.username.trim()}</Text> : null}
        {primarySport ? (
          <View style={styles.tagRowPrimary}>
            <View style={styles.tagGold}>
              <Text style={styles.tagGoldText}>{primarySport}</Text>
            </View>
          </View>
        ) : null}
        <View style={styles.tagRow}>
          {(profile?.sports ?? [])
            .filter((s) => s !== primarySport)
            .slice(0, 4)
            .map((s) => (
              <View key={s} style={styles.tag}>
                <Text style={styles.tagText}>{s}</Text>
              </View>
            ))}
          {profile?.persona_role?.trim() ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{capitalizeProfileTag(profile.persona_role)}</Text>
            </View>
          ) : null}
        </View>

        {live && user?.id ? (
          <View style={styles.followStatsRow}>
            <Pressable
              onPress={() => navigation.navigate('FollowUserList', { userId: user.id, mode: 'followers' })}
              hitSlop={8}
            >
              <Text style={styles.followStatsTxt}>
                <Text style={styles.followStatsNum}>{followCounts.followers}</Text>
                {' Followers'}
              </Text>
            </Pressable>
            <Text style={styles.followStatsSep}> · </Text>
            <Pressable
              onPress={() => navigation.navigate('FollowUserList', { userId: user.id, mode: 'following' })}
              hitSlop={8}
            >
              <Text style={styles.followStatsTxt}>
                <Text style={styles.followStatsNum}>{followCounts.following}</Text>
                {' Following'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={[styles.sectionTitleKicker, styles.sectionBlockFirst]}>About</Text>
        <Pressable style={styles.sectionCard} onPress={() => navigation.navigate('EditProfileSections')}>
          <Text style={styles.sectionBody}>
            {profile?.bio?.trim() ? profile.bio.trim() : PROFILE_EMPTY_BIO}
          </Text>
          {!profile?.bio?.trim() ? <Text style={styles.sectionCta}>Add bio →</Text> : null}
        </Pressable>

        <Text style={[styles.sectionTitleKicker, styles.sectionBlock]}>Interests</Text>
        <Pressable style={styles.sectionCard} onPress={() => navigation.navigate('EditProfileSections')}>
          <Text style={styles.sectionBody}>
            {interestLabels.length ? interestLabels.join(' · ') : PROFILE_EMPTY_INTERESTS}
          </Text>
          {!interestLabels.length ? <Text style={styles.sectionCta}>Add interests →</Text> : null}
        </Pressable>

        <Text style={[styles.sectionTitleKicker, styles.sectionBlock]}>Highlights</Text>
        {parseProfileHighlights(profile?.highlights).length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.highlightsScroll}>
            {parseProfileHighlights(profile?.highlights).map((h, i) => {
              const thumb = resolveHighlightThumbnailUrl(h.video_url, h.thumbnail_url);
              return (
              <Pressable
                key={`${h.title}-${i}`}
                style={styles.highlightCard}
                onPress={() => {
                  if (!h.video_url.trim()) {
                    navigation.navigate('EditProfileSectionDetail', { slug: 'highlights' });
                    return;
                  }
                  setHighlightPlayer({ title: h.title, url: h.video_url.trim() });
                }}
              >
                {thumb ? (
                  <Image source={{ uri: thumb }} style={styles.highlightThumb} resizeMode="cover" />
                ) : (
                  <View style={styles.highlightThumbPlaceholder}>
                    {isUploadedHighlightMedia(h.video_url) ? (
                      <FontAwesome name="film" size={22} color={DS.color.gold} style={{ marginBottom: 6 }} />
                    ) : null}
                    <Text style={styles.highlightThumbTitle} numberOfLines={3}>
                      {h.title}
                    </Text>
                  </View>
                )}
                {h.video_url.trim() ? (
                  <View style={styles.highlightPlay}>
                    <FontAwesome name="play" size={14} color={DS.color.background} />
                  </View>
                ) : null}
              </Pressable>
            );
            })}
          </ScrollView>
        ) : (
          <Pressable
            style={styles.sectionCard}
            onPress={() => navigation.navigate('EditProfileSectionDetail', { slug: 'highlights' })}
          >
            <Text style={styles.sectionBody}>Nothing added yet.</Text>
            <Text style={styles.sectionCta}>Add highlights →</Text>
          </Pressable>
        )}

        <Text style={[styles.sectionTitleKicker, styles.sectionBlock]}>Recent results</Text>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionBody}>Nothing added yet.</Text>
          <Text style={styles.sectionMuted}>Optional but recommended.</Text>
        </View>
      </ScrollView>

      <Modal visible={bannerZoomOpen} transparent animationType="fade" onRequestClose={() => setBannerZoomOpen(false)}>
        <Pressable style={styles.bannerZoomBackdrop} onPress={() => setBannerZoomOpen(false)}>
          {bannerSource ? (
            <Image source={bannerSource} style={styles.bannerZoomImg} resizeMode="contain" />
          ) : null}
        </Pressable>
      </Modal>
      <HighlightVideoModal
        visible={highlightPlayer != null}
        title={highlightPlayer?.title ?? 'Highlight'}
        videoUrl={highlightPlayer?.url ?? ''}
        onClose={() => setHighlightPlayer(null)}
      />
    </View>
  );
}

export function SettingsScreen({ navigation }: PProps<'Settings'>) {
  const { logout, user } = useAuth();
  const { isPro } = useSubscription();
  const [signInMethodLabel, setSignInMethodLabel] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        if (!user?.id || user.id.startsWith('demo-')) {
          if (alive) setSignInMethodLabel(null);
          return;
        }
        const methods = await getSignInMethods();
        if (!alive) return;
        if (!methods) {
          setSignInMethodLabel(null);
          return;
        }
        if (methods.hasEmailPassword) setSignInMethodLabel('Email and password');
        else if (methods.hasGoogle && methods.hasApple) setSignInMethodLabel('Google or Apple');
        else if (methods.hasGoogle) setSignInMethodLabel('Google');
        else if (methods.hasApple) setSignInMethodLabel('Apple');
        else setSignInMethodLabel(null);
      })();
      return () => {
        alive = false;
      };
    }, [user?.id]),
  );

  const premiumRow = {
    title: 'Premium',
    sub: 'Subscriptions, restore purchases, entitlements',
    icon: 'star' as const,
    onPress: () => navigation.navigate('Paywall'),
  };
  const openMasterGated = useCallback(
    async (returnTo: 'MasterControlHub') => {
      if (!user?.id) return;
      const unlocked = await isMasterGateUnlocked(user.id);
      if (unlocked) {
        navigation.navigate(returnTo);
      } else {
        navigation.navigate('MasterGate', { returnTo });
      }
    },
    [navigation, user?.id],
  );

  const masterRows =
    user?.masterControl === true
      ? [
          {
            title: 'Master control',
            sub: 'Partner pages, accounts & deletion',
            icon: 'shield' as const,
            onPress: () => void openMasterGated('MasterControlHub'),
          },
        ]
      : [];
  const adminRow =
    user && user.role !== 'member'
      ? [
          {
            title: 'Admin tools',
            sub: 'Moderation, events, check-in, analytics',
            icon: 'shield' as const,
            onPress: () => navigation.navigate('AdminTools'),
          },
        ]
      : [];
  const rows = [
    ...(!isPro ? [premiumRow] : []),
    ...(isPro && Platform.OS === 'web'
      ? [
          {
            title: 'Stripe billing',
            sub: 'Manage subscription on web (Stripe customer portal)',
            icon: 'credit-card' as const,
            onPress: () =>
              void Linking.openURL(STRIPE_CUSTOMER_PORTAL_LOGIN_URL).catch(() =>
                Alert.alert('Billing', 'Could not open Stripe. Try Support if this keeps happening.'),
              ),
          },
        ]
      : []),
    ...masterRows,
    ...adminRow,
    {
      title: 'Accessibility',
      sub: 'Voice, text size, contrast, motion, captions',
      icon: 'universal-access' as const,
      onPress: () => navigation.navigate('Accessibility'),
    },
    {
      title: 'Account & Security',
      sub: 'Password, 2FA, login methods',
      icon: 'lock' as const,
      onPress: () => navigation.navigate('AccountSecurity'),
    },
    {
      title: 'Edit Profile Sections',
      sub: 'Name, bio, links, visibility',
      icon: 'list-ul' as const,
      onPress: () => navigation.navigate('EditProfileSections'),
    },
    {
      title: 'Privacy & Visibility',
      sub: 'Who can see your profile',
      icon: 'eye' as const,
      onPress: () => navigation.navigate('PrivacyVisibility'),
    },
    {
      title: 'Notifications',
      sub: 'Push and email preferences',
      icon: 'bell' as const,
      onPress: () => navigation.navigate('NotificationPrefs'),
    },
    ...(isSupabaseConfigured() && user && !user.id.startsWith('demo-')
      ? [
          {
            title: 'Follow requests',
            sub: 'Accept or decline incoming follows',
            icon: 'user-plus' as const,
            onPress: () => navigation.navigate('FollowRequests'),
          },
        ]
      : []),
    {
      title: 'Help centre',
      sub: 'Guides & troubleshooting (works offline)',
      icon: 'book' as const,
      onPress: () => navigation.navigate('HelpCentre'),
    },
    {
      title: 'My proposals',
      sub: 'Media & sponsor submission status',
      icon: 'file-text-o' as const,
      onPress: () => navigation.navigate('MyProposals'),
    },
    {
      title: 'Support',
      sub: 'Contact the Dalton team',
      icon: 'life-ring' as const,
      onPress: () => navigation.navigate('Support'),
    },
    {
      title: 'Legal',
      sub: 'Terms and privacy policy',
      icon: 'file-text-o' as const,
      onPress: () => navigation.navigate('Legal'),
    },
  ];
  return (
    <View style={styles.root}>
      <ScreenHeader title="Settings" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.padded, { paddingTop: DS.space.sm }]}>
        {user ? (
          <View style={styles.accountStatusCard}>
            <Text style={styles.accountStatusLabel}>Account</Text>
            <Text style={styles.accountStatusEmail}>{user.email || 'Signed in'}</Text>
            {signInMethodLabel ? (
              <Text style={styles.accountStatusMethod}>Created with {signInMethodLabel}</Text>
            ) : null}
          </View>
        ) : null}
        {rows.map((r) => (
          <Pressable key={r.title} style={styles.settingsCard} onPress={r.onPress}>
            <View style={styles.settingsIcon}>
              <FontAwesome name={r.icon} size={16} color={DS.color.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingsTitle}>{r.title}</Text>
              <Text style={styles.settingsSub}>{r.sub}</Text>
            </View>
            <FontAwesome name="chevron-right" size={14} color={DS.color.textMuted} />
          </Pressable>
        ))}
        <Pressable style={styles.logOutBtn} onPress={() => void logout()}>
          <FontAwesome name="sign-out" size={16} color={DS.color.background} />
          <Text style={styles.logOutBtnText}> Log Out</Text>
        </Pressable>
        <Pressable
          style={styles.deleteAccountWrap}
          onPress={() => {
            if (!isSupabaseConfigured() || !user || user.id.startsWith('demo-')) {
              Alert.alert(
                'Delete account',
                'Sign in with a live account to delete it here, or contact Support.',
              );
              return;
            }
            const confirmDelete = async (phrase: string) => {
              const client = getSupabase();
              if (!client) return;
              const { data } = await client.auth.getSession();
              const token = data.session?.access_token;
              if (!token) {
                Alert.alert('Delete account', 'Session expired. Sign in again and retry.');
                return;
              }
              const result = await deleteOwnAccount(token, phrase);
              if (result.ok) {
                await logout();
                Alert.alert('Account deleted', 'Your account has been removed.');
              } else {
                Alert.alert('Could not delete account', result.message);
              }
            };
            Alert.alert(
              'Delete account',
              'This permanently deletes your Dalton Grant Academy account and data stored with us — including profile, bookings, posts, messages, and media uploads tied to this account.\n\n' +
                'Before you delete: if you subscribed to Premium on iPhone, cancel from Apple subscriptions; if you pay on web via Stripe, cancel via the Stripe billing portal and wait for confirmations to settle. Charges are handled by Apple or Stripe — DGA cannot remove them for you after deletion.\n\n' +
                'This action cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Continue',
                  style: 'destructive',
                  onPress: () => {
                    if (Platform.OS === 'ios') {
                      Alert.prompt(
                        'Type DELETE to confirm',
                        'This cannot be undone.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: (text?: string) => void confirmDelete(text ?? ''),
                          },
                        ],
                        'plain-text',
                        '',
                      );
                    } else {
                      Alert.alert(
                        'Final confirmation',
                        'Delete your account permanently?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete forever',
                            style: 'destructive',
                            onPress: () => void confirmDelete('DELETE'),
                          },
                        ],
                      );
                    }
                  },
                },
              ],
            );
          }}
        >
          <Text style={styles.deleteAccountTxt}>Delete Account</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const SPORT_OPTIONS = [
  'Basketball',
  'Football',
  'Soccer',
  'Baseball',
  'Tennis',
  'Golf',
  'Track & Field',
  'Swimming',
  'Volleyball',
  'Hockey',
  'Other',
] as const;

const BIO_MAX = 200;

function sportDedupeKeys(primarySport?: string | null, sports?: string[] | null): Set<string> {
  const out = new Set<string>();
  const p = primarySport?.trim();
  if (p) out.add(p.toLowerCase());
  for (const s of sports ?? []) {
    const t = s?.trim();
    if (t) out.add(t.toLowerCase());
  }
  return out;
}

export function EditBasicScreen({ navigation }: PProps<'EditBasic'>) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const supabase = getSupabase();
  const live = isLiveUser(user);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [sport, setSport] = useState<string>('');
  const [sportOpen, setSportOpen] = useState(false);
  const [toast, setToast] = useState(false);
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string; username?: string }>({});

  const availability = useUsernameAvailability(supabase, user?.id, username, false);

  const clearFieldError = (key: 'firstName' | 'lastName' | 'username') => {
    setErrors((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        if (!live || !user?.id) return;
        const p = await fetchProfileByUserId(user.id);
        if (!alive || !p) return;
        setFirstName(p.first_name?.trim() || '');
        setLastName(p.last_name?.trim() || '');
        setUsername(p.username?.trim() || '');
        setSport((p.sports ?? [])[0] || '');
      })();
      return () => {
        alive = false;
      };
    }, [live, user?.id]),
  );

  const onSave = async () => {
    const next: typeof errors = {};
    if (!firstName.trim()) next.firstName = 'First name is required';
    if (!lastName.trim()) next.lastName = 'Surname is required';
    const displayName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
    const normalizedUsername = normalizeUsernameTyping(username);
    if (!normalizedUsername) next.username = 'Username is required';
    else if (!isValidUsernameFormat(normalizedUsername)) next.username = 'Use letters, numbers, and underscores only';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    if (!supabase || !user?.id || !live) {
      Alert.alert('Sign in required', 'Connect with your live account to save profile changes.');
      return;
    }
    const ok = await checkUsernameAvailable(supabase, normalizedUsername, user.id);
    if (!ok) {
      setErrors({ username: 'That username is already taken' });
      return;
    }
    const saved = await updateProfileBasics(user.id, {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      display_name: displayName,
      username: normalizedUsername,
      sports: sport?.trim() ? [sport.trim()] : [],
    });
    if (!saved.ok) {
      if (saved.error.includes('duplicate') || saved.error.includes('unique')) {
        setErrors({ username: 'That username was just claimed' });
      } else {
        Alert.alert('Save failed', saved.error);
      }
      return;
    }
    const { error: authErr } = await supabase.auth.updateUser({
      data: {
        display_name: displayName,
        full_name: displayName,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      },
    });
    if (authErr) {
      Alert.alert('Profile saved', `Your profile was updated, but auth metadata sync failed: ${authErr.message}`);
    }
    setToast(true);
    navigation.goBack();
  };

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(false), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Edit Basic Info" onBack={() => navigation.goBack()} largeTitle />
      {toast ? (
        <View style={[styles.editToast, { top: insets.top + 72 }]} pointerEvents="none">
          <FontAwesome name="check-circle" size={18} color={DS.color.white} />
          <Text style={styles.editToastText}> Profile updated successfully!</Text>
        </View>
      ) : null}
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={[styles.padded, { paddingBottom: 32 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.label, styles.editFirstLabel]}>
            First name <Text style={styles.reqStar}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, errors.firstName ? styles.inputError : null]}
            placeholder="First name"
            placeholderTextColor={DS.color.textMuted}
            value={firstName}
            autoCapitalize="words"
            onChangeText={(t) => {
              setFirstName(t);
              clearFieldError('firstName');
            }}
          />
          {errors.firstName ? <Text style={styles.fieldError}>{errors.firstName}</Text> : null}

          <Text style={[styles.label, styles.labelSpaced]}>
            Surname <Text style={styles.reqStar}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, errors.lastName ? styles.inputError : null]}
            placeholder="Surname"
            placeholderTextColor={DS.color.textMuted}
            value={lastName}
            autoCapitalize="words"
            onChangeText={(t) => {
              setLastName(t);
              clearFieldError('lastName');
            }}
          />
          {errors.lastName ? <Text style={styles.fieldError}>{errors.lastName}</Text> : null}

          <Text style={[styles.label, styles.labelSpaced]}>
            Username/Handle <Text style={styles.reqStar}>*</Text>
          </Text>
          <View style={styles.handleRow}>
            <Text style={styles.handleAt}>@</Text>
            <TextInput
              style={[styles.input, styles.inputHandle, errors.username ? styles.inputError : null]}
              placeholder="username"
              placeholderTextColor={DS.color.textMuted}
              value={username}
              autoCapitalize="none"
              onChangeText={(t) => {
                setUsername(normalizeUsernameTyping(t));
                clearFieldError('username');
              }}
            />
          </View>
          {errors.username ? <Text style={styles.fieldError}>{errors.username}</Text> : null}
          {!errors.username && username.trim() ? (
            <Text style={styles.fieldHelp}>
              {availability.checking
                ? 'Checking availability…'
                : availability.available === false
                  ? 'That username is taken.'
                  : availability.available === true
                    ? 'Available.'
                    : ''}
            </Text>
          ) : null}

          <Text style={[styles.label, styles.labelSpaced]}>
            Primary sport
          </Text>
          <Pressable style={styles.sportTrigger} onPress={() => setSportOpen(true)}>
            <Text style={styles.sportTriggerText}>{sport || 'Select'}</Text>
            <FontAwesome name="chevron-down" size={14} color={DS.color.textMuted} />
          </Pressable>

          <AppleHeroButton style={styles.saveBtnSpaced} onPress={() => void onSave()}>
            Save changes
          </AppleHeroButton>
          <Pressable style={styles.cancelBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={sportOpen} transparent animationType="fade" onRequestClose={() => setSportOpen(false)}>
        <View style={styles.sportModalRoot}>
          <Pressable style={styles.editModalBackdrop} onPress={() => setSportOpen(false)} />
          <View style={styles.sportModalSheet}>
            <Text style={styles.sportModalTitle}>Primary sport</Text>
            <ScrollView style={styles.sportModalList} keyboardShouldPersistTaps="handled">
              {SPORT_OPTIONS.map((opt) => (
                <Pressable
                  key={opt}
                  style={styles.sportModalRow}
                  onPress={() => {
                    setSport(opt);
                    setSportOpen(false);
                  }}
                >
                  <Text style={[styles.sportModalRowText, sport === opt && styles.sportModalRowTextOn]}>
                    {opt}
                  </Text>
                  {sport === opt ? <FontAwesome name="check" size={16} color={DS.color.gold} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const ATHLETE_LEVELS = [
  'Beginner',
  'Amateur',
  'Semi-Professional',
  'Professional',
  'Elite',
  'Olympic',
] as const;

const HEADLINE_BADGES = [
  { id: 'national-record', label: 'National Record', icon: 'trophy' as const },
  { id: 'olympic-qualifier', label: 'Olympic Qualifier', icon: 'certificate' as const },
  { id: 'world-champion', label: 'World Champion', icon: 'star' as const },
  { id: 'rising-star', label: 'Rising Star', icon: 'star-o' as const },
  { id: 'veteran', label: 'Veteran', icon: 'shield' as const },
  { id: 'team-captain', label: 'Team Captain', icon: 'users' as const },
];

export function EditProfilePhotoScreen({ navigation }: PProps<'EditProfilePhoto'>) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const supabase = getSupabase();
  const live = isLiveUser(user);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        if (!live || !user?.id) return;
        const p = await fetchProfileByUserId(user.id);
        if (!alive) return;
        const url = p?.avatar_url?.trim() || null;
        setAvatarUri(url);
        setLocalPreview(url);
      })();
      return () => {
        alive = false;
      };
    }, [live, user?.id]),
  );

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(false), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const pickPhoto = useCallback(async () => {
    if (!user?.id || !live) return;
    let uri: string | undefined;
    if (Platform.OS === 'web') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to choose a profile photo.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });
      if (res.canceled || !res.assets[0]?.uri) return;
      uri = res.assets[0].uri;
    } else {
      const picked = await pickLocalImage({ title: 'Profile photo' });
      if (!picked[0]?.uri) return;
      uri = picked[0].uri;
    }
    const previousPreview = localPreview ?? avatarUri;
    setLocalPreview(uri);
    setBusy(true);
    const uploaded = await uploadAndSaveProfileImage(user.id, uri, 'avatar');
    setBusy(false);
    if (!uploaded.ok) {
      setLocalPreview(previousPreview);
      Alert.alert('Upload failed', uploaded.error);
      return;
    }
    setAvatarUri(uploaded.publicUrl);
    setLocalPreview(uploaded.publicUrl);
    setToast(true);
  }, [avatarUri, live, localPreview, user?.id]);

  const removePhoto = useCallback(async () => {
    if (!supabase || !user?.id || !live) return;
    const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
    if (error) {
      Alert.alert('Remove failed', error.message);
      return;
    }
    setAvatarUri(null);
    setLocalPreview(null);
    setToast(true);
  }, [live, supabase, user?.id]);

  const displaySource =
    localPreview != null
      ? { uri: localPreview }
      : avatarUri
        ? { uri: avatarUri }
        : DALTON_LOGO_FINAL_IMG;

  return (
    <View style={styles.root}>
      <ScreenHeader title="Edit Profile Photo" onBack={() => navigation.goBack()} largeTitle />
      {toast ? (
        <View style={[styles.editToast, { top: insets.top + 72 }]} pointerEvents="none">
          <FontAwesome name="check-circle" size={18} color={DS.color.white} />
          <Text style={styles.editToastText}> Profile photo updated!</Text>
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={[styles.padded, { paddingBottom: 32 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.photoHero}>
          <View style={styles.photoGoldRing}>
            <View style={styles.photoInnerCircle}>
              <Image source={displaySource} style={styles.photoInnerImg} />
            </View>
          </View>
          <Pressable style={styles.photoCameraFab} onPress={() => void pickPhoto()}>
            <FontAwesome name="camera" size={16} color={DS.color.background} />
          </Pressable>
        </View>

        <Pressable style={styles.photoActionRow} onPress={() => void pickPhoto()}>
          <FontAwesome name="picture-o" size={18} color={DS.color.gold} />
          <Text style={styles.photoActionLabel}>Choose from gallery</Text>
        </Pressable>
        <Pressable style={styles.photoRemoveRow} onPress={() => void removePhoto()}>
          <FontAwesome name="trash" size={18} color={DS.color.error} />
          <Text style={styles.photoRemoveLabel}>Remove photo</Text>
        </Pressable>

        {busy ? (
          <Text style={styles.sectionDetailMuted}>Uploading your photo…</Text>
        ) : (
          <Text style={styles.sectionDetailMuted}>
            Photos save automatically when you choose from the gallery.
          </Text>
        )}
        <Pressable style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelBtnText}>Done</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

export function EditAthleteScreen({ navigation }: PProps<'EditAthlete'>) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const live = isSupabaseConfigured() && user && !user.id.startsWith('demo-');
  const [discipline, setDiscipline] = useState('');
  const [level, setLevel] = useState<(typeof ATHLETE_LEVELS)[number]>('Professional');
  const [team, setTeam] = useState('');
  const [coach, setCoach] = useState('');
  const [badges, setBadges] = useState<Record<string, boolean>>({});
  const [levelOpen, setLevelOpen] = useState(false);
  const [toast, setToast] = useState(false);
  const [discErr, setDiscErr] = useState('');
  const [saveErr, setSaveErr] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (!live || !user?.id) return;
      void (async () => {
        const p = await fetchProfileByUserId(user.id);
        const d = p?.athlete_details as AthleteDetails | null | undefined;
        if (d?.discipline) setDiscipline(d.discipline);
        if (d?.level && (ATHLETE_LEVELS as readonly string[]).includes(d.level)) {
          setLevel(d.level as (typeof ATHLETE_LEVELS)[number]);
        }
        if (d?.team) setTeam(d.team);
        if (d?.coach) setCoach(d.coach);
        if (d?.badges && typeof d.badges === 'object') setBadges(d.badges);
        else if (p?.primary_sport?.trim()) setDiscipline(p.primary_sport.trim());
      })();
    }, [live, user?.id]),
  );

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(false), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const toggleBadge = (id: string) =>
    setBadges((b) => ({ ...b, [id]: !b[id] }));

  const onSave = () => {
    if (!discipline.trim()) {
      setDiscErr('Discipline is required');
      return;
    }
    setDiscErr('');
    setSaveErr('');
    if (!live || !user?.id) {
      setToast(true);
      return;
    }
    void (async () => {
      const payload: AthleteDetails = {
        discipline: discipline.trim(),
        level,
        team: team.trim(),
        coach: coach.trim(),
        badges,
      };
      const res = await updateProfileAthleteDetails(user.id, payload);
      if (!res.ok) {
        setSaveErr(res.error);
        return;
      }
      setToast(true);
    })();
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Edit Athlete Details" onBack={() => navigation.goBack()} largeTitle />
      {toast ? (
        <View style={[styles.editToast, { top: insets.top + 72 }]} pointerEvents="none">
          <FontAwesome name="check-circle" size={18} color={DS.color.white} />
          <Text style={styles.editToastText}> Athlete details saved!</Text>
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={[styles.padded, { paddingBottom: 32 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.athleteLabel}>
          Discipline <Text style={styles.reqStar}>*</Text>
        </Text>
        <TextInput
          style={[styles.input, discErr ? styles.inputError : null]}
          placeholder="e.g., Sprinter, Marathon Runner, Swimmer"
          placeholderTextColor={DS.color.textMuted}
          value={discipline}
          onChangeText={(t) => {
            setDiscipline(t);
            if (t.trim()) setDiscErr('');
          }}
        />
        <Text style={styles.athleteHint}>Your primary athletic discipline</Text>
        {discErr ? <Text style={styles.fieldError}>{discErr}</Text> : null}
        {saveErr ? <Text style={styles.fieldError}>{saveErr}</Text> : null}

        <Text style={[styles.athleteLabel, styles.labelSpaced]}>
          Competition Level <Text style={styles.reqStar}>*</Text>
        </Text>
        <Pressable style={styles.sportTrigger} onPress={() => setLevelOpen(true)}>
          <Text style={styles.sportTriggerText}>{level}</Text>
          <FontAwesome name="chevron-down" size={14} color={DS.color.textMuted} />
        </Pressable>

        <Text style={[styles.athleteLabel, styles.labelSpaced]}>Team/Club</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your team or club name"
          placeholderTextColor={DS.color.textMuted}
          value={team}
          onChangeText={setTeam}
        />
        <Text style={styles.athleteHint}>Current team or athletic club affiliation</Text>

        <Text style={[styles.athleteLabel, styles.labelSpaced]}>Coach (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your coach's name"
          placeholderTextColor={DS.color.textMuted}
          value={coach}
          onChangeText={setCoach}
        />
        <Text style={styles.athleteHint}>Your primary coach or trainer</Text>

        <Text style={[styles.athleteLabel, styles.labelSpaced]}>Headline Badges</Text>
        <Text style={styles.athleteHintSpaced}>Select badges to highlight your achievements</Text>
        <View style={styles.badgeGrid}>
          {HEADLINE_BADGES.map((b) => (
            <Pressable
              key={b.id}
              style={[styles.badgeCell, badges[b.id] ? styles.badgeCellOn : null]}
              onPress={() => toggleBadge(b.id)}
            >
              <FontAwesome name={b.icon} size={14} color={DS.color.gold} />
              <Text style={styles.badgeCellText}>{b.label}</Text>
            </Pressable>
          ))}
        </View>

        <AppleHeroButton style={styles.saveBtnSpaced} onPress={onSave}>
          Save changes
        </AppleHeroButton>
        <Pressable style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={levelOpen} transparent animationType="fade" onRequestClose={() => setLevelOpen(false)}>
        <View style={styles.sportModalRoot}>
          <Pressable style={styles.editModalBackdrop} onPress={() => setLevelOpen(false)} />
          <View style={styles.sportModalSheet}>
            <Text style={styles.sportModalTitle}>Competition level</Text>
            <ScrollView style={styles.sportModalList} keyboardShouldPersistTaps="handled">
              {ATHLETE_LEVELS.map((opt) => (
                <Pressable
                  key={opt}
                  style={styles.sportModalRow}
                  onPress={() => {
                    setLevel(opt);
                    setLevelOpen(false);
                  }}
                >
                  <Text style={[styles.sportModalRowText, level === opt && styles.sportModalRowTextOn]}>
                    {opt}
                  </Text>
                  {level === opt ? <FontAwesome name="check" size={16} color={DS.color.gold} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

type SectionRow = {
  key: string;
  title: string;
  sub: string;
  icon: 'id-card-o' | 'camera' | 'trophy' | 'star' | 'list-ol' | 'link' | 'align-left';
  status: 'complete' | 'partial' | 'missing';
  onPress: () => void;
};

function StatusDot({ status }: { status: SectionRow['status'] }) {
  const color =
    status === 'complete' ? DS.color.onlineGreen : status === 'partial' ? '#EAB308' : DS.color.error;
  return <View style={[styles.sectionStatusDot, { backgroundColor: color }]} />;
}

export function EditProfileSectionsScreen({ navigation }: PProps<'EditProfileSections'>) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const live = isLiveUser(user);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        if (!live || !user?.id) {
          if (alive) setProfile(null);
          return;
        }
        const p = await fetchProfileByUserId(user.id);
        if (alive) setProfile(p);
      })();
      return () => {
        alive = false;
      };
    }, [live, user?.id]),
  );

  const completion = useMemo(() => computeProfileCompletion(profile), [profile]);

  const rows: SectionRow[] = [
    {
      key: 'basic',
      title: 'Basic Info',
      sub: 'First name, surname, username, sport',
      icon: 'id-card-o',
      status:
        profile?.first_name?.trim() && profile?.last_name?.trim() && profile?.username?.trim()
          ? 'complete'
          : 'partial',
      onPress: () => navigation.navigate('EditBasic'),
    },
    {
      key: 'photo',
      title: 'Profile Photo',
      sub: 'Upload or change your profile picture',
      icon: 'camera',
      status: profile?.avatar_url?.trim() ? 'complete' : 'missing',
      onPress: () => navigation.navigate('EditProfilePhoto'),
    },
    {
      key: 'banner',
      title: 'Banner image',
      sub: 'Optional — header image for your profile',
      icon: 'camera',
      status: profile?.banner_url?.trim() ? 'complete' : 'missing',
      onPress: () => navigation.navigate('EditProfileSectionDetail', { slug: 'banner' }),
    },
    {
      key: 'bio',
      title: 'Bio',
      sub: 'Tell the community about you',
      icon: 'align-left',
      status: profile?.bio?.trim() ? 'complete' : 'missing',
      onPress: () => navigation.navigate('EditProfileSectionDetail', { slug: 'bio' }),
    },
    {
      key: 'interests',
      title: 'Interests',
      sub: 'Add topics you care about',
      icon: 'star',
      status: profile?.interests?.length ? 'complete' : 'missing',
      onPress: () => navigation.navigate('EditProfileSectionDetail', { slug: 'interests' }),
    },
    {
      key: 'highlights',
      title: 'Highlights',
      sub: 'Optional but recommended',
      icon: 'star',
      status: parseProfileHighlights(profile?.highlights).length > 0 ? 'complete' : 'missing',
      onPress: () => navigation.navigate('EditProfileSectionDetail', { slug: 'highlights' }),
    },
    {
      key: 'results',
      title: 'Recent results',
      sub: 'Optional but recommended',
      icon: 'list-ol',
      status:
        Array.isArray(profile?.recent_results) && (profile?.recent_results as any[]).length > 0 ? 'complete' : 'missing',
      onPress: () => navigation.navigate('EditProfileSectionDetail', { slug: 'recentResults' }),
    },
  ];

  return (
    <View style={styles.root}>
      <ScreenHeader title="Edit Profile" onBack={() => navigation.goBack()} largeTitle />
      <ScrollView
        contentContainerStyle={[styles.padded, { paddingBottom: 32 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionList}>
          {rows.map((r) => (
            <Pressable key={r.key} style={styles.profileSectionCard} onPress={r.onPress}>
              <View style={styles.profileSectionIcon}>
                <FontAwesome name={r.icon} size={14} color={DS.color.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.profileSectionTitleRow}>
                  <Text style={styles.profileSectionTitle}>{r.title}</Text>
                  <StatusDot status={r.status} />
                </View>
                <Text style={styles.profileSectionSub}>{r.sub}</Text>
              </View>
              <FontAwesome name="chevron-right" size={12} color={DS.color.textMuted} />
            </Pressable>
          ))}
        </View>

        <View style={styles.completionCard}>
          <View style={styles.completionHead}>
            <View style={styles.completionIconWrap}>
              <FontAwesome name="pie-chart" size={12} color={DS.color.gold} />
            </View>
            <Text style={styles.completionTitle}>Profile Completion</Text>
          </View>
          <View style={styles.completionTrack}>
            <View style={[styles.completionFill, { width: `${completion.pct}%` }]} />
          </View>
          <Text style={styles.completionHint}>
            {completion.pct}% complete — {completion.hint}
          </Text>
        </View>

        <Text style={styles.legendTitle}>Status Indicators</Text>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <StatusDot status="complete" />
            <Text style={styles.legendText}>Complete</Text>
          </View>
          <View style={styles.legendItem}>
            <StatusDot status="partial" />
            <Text style={styles.legendText}>Partial</Text>
          </View>
          <View style={styles.legendItem}>
            <StatusDot status="missing" />
            <Text style={styles.legendText}>Missing</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function profileSectionLines(value: unknown): string {
  if (!Array.isArray(value)) return '';
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object' && 'title' in item) {
        return String((item as { title?: string }).title ?? '').trim();
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

function profileLinesToArray(text: string): string[] {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);
}

export function EditProfileSectionDetailScreen({
  navigation,
}: PProps<'EditProfileSectionDetail'>) {
  const route = useRoute<SectionDetailRoute>();
  const slug = route.params.slug;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const supabase = getSupabase();
  const live = isLiveUser(user);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [toast, setToast] = useState(false);
  const [bannerUrl, setBannerUrl] = useState('');
  const [bioText, setBioText] = useState('');
  const [interestTags, setInterestTags] = useState<string[]>([]);
  const [highlights, setHighlights] = useState<ProfileHighlight[]>([{ title: '', video_url: '' }]);
  const [resultsText, setResultsText] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingHighlight, setUploadingHighlight] = useState(false);
  const showBanner = useActionBanner();
  const keyboardInset = useKeyboardInset();

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(false), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        if (!live || !user?.id) return;
        const p = await fetchProfileByUserId(user.id);
        if (!alive) return;
        setProfile(p);
        setBannerUrl(p?.banner_url?.trim() || '');
        setBioText(p?.bio?.trim() || '');
        setInterestTags(p?.interests ?? []);
        const parsed = parseProfileHighlights(p?.highlights);
        setHighlights(parsed.length > 0 ? parsed : [{ title: '', video_url: '' }]);
        setResultsText(profileSectionLines(p?.recent_results));
      })();
      return () => {
        alive = false;
      };
    }, [live, user?.id, slug]),
  );

  const titles: Record<typeof slug, string> = {
    banner: 'Banner image',
    bio: 'Bio',
    interests: 'Interests',
    highlights: 'Highlights',
    recentResults: 'Recent Results',
  };

  const save = useCallback(async () => {
    if (!supabase || !user?.id || !live) {
      setToast(true);
      return;
    }
    try {
      if (slug === 'banner') {
        const url = bannerUrl.trim();
        const { error } = await supabase.from('profiles').update({ banner_url: url || null }).eq('id', user.id);
        if (error) throw new Error(error.message);
      } else if (slug === 'bio') {
        const v = bioText.trim();
        const { error } = await supabase.from('profiles').update({ bio: v || null }).eq('id', user.id);
        if (error) throw new Error(error.message);
      } else if (slug === 'interests') {
        const excludeSports = sportDedupeKeys(profile?.primary_sport, profile?.sports);
        const interests = interestTags
          .map((s) => s.trim())
          .filter(Boolean)
          .filter((t) => !excludeSports.has(t.toLowerCase()))
          .slice(0, 30);
        const { error } = await supabase.from('profiles').update({ interests }).eq('id', user.id);
        if (error) throw new Error(error.message);
      } else if (slug === 'highlights') {
        const rows = highlightsToJson(highlights);
        const { error } = await supabase.from('profiles').update({ highlights: rows }).eq('id', user.id);
        if (error) throw new Error(error.message);
      } else if (slug === 'recentResults') {
        const recent_results = profileLinesToArray(resultsText);
        const { error } = await supabase.from('profiles').update({ recent_results }).eq('id', user.id);
        if (error) throw new Error(error.message);
      }
      setToast(true);
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Could not save.');
    }
  }, [
    bannerUrl,
    bioText,
    highlights,
    interestTags,
    live,
    profile?.primary_sport,
    profile?.sports,
    resultsText,
    slug,
    supabase,
    user?.id,
  ]);

  const pickBannerImage = useCallback(async () => {
    if (!user?.id || !live) return;
    let pickedUri: string | undefined;
    if (Platform.OS === 'web') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to choose a banner image.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [3, 1],
        quality: 0.9,
      });
      if (res.canceled || !res.assets[0]?.uri) return;
      pickedUri = res.assets[0].uri;
    } else {
      const picked = await pickLocalImage({ title: 'Banner image' });
      if (!picked[0]?.uri) return;
      pickedUri = picked[0].uri;
    }
    setUploadingImage(true);
    const uploaded = await uploadAndSaveProfileImage(user.id, pickedUri, 'banner');
    setUploadingImage(false);
    if (!uploaded.ok) {
      Alert.alert('Upload failed', uploaded.error);
      return;
    }
    setBannerUrl(uploaded.publicUrl);
    setToast(true);
  }, [live, user?.id]);

  const scrollBottomPad = 32 + insets.bottom + keyboardInset + (keyboardInset > 0 ? 48 : 0);

  return (
    <View style={styles.root}>
      <UploadBlockingOverlay
        visible={uploadingHighlight}
        message="Uploading your highlight"
        submessage="Please do not leave this page whilst your highlight file is being uploaded."
      />
      <ScreenHeader title={titles[slug]} onBack={() => navigation.goBack()} largeTitle />
      {toast ? (
        <View style={[styles.editToast, { top: insets.top + 72 }]} pointerEvents="none">
          <FontAwesome name="check-circle" size={18} color={DS.color.white} />
          <Text style={styles.editToastText}> Saved</Text>
        </View>
      ) : null}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 56}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={[styles.padded, { paddingBottom: scrollBottomPad }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
        {slug === 'banner' ? (
          <>
            {bannerUrl.trim() ? (
              <Image source={{ uri: bannerUrl.trim() }} style={styles.bannerEditPreview} resizeMode="cover" />
            ) : (
              <View style={styles.bannerEditPreviewEmpty} />
            )}
            <Pressable
              style={styles.bannerEditGoldCell}
              onPress={() => void pickBannerImage()}
              disabled={uploadingImage}
            >
              <FontAwesome name="camera" size={16} color={DS.color.background} />
              <Text style={styles.bannerEditGoldCellText}>
                {uploadingImage ? 'Uploading…' : 'Edit banner'}
              </Text>
            </Pressable>
          </>
        ) : null}

        {slug === 'bio' ? (
          <>
            <Text style={styles.sectionDetailMuted}>Shown on your profile under Bio.</Text>
            <TextInput
              style={[styles.input, styles.bioLongInput]}
              multiline
              textAlignVertical="top"
              value={bioText}
              onChangeText={setBioText}
              maxLength={500}
            />
            <Text style={styles.bioCount}>{bioText.length}/500</Text>
          </>
        ) : null}

        {slug === 'interests' ? (
          <InterestsEditor
            value={interestTags}
            onChange={setInterestTags}
            hint="Tap suggestions or search and press Enter to add your own topics."
          />
        ) : null}

        {slug === 'highlights' ? (
          <>
            <Text style={styles.sectionDetailMuted}>
              Paste a YouTube link, or upload a clip from your photo library or files.
            </Text>
            {highlights.map((row, i) => {
              const uploadedClip = isUploadedHighlightMedia(row.video_url);
              const ytThumb = !uploadedClip
                ? resolveHighlightThumbnailUrl(row.video_url, row.thumbnail_url)
                : null;
              return (
                <View key={`hl-${i}`} style={styles.highlightEditBlock}>
                  {uploadedClip ? (
                    <View style={styles.highlightUploadedCard}>
                      <View style={styles.highlightUploadedIcon}>
                        <FontAwesome name="film" size={28} color={DS.color.gold} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.athleteLabel}>Uploaded video</Text>
                        <Text style={styles.highlightUploadedMeta} numberOfLines={2}>
                          Saved to your profile — plays in the highlight reel.
                        </Text>
                      </View>
                    </View>
                  ) : ytThumb ? (
                    <Image source={{ uri: ytThumb }} style={styles.highlightYtPreview} />
                  ) : null}
                  <Text style={styles.athleteLabel}>Title</Text>
                  <TextInput
                    style={styles.input}
                    value={row.title}
                    onChangeText={(t) =>
                      setHighlights((rows) => rows.map((r, j) => (j === i ? { ...r, title: t } : r)))
                    }
                    placeholder="National champion 2024"
                    placeholderTextColor={DS.color.textMuted}
                  />
                  {!uploadedClip ? (
                    <>
                      <Text style={[styles.athleteLabel, { marginTop: DS.space.sm }]}>Video URL</Text>
                      <TextInput
                        style={styles.input}
                        value={row.video_url}
                        onChangeText={(t) =>
                          setHighlights((rows) =>
                            rows.map((r, j) => (j === i ? { ...r, video_url: t } : r)),
                          )
                        }
                        placeholder="https://youtube.com/watch?v=…"
                        placeholderTextColor={DS.color.textMuted}
                        autoCapitalize="none"
                        keyboardType="url"
                      />
                    </>
                  ) : null}
                  <Pressable
                    style={[styles.photoActionRow, { marginTop: DS.space.sm }]}
                    disabled={uploadingHighlight}
                    onPress={() => {
                      void (async () => {
                        if (!user?.id || uploadingHighlight) return;
                        const picked = await pickLocalVideo({ title: 'Highlight video' });
                        const file = picked[0];
                        if (!file) return;
                        setUploadingHighlight(true);
                        showBanner(
                          'Uploading highlight',
                          'Please do not leave this page whilst your highlight file is being uploaded.',
                          { durationMs: 120_000 },
                        );
                        try {
                          const result = await uploadHighlightVideo(user.id, file.uri, file.name);
                          if (!result.ok) {
                            Alert.alert('Upload failed', result.error);
                            return;
                          }
                          const title = row.title.trim() || highlightTitleFromFileName(file.name);
                          setHighlights((rows) =>
                            rows.map((r, j) =>
                              j === i
                                ? { ...r, video_url: result.url, title, thumbnail_url: undefined }
                                : r,
                            ),
                          );
                          showBanner('Highlight uploaded', 'Your video is ready — tap Save to keep it on your profile.');
                        } finally {
                          setUploadingHighlight(false);
                        }
                      })();
                    }}
                  >
                    <FontAwesome name="video-camera" size={16} color={DS.color.gold} />
                    <Text style={styles.photoActionLabel}>
                      {uploadedClip ? ' Replace uploaded video' : ' Upload video (library or files)'}
                    </Text>
                  </Pressable>
                  {uploadedClip ? (
                    <Pressable
                      style={styles.photoRemoveRow}
                      onPress={() =>
                        setHighlights((rows) =>
                          rows.map((r, j) =>
                            j === i ? { ...r, video_url: '', thumbnail_url: undefined } : r,
                          ),
                        )
                      }
                    >
                      <FontAwesome name="youtube-play" size={16} color={DS.color.gold} />
                      <Text style={styles.photoActionLabel}> Use YouTube link instead</Text>
                    </Pressable>
                  ) : null}
                  {highlights.length > 1 ? (
                    <Pressable
                      style={styles.photoRemoveRow}
                      onPress={() => setHighlights((rows) => rows.filter((_, j) => j !== i))}
                    >
                      <FontAwesome name="trash" size={16} color={DS.color.error} />
                      <Text style={styles.photoRemoveLabel}>Remove highlight</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
            {highlights.length < 12 ? (
              <Pressable
                style={styles.photoActionRow}
                onPress={() => setHighlights((rows) => [...rows, { title: '', video_url: '' }])}
              >
                <FontAwesome name="plus" size={16} color={DS.color.gold} />
                <Text style={styles.photoActionLabel}>Add another highlight</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}

        {slug === 'recentResults' ? (
          <>
            <Text style={styles.sectionDetailMuted}>
              One result per line. Primary sport: {profile?.primary_sport ?? '—'}
            </Text>
            <TextInput
              style={[styles.input, styles.bioLongInput]}
              multiline
              textAlignVertical="top"
              value={resultsText}
              onChangeText={setResultsText}
              placeholder={'100m — 10.12s\nLong jump — 7.45m'}
              placeholderTextColor={DS.color.textMuted}
            />
          </>
        ) : null}

        <AppleHeroButton style={styles.saveBtnSpaced} onPress={() => void save()}>
          Save
        </AppleHeroButton>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: DS.color.background,
  },
  editPill: {
    borderWidth: 1,
    borderColor: DS.color.border,
    paddingHorizontal: DS.space.base,
    paddingVertical: DS.space.sm,
    borderRadius: DS.radius.pill,
  },
  editPillText: {
    color: DS.color.text,
    fontSize: 14,
    fontWeight: '600',
  },
  profileScroll: {
    paddingBottom: 24,
    marginTop: 0,
    paddingHorizontal: DS.space.lg,
  },
  profileBannerBleed: {
    marginHorizontal: -DS.space.lg,
    marginBottom: DS.space.sm,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  bannerImgBleed: { ...StyleSheet.absoluteFillObject },
  bannerEmpty: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000000' },
  bannerEditPreview: {
    width: '100%',
    height: 140,
    borderRadius: DS.radius.xl,
    marginBottom: DS.space.md,
    backgroundColor: DS.color.surface,
  },
  bannerEditPreviewEmpty: {
    width: '100%',
    height: 140,
    borderRadius: DS.radius.xl,
    marginBottom: DS.space.md,
    backgroundColor: DS.color.input,
  },
  bannerEditGoldCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DS.space.sm,
    backgroundColor: DS.color.gold,
    paddingVertical: 14,
    borderRadius: DS.radius.xl,
    marginBottom: DS.space.md,
  },
  bannerEditGoldCellText: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 16,
    fontWeight: '700',
    color: DS.color.background,
  },
  bannerEditPill: {
    position: 'absolute',
    bottom: DS.space.md,
    right: DS.space.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DS.color.gold,
    paddingHorizontal: DS.space.base,
    paddingVertical: 8,
    borderRadius: DS.radius.pill,
  },
  bannerEditTxt: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 13,
    fontWeight: '700',
    color: DS.color.background,
  },
  bannerSettingsFAB: {
    position: 'absolute',
    right: DS.space.md,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  bannerScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  avatarWrap: {
    alignSelf: 'center',
    marginTop: -48,
  },
  avatarWrapPlaceholder: {
    padding: 2,
    borderRadius: 100,
  },
  avatarRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 3,
    borderColor: DS.color.gold,
    backgroundColor: DS.color.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInnerPlain: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: DS.color.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  badgeOverlay: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: DS.color.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: DS.color.background,
  },
  profileName: {
    fontFamily: DS.font.heading,
    fontSize: 36,
    fontWeight: '400',
    color: DS.color.gold,
    letterSpacing: 2,
    marginTop: DS.space.base,
    textAlign: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DS.space.sm,
  },
  premiumMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: DS.color.goldTint10,
    borderWidth: 1,
    borderColor: DS.color.goldTint30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHandle: {
    marginTop: 6,
    fontFamily: DS.font.bodyMedium,
    fontSize: 14,
    color: DS.color.gold,
    textAlign: 'center',
  },
  tagRowPrimary: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: DS.space.md,
    width: '100%',
    paddingHorizontal: DS.space.lg,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: DS.space.sm,
    marginTop: DS.space.sm,
    width: '100%',
    paddingHorizontal: DS.space.lg,
    maxWidth: '100%',
  },
  followStatsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: DS.space.lg,
    flexWrap: 'wrap',
  },
  followStatsTxt: {
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.textMuted,
  },
  followStatsNum: {
    fontFamily: DS.font.bodyBold,
    fontSize: 14,
    color: DS.color.text,
  },
  followStatsSep: {
    fontFamily: DS.font.body,
    fontSize: 14,
    color: DS.color.textMuted,
    marginHorizontal: DS.space.xs,
  },
  bannerZoomBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: DS.space.lg,
  },
  bannerZoomImg: {
    width: '100%',
    height: '70%',
  },
  bioCard: {
    width: '100%',
    backgroundColor: DS.color.surfaceAlt,
    borderRadius: DS.radius.xl,
    padding: DS.space.md,
    marginTop: DS.space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.borderWhite5,
  },
  bioText: {
    fontFamily: DS.font.body,
    fontSize: 14,
    lineHeight: 20,
    color: DS.color.textMuted,
  },
  tag: {
    paddingHorizontal: DS.space.base,
    paddingVertical: 6,
    borderRadius: DS.radius.pill,
    borderWidth: 1,
    borderColor: DS.color.goldTint30,
  },
  tagText: {
    fontSize: 12,
    color: DS.color.textMuted,
  },
  tagGold: {
    paddingHorizontal: DS.space.md,
    paddingVertical: DS.space.sm,
    borderRadius: 999,
    backgroundColor: DS.color.gold,
    borderWidth: 1,
    borderColor: DS.color.goldTint30,
  },
  tagGoldText: {
    fontFamily: DS.font.bodyBold,
    fontSize: 12,
    color: DS.color.background,
  },
  // removed: stats + endorsed banner (per latest UX)
  highlightsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: DS.space.xl,
    marginBottom: DS.space.sm,
  },
  sectionTitleKicker: {
    fontFamily: DS.font.bodyBold,
    fontSize: 13,
    color: DS.color.textMuted,
    letterSpacing: 0.3,
  },
  sectionBlockFirst: {
    marginTop: DS.space.xl,
  },
  sectionBlock: {
    marginTop: DS.space.xl + DS.space.sm,
  },
  sectionCard: {
    width: '100%',
    backgroundColor: DS.apple.fillSecondary,
    borderRadius: DS.radius.xl,
    borderWidth: 1,
    borderColor: DS.apple.separator,
    padding: DS.space.lg,
    marginTop: DS.space.sm,
  },
  sectionBody: {
    fontFamily: DS.font.body,
    fontSize: 14,
    lineHeight: 21,
    color: DS.color.textMuted,
  },
  sectionCta: {
    marginTop: DS.space.sm,
    fontFamily: DS.font.bodyMedium,
    fontSize: 14,
    color: DS.color.gold,
  },
  sectionMuted: {
    marginTop: DS.space.xs,
    fontFamily: DS.font.body,
    fontSize: 13,
    color: DS.color.textMuted,
  },
  viewAllGold: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 13,
    color: DS.color.gold,
  },
  highlightsScroll: {
    gap: DS.space.md,
    paddingBottom: DS.space.md,
  },
  highlightCard: {
    width: 140,
    height: 88,
    borderRadius: DS.radius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  highlightThumb: {
    width: '100%',
    height: '100%',
  },
  highlightThumbPlaceholder: {
    flex: 1,
    backgroundColor: DS.color.surfaceAlt,
    padding: DS.space.sm,
    justifyContent: 'flex-end',
  },
  highlightThumbTitle: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 12,
    color: DS.color.text,
    lineHeight: 16,
  },
  highlightEditBlock: {
    marginTop: DS.space.lg,
    paddingBottom: DS.space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.color.borderHairline,
  },
  highlightUploadedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
    backgroundColor: DS.color.surface,
    borderRadius: DS.radius.lg,
    padding: DS.space.md,
    marginBottom: DS.space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DS.color.cardBorder,
  },
  highlightUploadedIcon: {
    width: 56,
    height: 56,
    borderRadius: DS.radius.md,
    backgroundColor: DS.color.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightUploadedMeta: {
    fontFamily: DS.font.body,
    fontSize: 13,
    color: DS.color.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  highlightYtPreview: {
    width: '100%',
    height: 120,
    borderRadius: DS.radius.lg,
    marginBottom: DS.space.md,
    backgroundColor: DS.color.surfaceAlt,
  },
  highlightPlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -16,
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: DS.color.goldTint90,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: DS.space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.color.borderHairline,
    gap: DS.space.md,
  },
  resultMeet: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 15,
    color: DS.color.text,
  },
  resultWhere: {
    fontFamily: DS.font.body,
    fontSize: 12,
    color: DS.color.textMuted,
    marginTop: 4,
  },
  pbPill: {
    alignItems: 'flex-end',
  },
  pbPillText: {
    fontFamily: DS.font.bodyBold,
    fontSize: 10,
    color: DS.color.gold,
    letterSpacing: 1,
  },
  pbTime: {
    fontFamily: DS.font.heading,
    fontSize: 20,
    color: DS.color.gold,
    marginTop: 2,
  },
  sectionTitle: {
    alignSelf: 'flex-start',
    marginTop: DS.space.xl,
    fontSize: 16,
    fontWeight: '700',
    color: DS.color.text,
    marginBottom: DS.space.sm,
  },
  muted: {
    alignSelf: 'flex-start',
    color: DS.color.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: DS.space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.color.borderHairline,
    gap: DS.space.md,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: DS.color.text,
    fontWeight: '600',
  },
  padded: {
    paddingHorizontal: DS.space.lg,
    paddingBottom: DS.space.lg,
  },
  accountStatusCard: {
    backgroundColor: DS.color.surfaceAlt,
    borderRadius: DS.radius.xl,
    padding: DS.space.lg,
    marginBottom: DS.space.lg,
    borderWidth: 1,
    borderColor: DS.color.borderHairline,
  },
  accountStatusLabel: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 12,
    fontWeight: '700',
    color: DS.color.gold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: DS.space.sm,
  },
  accountStatusEmail: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 16,
    color: DS.color.text,
    marginBottom: DS.space.md,
  },
  accountStatusMethod: {
    fontFamily: DS.font.body,
    fontSize: 13,
    color: DS.color.textMuted,
    marginTop: -DS.space.sm,
  },
  accountVerifyBadge: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 14,
    fontWeight: '600',
  },
  accountVerifyOn: {
    color: DS.color.gold,
  },
  accountVerifyOff: {
    color: DS.color.textMuted,
  },
  accountStatusHint: {
    fontFamily: DS.font.body,
    fontSize: 13,
    color: DS.color.textMuted,
    marginTop: DS.space.md,
    lineHeight: 19,
  },
  settingsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DS.color.surfaceAlt,
    borderRadius: DS.radius.xl,
    padding: DS.space.base,
    marginBottom: DS.space.md,
    borderWidth: 1,
    borderColor: DS.color.borderHairline,
    gap: DS.space.md,
  },
  settingsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DS.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: DS.color.text,
  },
  settingsSub: {
    fontSize: 13,
    color: DS.color.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  logOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DS.color.gold,
    paddingVertical: DS.space.base,
    borderRadius: DS.radius.lg,
    marginTop: DS.space.xl,
  },
  logOutBtnText: {
    fontFamily: DS.font.bodyBold,
    fontSize: 15,
    color: DS.color.background,
    letterSpacing: 0.5,
  },
  deleteAccountWrap: {
    alignItems: 'center',
    paddingVertical: DS.space.lg,
    marginBottom: DS.space.xl,
  },
  deleteAccountTxt: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 15,
    color: DS.color.error,
  },
  flex1: {
    flex: 1,
  },
  editToast: {
    position: 'absolute',
    left: DS.space.lg,
    right: DS.space.lg,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DS.space.sm,
    backgroundColor: '#16a34a',
    paddingVertical: DS.space.md,
    paddingHorizontal: DS.space.lg,
    borderRadius: DS.radius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  editToastText: {
    fontSize: 14,
    fontWeight: '600',
    color: DS.color.white,
  },
  editFirstLabel: {
    marginTop: 0,
  },
  labelSpaced: {
    marginTop: DS.space.lg,
  },
  reqStar: {
    color: DS.color.error,
  },
  fieldError: {
    fontSize: 12,
    color: DS.color.error,
    marginTop: 6,
  },
  fieldHelp: {
    marginTop: 6,
    fontFamily: DS.font.body,
    fontSize: 13,
    color: DS.color.textMuted,
  },
  inputError: {
    borderWidth: 1,
    borderColor: DS.color.error,
  },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  handleAt: {
    position: 'absolute',
    left: DS.space.base,
    zIndex: 1,
    fontSize: 15,
    color: DS.color.textMuted,
  },
  inputHandle: {
    flex: 1,
    paddingLeft: 28,
  },
  inputBio: {
    minHeight: 112,
    paddingTop: DS.space.base,
  },
  bioCount: {
    fontSize: 12,
    color: DS.color.textMuted,
    marginTop: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  locationIcon: {
    position: 'absolute',
    left: DS.space.base,
    zIndex: 1,
  },
  inputLocation: {
    flex: 1,
    paddingLeft: 36,
  },
  sportTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: DS.color.input,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    borderColor: DS.color.borderHairline,
    paddingHorizontal: DS.space.base,
    paddingVertical: DS.space.md,
  },
  sportTriggerText: {
    fontSize: 16,
    color: DS.color.text,
  },
  saveBtnSpaced: {
    marginTop: DS.space.xxl,
  },
  cancelBtn: {
    marginTop: DS.space.md,
    backgroundColor: DS.color.surfaceAlt,
    paddingVertical: DS.space.base,
    borderRadius: DS.radius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: DS.color.borderHairline,
  },
  cancelBtnText: {
    color: DS.color.text,
    fontWeight: '600',
    fontSize: 16,
  },
  sportModalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: DS.space.lg,
  },
  editModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  sportModalSheet: {
    width: '100%',
    maxWidth: 340,
    maxHeight: '70%',
    backgroundColor: DS.color.surface,
    borderRadius: DS.radius.xxl,
    borderWidth: 1,
    borderColor: DS.color.borderWhite5,
    paddingVertical: DS.space.md,
    overflow: 'hidden',
  },
  sportModalTitle: {
    fontFamily: DS.font.bodyBold,
    fontSize: 16,
    color: DS.color.text,
    paddingHorizontal: DS.space.lg,
    paddingBottom: DS.space.sm,
    marginBottom: DS.space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.color.borderHairline,
  },
  sportModalList: {
    paddingHorizontal: DS.space.sm,
  },
  sportModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: DS.space.md,
    paddingHorizontal: DS.space.md,
    borderRadius: DS.radius.md,
  },
  sportModalRowText: {
    fontSize: 15,
    color: DS.color.text,
  },
  sportModalRowTextOn: {
    color: DS.color.gold,
    fontWeight: '600',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: DS.color.gold,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: DS.space.sm,
    marginTop: DS.space.md,
  },
  input: {
    backgroundColor: DS.color.input,
    borderRadius: DS.radius.lg,
    padding: DS.space.base,
    fontSize: 16,
    color: DS.color.text,
    borderWidth: 1,
    borderColor: DS.color.borderHairline,
  },
  largeAvatar: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignSelf: 'center',
    marginBottom: DS.space.xl,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: DS.color.gold,
    paddingVertical: DS.space.md,
    borderRadius: DS.radius.lg,
    alignItems: 'center',
  },
  secondaryText: {
    color: DS.color.gold,
    fontWeight: '600',
  },
  photoHero: {
    alignSelf: 'center',
    marginTop: DS.space.lg,
    marginBottom: DS.space.lg,
    position: 'relative',
  },
  photoGoldRing: {
    padding: 4,
    borderRadius: 200,
    backgroundColor: DS.color.gold,
  },
  photoInnerCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: DS.color.surface,
    overflow: 'hidden',
    position: 'relative',
  },
  photoInnerImg: {
    width: '100%',
    height: '100%',
  },
  photoCropOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 64,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: DS.color.gold,
  },
  photoCameraFab: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DS.color.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  photoHintTitle: {
    textAlign: 'center',
    fontSize: 14,
    color: DS.color.textMuted,
    marginBottom: 6,
  },
  photoHintSub: {
    textAlign: 'center',
    fontSize: 12,
    color: DS.color.textMuted,
    opacity: 0.85,
    marginBottom: DS.space.xl,
  },
  photoActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DS.space.md,
    paddingVertical: DS.space.base,
    marginBottom: DS.space.sm,
    borderRadius: DS.radius.lg,
    backgroundColor: DS.color.surfaceAlt,
    borderWidth: 1,
    borderColor: DS.color.borderHairline,
  },
  photoActionRowActive: {
    backgroundColor: DS.color.goldTint10,
    borderColor: DS.color.goldTint30,
  },
  photoActionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: DS.color.text,
  },
  photoRemoveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DS.space.md,
    paddingVertical: DS.space.base,
    marginBottom: DS.space.lg,
    borderRadius: DS.radius.lg,
    backgroundColor: 'rgba(232, 83, 58, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(232, 83, 58, 0.35)',
  },
  photoRemoveLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: DS.color.error,
  },
  athleteLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: DS.color.text,
    marginBottom: 8,
  },
  athleteHint: {
    fontSize: 12,
    color: DS.color.textMuted,
    marginTop: 6,
  },
  athleteHintSpaced: {
    fontSize: 12,
    color: DS.color.textMuted,
    marginBottom: DS.space.md,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: DS.space.sm,
  },
  badgeCell: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    padding: DS.space.md,
    borderRadius: DS.radius.lg,
    backgroundColor: DS.color.surfaceAlt,
    borderWidth: 1,
    borderColor: DS.color.borderHairline,
    marginBottom: DS.space.sm,
  },
  badgeCellOn: {
    borderColor: DS.color.gold,
  },
  badgeCellText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: DS.color.text,
  },
  sectionList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: DS.space.md,
  },
  profileSectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    padding: DS.space.base,
    borderRadius: DS.radius.xl,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    width: '48%',
    minWidth: 148,
    flexGrow: 1,
    flexBasis: '47%',
    maxWidth: '100%',
  },
  profileSectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DS.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: DS.color.text,
  },
  profileSectionSub: {
    fontSize: 12,
    color: DS.color.textMuted,
    marginTop: 4,
    lineHeight: 16,
  },
  sectionStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  completionCard: {
    marginTop: DS.space.xl,
    padding: DS.space.base,
    borderRadius: DS.radius.xl,
    backgroundColor: 'rgba(18, 18, 18, 0.85)',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  completionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.md,
    marginBottom: DS.space.md,
  },
  completionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: DS.color.goldTint10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: DS.color.text,
  },
  completionTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: DS.color.input,
    overflow: 'hidden',
    marginBottom: DS.space.sm,
  },
  completionFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: DS.color.gold,
  },
  completionHint: {
    fontSize: 12,
    color: DS.color.textMuted,
    lineHeight: 18,
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: DS.color.textMuted,
    marginTop: DS.space.lg,
    marginBottom: DS.space.sm,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DS.space.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendText: {
    fontSize: 12,
    color: DS.color.textMuted,
  },
  sectionDetailMuted: {
    fontSize: 14,
    color: DS.color.textMuted,
    lineHeight: 22,
    marginBottom: DS.space.lg,
  },
  hlStrip: {
    marginBottom: DS.space.lg,
  },
  hlStripThumb: {
    width: 140,
    height: 88,
    borderRadius: DS.radius.lg,
    marginRight: DS.space.md,
  },
  recentEditCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: DS.space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.color.borderHairline,
    marginBottom: DS.space.sm,
  },
  recentEditMeet: {
    fontSize: 15,
    fontWeight: '600',
    color: DS.color.text,
  },
  recentEditWhere: {
    fontSize: 12,
    color: DS.color.textMuted,
    marginTop: 4,
  },
  recentEditTime: {
    fontFamily: DS.font.heading,
    fontSize: 18,
    color: DS.color.gold,
  },
  bioLongInput: {
    minHeight: 160,
    paddingTop: DS.space.base,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: DS.space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.color.borderHairline,
  },
  toggleOn: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: DS.color.gold,
  },
});
