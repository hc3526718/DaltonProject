import { Platform, type ViewStyle } from 'react-native';

/** Legacy narrow column — prefer full-width web shell below. */
export const WEB_MAX_CONTENT_WIDTH = 520;

/** Centered column for profile hero + sections on web. */
export const WEB_PROFILE_MAX_WIDTH = 640;

export function isExpoWeb(): boolean {
  return Platform.OS === 'web';
}

/** Full-width page container on web (all tabs / settings / search). */
export function webPageShellStyle(): ViewStyle {
  if (!isExpoWeb()) return {};
  return {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
  };
}

/** @deprecated Use webPageShellStyle — kept for gradual migration. */
export function webContentShellStyle(): ViewStyle {
  return webPageShellStyle();
}

/** Community feed on web — full width (no trending sidebar). */
export function webCommunityFeedPaneStyle(): ViewStyle {
  if (!isExpoWeb()) return { flex: 1 };
  return {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
  };
}

/** Community trending sidebar on web (other half of split row). */
export function webCommunityTrendingPaneStyle(): ViewStyle {
  if (!isExpoWeb()) return {};
  return {
    flex: 1,
    minWidth: 280,
    alignSelf: 'stretch',
  };
}

/** @deprecated Use webCommunityFeedPaneStyle in split layout. */
export function webFeedColumnStyle(): ViewStyle {
  if (!isExpoWeb()) return { flex: 1 };
  return {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
  };
}
