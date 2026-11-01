import { useRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useT } from '@/i18n';
import { withAlpha } from '@/theme/color';
import { useAppTheme } from '@/theme/theme-provider';

const LENGTH = 6;

/**
 * Código de 6 números em quadradinhos. Por trás há um único campo, então colar o código
 * ou usar o preenchimento automático do e-mail/SMS funciona de uma vez.
 */
export function CodeInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const theme = useAppTheme();
  const t = useT();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);
  const digits = value.split('');

  return (
    <Pressable accessible={false} onPress={() => input.current?.focus()} style={styles.row}>
      {Array.from({ length: LENGTH }, (_, index) => {
        const active = focused && index === Math.min(value.length, LENGTH - 1);
        return (
          <View
            key={index}
            style={[
              styles.box,
              {
                backgroundColor: theme.background,
                borderColor: active ? theme.accent : theme.border,
                boxShadow: active ? `0px 0px 0px 4px ${withAlpha(theme.accent, 0.18)}` : undefined,
              },
            ]}>
            <AppText variant="timeSmall">{digits[index] ?? ''}</AppText>
          </View>
        );
      })}
      <TextInput
        ref={input}
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, LENGTH))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={t('code.group')}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        maxLength={LENGTH}
        caretHidden
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  box: { flex: 1, height: 58, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  hidden: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02, color: 'transparent' },
});
