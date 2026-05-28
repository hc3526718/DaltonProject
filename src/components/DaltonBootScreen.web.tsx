import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DS } from '../designSystem';
import { DaltonBootRiveDisplay } from './DaltonBootRiveDisplay';
import { BouncingBrandLogo } from './BouncingBrandLogo';

/** Web: Rive Cloud embed via iframe (see DaltonBootRiveDisplay.web.tsx). */
export function DaltonBootScreen() {
  const insets = useSafeAreaInsets();
  const [useFallback, setUseFallback] = useState(false);

  const onEmbedError = useCallback(() => setUseFallback(true), []);
  const onNativeError = useCallback(() => setUseFallback(true), []);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {useFallback ? (
        <BouncingBrandLogo size={180} />
      ) : (
        <DaltonBootRiveDisplay
          style={styles.rive}
          onEmbedError={onEmbedError}
          onNativeError={onNativeError}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: DS.color.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rive: {
    width: '100%',
    height: '100%',
    maxWidth: 360,
    maxHeight: 360,
    backgroundColor: DS.color.background,
  },
});
