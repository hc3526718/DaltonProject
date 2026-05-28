import 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import * as WebBrowser from 'expo-web-browser';
import { registerRootComponent } from 'expo';
import { initSentryFromEnv } from './src/monitoring/sentryBoot';
import App from './App';

initSentryFromEnv();
void SplashScreen.preventAutoHideAsync().catch(() => {
  /* Expo Go / simulator may reject if splash already hidden */
});
WebBrowser.maybeCompleteAuthSession();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
