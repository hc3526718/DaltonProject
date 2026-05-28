import { Alert, Platform } from 'react-native';

/** Alerts that work on native and in the browser (RN `Alert` is unreliable on web). */
export function authAlert(title: string, message?: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
