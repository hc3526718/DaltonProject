import { useMemo } from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { AppleHeroButton } from '../AppleHeroButton';
import { DS } from '../../designSystem';
import { DALTON_LOGO_FINAL_IMG } from '../../constants/brandAssets';
import {
  interestsForProfileDisplay,
  PROFILE_EMPTY_BIO,
  PROFILE_EMPTY_BIO_PUBLIC,
  PROFILE_EMPTY_INTERESTS,
  PROFILE_EMPTY_INTERESTS_PUBLIC,
} from '../../lib/profileDisplay';
import { isExpoWeb, WEB_PROFILE_MAX_WIDTH } from '../../layout/webLayout';
import type { ProfileRow } from '../../roadmap/types';

export type MemberProfileViewProps = {
  profile: ProfileRow | null;
  displayName: string;
  followCounts: { followers: number; following: number };
  /** Own profile vs viewing another member */
  mode: 'self' | 'public';
  showVerifiedBadge?: boolean;
  onBannerPress?: () => void;
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
  onBioPress?: () => void;
  onInterestsPress?: () => void;
  canFollow?: boolean;
  following?: boolean;
  followBusy?: boolean;
  onToggleFollow?: () => void;
  onMessage?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
};

export function MemberProfileView({
  profile,
  displayName,
  followCounts,
  mode,
  showVerifiedBadge = false,
  onBannerPress,
  onFollowersPress,
  onFollowingPress,
  onBioPress,
  onInterestsPress,
  canFollow = false,
  following = false,
  followBusy = false,
  onToggleFollow,
  onMessage,
  contentStyle,
}: MemberProfileViewProps) {
  const isPublic = mode === 'public';
  const hasCustomAvatar = Boolean(profile?.avatar_url?.trim());
  const avatarSource = hasCustomAvatar
    ? ({ uri: profile!.avatar_url!.trim() } as const)
    : DALTON_LOGO_FINAL_IMG;

  const primarySport = profile?.primary_sport?.trim() || (profile?.sports ?? [])[0] || '';
  const interestLabels = useMemo(
    () => interestsForProfileDisplay(profile?.interests, profile?.primary_sport, profile?.sports),
    [profile?.interests, profile?.primary_sport, profile?.sports],
  );

  const bannerSource =
    profile?.banner_url?.trim() ? ({ uri: profile.banner_url.trim() } as const) : null;

  const bioText = profile?.bio?.trim()
    ? profile.bio.trim()
    : isPublic
      ? PROFILE_EMPTY_BIO_PUBLIC
      : PROFILE_EMPTY_BIO;

  const interestsText = interestLabels.length
    ? interestLabels.join(' · ')
    : isPublic
      ? PROFILE_EMPTY_INTERESTS_PUBLIC
      : PROFILE_EMPTY_INTERESTS;

  const bannerHeight = isExpoWeb() ? 200 : 168;

  return (
    <View style={[styles.content, isExpoWeb() && styles.contentWeb, contentStyle]}>
      <Pressable
        style={[styles.bannerBleed, { height: bannerHeight }]}
        onPress={onBannerPress}
        disabled={!bannerSource}
      >
        {bannerSource ? (
          <Image source={bannerSource} style={styles.bannerImg} resizeMode="cover" />
        ) : (
          <View style={styles.bannerEmpty} />
        )}
        <View style={styles.bannerScrim} pointerEvents="none" />
        <View style={styles.bannerGoldLine} pointerEvents="none" />
      </Pressable>

      <View style={[styles.avatarWrap, !hasCustomAvatar && styles.avatarWrapPlaceholder]}>
        <View style={hasCustomAvatar ? styles.avatarInnerPlain : styles.avatarRing}>
          <Image source={avatarSource} style={styles.avatar} />
        </View>
        {showVerifiedBadge ? (
          <View style={styles.badgeOverlay}>
            <FontAwesome name="star" size={14} color={DS.color.background} />
          </View>
        ) : null}
      </View>

      <View style={styles.nameRow}>
        <Text style={styles.profileName} numberOfLines={2}>
          {displayName}
        </Text>
        {showVerifiedBadge ? (
          <View style={styles.premiumMark}>
            <FontAwesome name="certificate" size={16} color={DS.color.gold} />
          </View>
        ) : null}
      </View>
      {profile?.username?.trim() ? (
        <Text style={styles.profileHandle}>@{profile.username.trim()}</Text>
      ) : null}

      {(primarySport || (profile?.sports ?? []).length > 0 || profile?.persona_role?.trim()) ? (
        <View style={styles.tagRow}>
          {primarySport ? (
            <View style={styles.tagGold}>
              <Text style={styles.tagGoldText}>{primarySport}</Text>
            </View>
          ) : null}
          {(profile?.sports ?? [])
            .filter((s) => s !== primarySport)
            .slice(0, 2)
            .map((s) => (
              <View key={s} style={styles.tag}>
                <Text style={styles.tagText}>{s}</Text>
              </View>
            ))}
          {profile?.persona_role?.trim() ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{profile.persona_role.trim()}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.followStatsRow}>
        <Pressable onPress={onFollowersPress} hitSlop={8} disabled={!onFollowersPress}>
          <Text style={styles.followStatsTxt}>
            <Text style={styles.followStatsNum}>{followCounts.followers}</Text>
            {' Followers'}
          </Text>
        </Pressable>
        <Text style={styles.followStatsSep}> · </Text>
        <Pressable onPress={onFollowingPress} hitSlop={8} disabled={!onFollowingPress}>
          <Text style={styles.followStatsTxt}>
            <Text style={styles.followStatsNum}>{followCounts.following}</Text>
            {' Following'}
          </Text>
        </Pressable>
      </View>

      {canFollow ? (
        <View style={styles.actionRow}>
          <AppleHeroButton
            variant={following ? 'unfollow' : 'primary'}
            loading={followBusy}
            onPress={() => onToggleFollow?.()}
            style={following ? styles.followUnfollowBtn : styles.followGoldBtn}
          >
            {following ? 'Unfollow' : 'Follow'}
          </AppleHeroButton>
          <Pressable style={styles.messageBtn} onPress={() => onMessage?.()}>
            <FontAwesome name="envelope-o" size={16} color={DS.color.gold} />
            <Text style={styles.messageBtnTxt}>Message</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={[styles.sectionTitle, styles.sectionBlockFirst]}>About</Text>
      <Pressable
        style={styles.sectionCard}
        onPress={onBioPress}
        disabled={!onBioPress}
      >
        <Text style={[styles.sectionBody, !profile?.bio?.trim() && styles.sectionBodyEmpty]}>
          {bioText}
        </Text>
        {!profile?.bio?.trim() && onBioPress ? (
          <Text style={styles.sectionCta}>Add bio →</Text>
        ) : null}
      </Pressable>

      <Text style={[styles.sectionTitle, styles.sectionBlock]}>Interests</Text>
      <Pressable
        style={styles.sectionCard}
        onPress={onInterestsPress}
        disabled={!onInterestsPress}
      >
        <Text style={[styles.sectionBody, !interestLabels.length && styles.sectionBodyEmpty]}>
          {interestsText}
        </Text>
        {!interestLabels.length && onInterestsPress ? (
          <Text style={styles.sectionCta}>Add interests →</Text>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
  },
  contentWeb: {
    maxWidth: WEB_PROFILE_MAX_WIDTH,
    alignSelf: 'center',
    ...(Platform.OS === 'web'
      ? ({ width: '100%' } as ViewStyle)
      : {}),
  },
  bannerBleed: {
    marginHorizontal: -DS.space.lg,
    marginBottom: DS.space.sm,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  bannerImg: { ...StyleSheet.absoluteFillObject },
  bannerEmpty: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000000' },
  bannerScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  bannerGoldLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: DS.color.goldTint30,
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
    borderWidth: 2,
    borderColor: DS.color.goldTint30,
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
    textAlign: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DS.space.sm,
    marginTop: DS.space.base,
    paddingHorizontal: DS.space.md,
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
  tagRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignSelf: 'center',
    flexWrap: 'wrap',
    gap: DS.space.md,
    marginTop: DS.space.md,
    paddingHorizontal: DS.space.sm,
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
    fontFamily: DS.font.body,
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
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DS.space.md,
    marginTop: DS.space.lg,
    paddingHorizontal: DS.space.sm,
    maxWidth: 420,
    alignSelf: 'center',
    width: '100%',
  },
  followGoldBtn: {
    backgroundColor: DS.color.gold,
    borderColor: DS.color.gold,
    minHeight: 44,
    flex: 1,
  },
  followUnfollowBtn: {
    minHeight: 44,
    flex: 1,
  },
  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DS.space.xs,
    paddingVertical: DS.space.sm,
    paddingHorizontal: DS.space.md,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    borderColor: DS.color.goldTint30,
    minHeight: 44,
    minWidth: 120,
    backgroundColor: DS.color.goldTint10,
  },
  messageBtnTxt: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 14,
    color: DS.color.gold,
  },
  sectionTitle: {
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
    color: DS.color.text,
  },
  sectionBodyEmpty: {
    color: DS.color.textMuted,
    fontStyle: 'italic',
  },
  sectionCta: {
    marginTop: DS.space.sm,
    fontFamily: DS.font.bodyMedium,
    fontSize: 14,
    color: DS.color.gold,
  },
});
