import { InteractionManager, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import { openCommunityMessageThread, openEventDetails } from '../navigation/rootNavigationRef';
import { isSupabaseConfigured } from './env';
import { isPushDeliveryEnabled, setPushDeliveryEnabled } from './pushPrefsGate';
import { fetchUserPrefsDoc } from '../roadmap/userSettingsService';
import { registerDevicePushToken, unregisterDevicePushToken } from '../roadmap/notificationsService';

let notificationResponseListenerAttached = false;
let androidChannelReady = false;
let pushTokenRegistrationInFlight: Promise<void> | null = null;

const EXPO_PUSH_TOKEN_MAX_ATTEMPTS = 4;
const EXPO_PUSH_TOKEN_RETRY_MS = [2000, 5000, 10000];

export type PushPermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export type PushPermissionSnapshot = {
  status: PushPermissionStatus;
  canAskAgain: boolean;
};

function pushDebug(step: string, detail?: unknown): void {
  if (!__DEV__) return;
  if (detail !== undefined) {
    console.log(`[push] ${step}`, detail);
  } else {
    console.log(`[push] ${step}`);
  }
}

async function loadNotificationsModule() {
  return import('expo-notifications');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getEasProjectId(): string | null {
  const id =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants.expoConfig as { extra?: { easProjectId?: string } })?.extra?.easProjectId;
  const trimmed = id != null ? String(id).trim() : '';
  return trimmed || null;
}

/** Expo `exp.host` token API — often flaky (503 / connection timeout). */
function isTransientExpoPushTokenError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /upstream connect error|connection timeout|connection termination|503|504|ECONNRESET|ECONNREFUSED|no healthy upstream|fetching Expo token/i.test(
    msg,
  );
}

type NotificationsModule = Awaited<ReturnType<typeof loadNotificationsModule>>;

async function fetchExpoPushTokenWithRetry(
  Notifications: NotificationsModule,
  projectId: string,
): Promise<string | null> {
  const useSandboxApns = Platform.OS === 'ios' && __DEV__;
  for (let attempt = 1; attempt <= EXPO_PUSH_TOKEN_MAX_ATTEMPTS; attempt++) {
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
        ...(useSandboxApns ? { development: true } : {}),
      });
      const token = tokenData.data?.trim();
      if (token) {
        if (attempt > 1) pushDebug(`getExpoPushTokenAsync succeeded on attempt ${attempt}`);
        return token;
      }
      pushDebug(`getExpoPushTokenAsync empty on attempt ${attempt}`);
    } catch (err) {
      const transient = isTransientExpoPushTokenError(err);
      pushDebug(
        `getExpoPushTokenAsync attempt ${attempt}/${EXPO_PUSH_TOKEN_MAX_ATTEMPTS} failed`,
        err,
      );
      if (!transient || attempt === EXPO_PUSH_TOKEN_MAX_ATTEMPTS) throw err;
    }
    const waitMs = EXPO_PUSH_TOKEN_RETRY_MS[attempt - 1] ?? 10000;
    pushDebug(`retrying Expo push token in ${waitMs}ms (exp.host timeout or 503)`);
    await delay(waitMs);
  }
  return null;
}

export async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android' || androidChannelReady) return;
  try {
    const Notifications = await loadNotificationsModule();
    await Notifications.setNotificationChannelAsync('default', {
      name: 'The Dalton Grant Academy',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#C8A84B',
    });
    androidChannelReady = true;
  } catch (err) {
    pushDebug('android channel setup failed', err);
  }
}

export async function getPushPermissionSnapshot(): Promise<PushPermissionSnapshot> {
  try {
    const Notifications = await loadNotificationsModule();
    const settings = await Notifications.getPermissionsAsync();
    const status = settings.status as PushPermissionStatus;
    return {
      status: status === 'granted' || status === 'denied' || status === 'undetermined' ? status : 'unavailable',
      canAskAgain: settings.canAskAgain !== false,
    };
  } catch {
    return { status: 'unavailable', canAskAgain: false };
  }
}

/** System permission dialog — call after sign-in or from Settings → Notifications. */
export async function requestPushPermissions(): Promise<PushPermissionSnapshot> {
  try {
    const Notifications = await loadNotificationsModule();
    await ensureAndroidNotificationChannel();
    const result = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    pushDebug('permission (after explicit request)', result.status);
    const status = result.status as PushPermissionStatus;
    return {
      status: status === 'granted' || status === 'denied' || status === 'undetermined' ? status : 'unavailable',
      canAskAgain: result.canAskAgain !== false,
    };
  } catch (err) {
    pushDebug('requestPushPermissions failed', err);
    return { status: 'unavailable', canAskAgain: false };
  }
}

