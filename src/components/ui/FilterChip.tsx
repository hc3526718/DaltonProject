import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { DS } from '../../designSystem';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Media-style filter chip: gold + dark text when selected; grey + white text otherwise. */
export function FilterChip({ label, selected, onPress, style }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipOn, style]}
    >
      <Text style={[styles.text, selected && styles.textOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: DS.color.input,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipOn: {
    backgroundColor: DS.color.gold,
    borderColor: DS.color.gold,
  },
  text: {
    fontFamily: DS.font.bodyMedium,
    fontSize: 13,
    color: DS.color.white,
  },
  textOn: {
    color: DS.color.background,
    fontWeight: '700',
  },
});
