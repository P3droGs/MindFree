import { StyleSheet, View } from 'react-native';

import { useT } from '@/i18n';
import { useAppTheme } from '@/theme/theme-provider';

export function ProgressDots({ total, current }: { total: number; current: number }) {
  const theme = useAppTheme();
  const t = useT();

  return (
    <View accessible accessibilityLabel={t('common.stepOf', { current: current + 1, total })} style={styles.row}>
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index === current ? [styles.active, { backgroundColor: theme.accent }] : { backgroundColor: theme.border },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  active: { width: 22 },
});