export function openDeviceNotificationSettings(): void {
  void Linking.openSettings();
}

/** Foreground pushes: show banner/sound/badge; avoids fully silent receipts when logged out/device locked. */
export async function configurePushPresentation(): Promise<void> {
  try {
    const Notifications = await loadNotificationsModule();
    await ensureAndroidNotificationChannel();
    Notifications.setNotificationHandler({
      handleNotification: async () => {
        if (!isPushDeliveryEnabled()) {
          return {
            shouldShowAlert: false,
            shouldShowBanner: false,
            shouldShowList: false,
            shouldPlaySound: false,
            shouldSetBadge: false,
          };
        }
        return {
          shouldShowAlert: true,
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        };
      },
    });
    if (!notificationResponseListenerAttached) {
      notificationResponseListenerAttached = true;
      Notifications.addNotificationResponseReceivedListener((response) => {
        try {
          const data = response.notification.request.content.data as {
            conversationId?: string;
            link_type?: string;
            link_id?: string;
            event_id?: string;
          };
          const lt = (data?.link_type ?? '').toLowerCase();
          const eventId =
            (typeof data?.event_id === 'string' ? data.event_id.trim() : '') ||
            (lt === 'event' && typeof data?.link_id === 'string' ? data.link_id.trim() : '');
          if (eventId) {
            openEventDetails(eventId);
            return;
          }
          const cid =
            typeof data?.conversationId === 'string'
              ? data.conversationId.trim()
              : typeof data?.link_id === 'string'
                ? data.link_id.trim()
                : '';
          if (
            !cid ||
            !(lt === 'conversation' || lt === 'dm' || lt === 'message' || lt.includes('message'))
          )
            return;
          openCommunityMessageThread(cid);
        } catch {
          /* ignore */
        }
      });
    }
  } catch {
    /* expo-notifications optional */
  }
}

async function registerPushTokenForUser(userId: string): Promise<void> {
  if (!userId || userId.startsWith('demo-')) {
    pushDebug('skip: no user or demo account');
    return;
  }
  if (!isSupabaseConfigured()) {
    pushDebug('skip: Supabase not configured in .env');
    return;
  }
  try {
    const doc = await fetchUserPrefsDoc(userId);
    if (doc.notification_channels?.push === false) {
      pushDebug('skip: push disabled in user prefs');
      setPushDeliveryEnabled(false);
      await unregisterDevicePushToken(userId);
      return;
    }
    setPushDeliveryEnabled(true);

    const Notifications = await loadNotificationsModule();
    await configurePushPresentation();
    let snapshot = await getPushPermissionSnapshot();
    pushDebug('permission (before request)', snapshot.status);
    if (snapshot.status !== 'granted') {
      snapshot = await requestPushPermissions();
    }
    if (snapshot.status !== 'granted') {
      pushDebug(
        'not granted — open Settings → Notifications → The Dalton Grant Academy, or use Enable on Settings → Notifications in the app',
      );
      return;
    }

    const projectId = getEasProjectId();
    if (!projectId) {
      pushDebug('missing EAS projectId in app.config extra.eas.projectId');
      return;
    }

    const token = await fetchExpoPushTokenWithRetry(Notifications, projectId);
    if (!token) {
      pushDebug('getExpoPushTokenAsync returned empty (simulator or missing push entitlement?)');
      return;
    }

    const platform =
      Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
    const saved = await registerDevicePushToken(userId, token, platform);
    pushDebug(saved ? 'token saved to Supabase' : 'token save failed (RLS or device_push_tokens)', {
      platform,
      tokenPrefix: token.slice(0, 24),
    });
  } catch (err) {
    if (isTransientExpoPushTokenError(err)) {
      pushDebug(
        'Expo push token server timed out (exp.host) — try Wi‑Fi, disable VPN, or retry from Settings → Notifications',
        err,
      );
    } else {
      pushDebug(
        'registration failed — rebuild dev client after adding expo-notifications plugin',
        err,
      );
    }
  }
}

/** Register Expo push token + persist to Supabase (dedupes concurrent calls). */
export async function tryRegisterPushToken(userId: string): Promise<void> {
  if (pushTokenRegistrationInFlight) {
    await pushTokenRegistrationInFlight;
    return;
  }
  pushTokenRegistrationInFlight = registerPushTokenForUser(userId);
  try {
    await pushTokenRegistrationInFlight;
  } finally {
    pushTokenRegistrationInFlight = null;
  }
}

/** Defer push registration until navigation transitions finish (iOS is more reliable). */
export function schedulePushRegistration(userId: string): void {
  InteractionManager.runAfterInteractions(() => {
    void tryRegisterPushToken(userId);
  });
}
