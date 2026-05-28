import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { DS } from '../designSystem';
import { webPageShellStyle } from '../layout/webLayout';

/** Web shell: full viewport width; child screens use flex for responsive layout. */
export function WebAppFrame({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }
  return (
    <View style={styles.outer}>
      <View style={[styles.inner, webPageShellStyle()]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    width: '100%',
    backgroundColor: DS.color.background,
  },
  inner: {
    flex: 1,
    width: '100%',
  },
});
