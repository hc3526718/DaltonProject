import { Alert } from 'react-native';

/** Use for controls that will connect to the backend in a later milestone. */
export function showComingSoon(feature: string): void {
  Alert.alert(
    'Coming soon',
    `${feature} will connect to your live backend once API keys and services are configured. See docs/SECRETS_CHECKLIST.md.`,
  );
}
