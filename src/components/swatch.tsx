import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme/theme-provider';

type SwatchProps = {
  /** Uma cor, ou duas para a bolinha dividida (ex.: Clássico, Automático). */
  colors: string[];
  label: string;
  selected: boolean;
  onPress: () => void;
  size?: number;
};

export function Swatch({ colors, label, selected, onPress, size = 32 }: SwatchProps) {
  const theme = useAppTheme();
  const ring = size + 10;

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      hitSlop={4}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={[
        styles.ring,
        { width: ring, height: ring, borderRadius: ring / 2, borderColor: selected ? theme.text : 'transparent' },
      ]}>
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, borderColor: theme.border }]}>
        {colors.map((color, index) => (
          <View key={`${color}-${index}`} style={[styles.part, { backgroundColor: color }]} />
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: { borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  circle: { overflow: 'hidden', flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth },
  part: { flex: 1 },
});
