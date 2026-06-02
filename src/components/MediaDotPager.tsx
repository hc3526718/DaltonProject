import { StyleSheet, View } from 'react-native';

type Props = {
  count: number;
  activeIndex: number;
};

/** Page dots: active = filled white; inactive = 1px white ring, hollow centre. */
export function MediaDotPager({ count, activeIndex }: Props) {
  if (count <= 1) return null;
  return (
    <View style={styles.row} pointerEvents="none">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: '#ffffff',
  },
  dotInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
});
