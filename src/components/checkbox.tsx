import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { useAppTheme } from '@/theme/theme-provider';

/** Caixa de marcar: redonda no iPhone e quadrada de cantos suaves no Android. */
export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const theme = useAppTheme();
  const android = Platform.OS === 'android';

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      hitSlop={4}
      onPress={() => {
        void Haptics.selectionAsync();
        onChange(!checked);
      }}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
      <View
        style={[
          styles.box,
          android ? styles.square : styles.round,
          checked ? { backgroundColor: theme.accent } : { borderWidth: 2, borderColor: theme.textSecondary },
        ]}>
        {checked ? <Icon name="check" size={13} color={theme.onAccent} strokeWidth={3.6} /> : null}
      </View>
      <AppText variant="small" tone="secondary">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  box: { alignItems: 'center', justifyContent: 'center' },
  round: { width: 22, height: 22, borderRadius: 11 },
  square: { width: 20, height: 20, borderRadius: 5 },
});
