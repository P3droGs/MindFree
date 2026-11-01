import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { useT } from '@/i18n';
import { formatMinutes, MINUTES_PER_DAY } from '@/lib/time';
import { useAppTheme } from '@/theme/theme-provider';

const STEP_MINUTES = 15;

type TimeStepperProps = {
  label: string;
  minutes: number;
  onChange: (minutes: number) => void;
  size?: 'large' | 'compact';
};

export function TimeStepper({ label, minutes, onChange, size = 'large' }: TimeStepperProps) {
  const theme = useAppTheme();
  const t = useT();
  const large = size === 'large';
  const buttonStyle = [styles.button, large && styles.buttonLarge, { backgroundColor: theme.raised }];

  const shift = (delta: number) => {
    void Haptics.selectionAsync();
    onChange((minutes + delta + MINUTES_PER_DAY) % MINUTES_PER_DAY);
  };

  return (
    <View style={[styles.row, large && styles.rowLarge]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('time.earlier', { label, n: STEP_MINUTES })}
        hitSlop={4}
        onPress={() => shift(-STEP_MINUTES)}
        style={buttonStyle}>
        <Icon name="minus" size={20} color={theme.text} strokeWidth={2.6} />
      </Pressable>
      <AppText
        variant={large ? 'time' : 'timeSmall'}
        accessibilityLiveRegion="polite"
        style={!large && styles.compactValue}>
        {formatMinutes(minutes)}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('time.later', { label, n: STEP_MINUTES })}
        hitSlop={4}
        onPress={() => shift(STEP_MINUTES)}
        style={buttonStyle}>
        <Icon name="plus" size={20} color={theme.text} strokeWidth={2.6} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowLarge: { justifyContent: 'space-between' },
  button: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  buttonLarge: { width: 48, height: 48, borderRadius: 24 },
  compactValue: { width: 64, textAlign: 'center' },
});
