import type { InAppNotifyCategory } from './notificationBannerPrefs';

export type NotifyPrefsUser = {
  masterControl?: boolean;
  role?: string;
};

/** Dalton Academy master-control accounts (full notification + privacy tooling). */
export function isMasterControlUser(user: NotifyPrefsUser | null | undefined): boolean {
  if (!user) return false;
  if (user.masterControl === true) return true;
  const role = (user.role ?? '').toLowerCase();
  return role === 'admin' || role === 'super_admin';
}

/** In-app banner categories available to standard (non-master) accounts. */
export const BASIC_IN_APP_NOTIFY_CATEGORIES: InAppNotifyCategory[] = [
  'postInteraction',
  'messages',
  'eventBooking',
  'system',
];

/** Master-only in-app categories (creator / partner / host tooling). */
export const MASTER_ONLY_IN_APP_NOTIFY_CATEGORIES: InAppNotifyCategory[] = [
  'eventAttendance',
  'eventCreation',
  'mediaCreation',
  'masterProposals',
];

export function inAppNotifyCategoriesForUser(isMaster: boolean): InAppNotifyCategory[] {
  return isMaster
    ? [...BASIC_IN_APP_NOTIFY_CATEGORIES, ...MASTER_ONLY_IN_APP_NOTIFY_CATEGORIES]
    : [...BASIC_IN_APP_NOTIFY_CATEGORIES];
}

export function canAccessInAppNotifyCategory(
  category: InAppNotifyCategory,
  isMaster: boolean,
): boolean {
  if ((MASTER_ONLY_IN_APP_NOTIFY_CATEGORIES as readonly string[]).includes(category)) {
    return isMaster;
  }
  return (BASIC_IN_APP_NOTIFY_CATEGORIES as readonly string[]).includes(category);
}
