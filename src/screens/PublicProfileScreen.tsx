import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppLoadingIndicator } from '../components/AppLoadingIndicator';
import { MemberProfileView } from '../components/profile/MemberProfileView';
import { DS } from '../designSystem';
import { formatAuthorDisplayName } from '../lib/communityPostBody';
import { isSupabaseConfigured } from '../lib/env';
import { isExpoWeb, webPageShellStyle } from '../layout/webLayout';
import type { CommunityStackParamList, ProfileStackParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';
import { fetchProfileByUserId } from '../roadmap/profileService';
import type { ProfileRow } from '../roadmap/types';
import {
  followUserDirect,
  getFollowCounts,
  isUserFollowing,
  unfollowUserDirect,
} from '../roadmap/followService';
import { resolveCanMessagePeer } from '../roadmap/messagingGateService';

type Props =
  | NativeStackScreenProps<CommunityStackParamList, 'PublicProfile'>
  | NativeStackScreenProps<ProfileStackParamList, 'PublicProfile'>;

export function PublicProfileScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userId = route.params.userId;
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [bannerZoomOpen, setBannerZoomOpen] = useState(false);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const row = await fetchProfileByUserId(userId);
    setProfile(row);
    const counts = await getFollowCounts(userId);
    setFollowCounts(counts);
    if (user?.id && user.id !== userId && !user.id.startsWith('demo-')) {
      setFollowing(await isUserFollowing(user.id, userId));
    } else {
      setFollowing(false);
    }
    setLoading(false);
  }, [userId, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const bannerSource =
    profile?.banner_url?.trim()
      ? ({ uri: profile.banner_url.trim() } as const)
      : null;

  const displayName = useMemo(() => {
    if (!profile) return 'Profile';
    const label = formatAuthorDisplayName(profile);
    if (label !== 'Member') return label;
    return profile.username?.trim() ? `@${profile.username.trim()}` : 'Member';
  }, [profile]);

  const messageDisplayName = useMemo(() => {
    if (!profile) return displayName;
    const label = formatAuthorDisplayName(profile);
    if (label !== 'Member') return label;
    return profile.username?.trim() ? `@${profile.username.trim()}` : 'Member';
  }, [profile, displayName]);

  const canFollow =
    Boolean(user?.id && !user.id.startsWith('demo-') && user.id !== userId && userId.length > 10);

  const showVerifiedBadge = false;

  const openMessage = async () => {
    if (!canFollow || !user?.id) return;
    const gate = await resolveCanMessagePeer(user.id, userId);
    if (!gate.ok) {
      Alert.alert('Cannot message', gate.message);
      return;
    }
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate(
        'Community' as never,
        {
          screen: 'MessageThread',
          params: {
            peerUserId: userId,
            name: messageDisplayName,
            avatarUrl: profile?.avatar_url?.trim() || undefined,
          },
        } as never,
      );
      return;
    }
    navigation.navigate('MessageThread' as never, {
      peerUserId: userId,
      name: messageDisplayName,
      avatarUrl: profile?.avatar_url?.trim() || undefined,
    } as never);
  };

  const toggleFollow = async () => {
    if (!canFollow || !user?.id || followBusy) return;
    setFollowBusy(true);
    if (following) {
      const ok = await unfollowUserDirect(user.id, userId);
      if (ok) {
        setFollowing(false);
        setFollowCounts((c) => ({ ...c, followers: Math.max(0, c.followers - 1) }));
      }
    } else {
      const ok = await followUserDirect(user.id, userId);
      if (ok) {
        setFollowing(true);
        setFollowCounts((c) => ({ ...c, followers: c.followers + 1 }));
      }
    }
    setFollowBusy(false);
  };

  const demoUser = Boolean(user?.id?.startsWith('demo-'));

  return (
    <View style={[styles.root, webPageShellStyle()]}>
      {loading ? (
        <View style={[styles.loadingWrap, { paddingTop: insets.top + DS.space.xl }]}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.backFab}>
            <FontAwesome name="arrow-left" size={18} color={DS.color.text} />
          </Pressable>
          <AppLoadingIndicator style={{ marginTop: 32 }} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: 48 + insets.bottom, paddingTop: insets.top },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={10}
            style={[styles.backFab, { top: insets.top + DS.space.sm }]}
          >
            <FontAwesome name="arrow-left" size={18} color="#FFFFFF" />
          </Pressable>

          <MemberProfileView
            profile={profile}
            displayName={displayName}
            followCounts={followCounts}
            mode="public"
            showVerifiedBadge={showVerifiedBadge}
            onBannerPress={() => {
              if (bannerSource) setBannerZoomOpen(true);
            }}
            onFollowersPress={() =>
              navigation.navigate('FollowUserList', { userId, mode: 'followers' })
            }
            onFollowingPress={() =>
              navigation.navigate('FollowUserList', { userId, mode: 'following' })
            }
            canFollow={canFollow}
            following={following}
            followBusy={followBusy}
            onToggleFollow={() => void toggleFollow()}
            onMessage={() => void openMessage()}
          />
        </ScrollView>
      )}

      <Modal
        visible={bannerZoomOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setBannerZoomOpen(false)}
      >
        <Pressable style={styles.bannerZoomBackdrop} onPress={() => setBannerZoomOpen(false)}>
          {bannerSource ? (
            <Image source={bannerSource} style={styles.bannerZoomImg} resizeMode="contain" />
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.color.background },
  loadingWrap: {
    flex: 1,
    paddingHorizontal: DS.space.lg,
  },
  scroll: {
    paddingHorizontal: DS.space.lg,
    ...(isExpoWeb() ? { alignItems: 'center' as const } : {}),
  },
  backFab: {
    position: 'absolute',
    left: DS.space.lg,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  bannerZoomBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: DS.space.lg,
    ...(isExpoWeb() ? { maxWidth: 900, alignSelf: 'center' as const, width: '100%' as const } : {}),
  },
  bannerZoomImg: {
    width: '100%',
    height: '70%',
  },
});
