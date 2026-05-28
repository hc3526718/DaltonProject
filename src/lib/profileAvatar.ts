import type { ImageSourcePropType } from 'react-native';
import { DALTON_LOGO_FINAL_IMG } from '../constants/brandAssets';

/** True when the user has uploaded a custom avatar URL in Supabase. */
export function hasCustomProfileAvatar(avatarUrl: string | null | undefined): boolean {
  const t = avatarUrl?.trim();
  return Boolean(t && t.length > 8);
}

/**
 * Profile image for any surface (feed, inbox, thread, lists).
 * Never uses stock/demo URLs — only the user's photo or the Dalton default asset.
 */
export function resolveProfileAvatarSource(
  avatarUrl: string | null | undefined,
): ImageSourcePropType {
  if (hasCustomProfileAvatar(avatarUrl)) {
    return { uri: avatarUrl!.trim() };
  }
  return DALTON_LOGO_FINAL_IMG;
}

export function isDaltonDefaultAvatarSource(src: ImageSourcePropType): boolean {
  return typeof src === 'number' && src === DALTON_LOGO_FINAL_IMG;
}
