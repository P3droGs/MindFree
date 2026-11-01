import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { useT } from '@/i18n';
import { withAlpha } from '@/theme/color';
import { useAppTheme } from '@/theme/theme-provider';
import { fonts } from '@/theme/typography';

type TextFieldProps = Omit<TextInputProps, 'style' | 'secureTextEntry'> & {
  icon: IconName;
  /** Nome do campo, escrito em cima dele ("E-mail", "Senha"). */
  label?: string;
  /** Campo de senha: esconde o texto e mostra o botão do olho. */
  secret?: boolean;
  error?: string;
};

/** Campo com ícone à esquerda; acende na cor do app quando está em uso. */
export function TextField({ icon, label, secret, error, placeholder, onFocus, onBlur, ...rest }: TextFieldProps) {
  const theme = useAppTheme();
  const t = useT();
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const borderColor = error ? theme.danger : focused ? theme.accent : theme.border;

  return (
    <View style={styles.wrapper}>
      {label ? (
        <AppText variant="bodyStrong" importantForAccessibility="no" accessibilityElementsHidden>
          {label}
        </AppText>
      ) : null}
      <View
        style={[
          styles.field,
          {
            backgroundColor: theme.background,
            borderColor,
            boxShadow: focused ? `0px 0px 0px 4px ${withAlpha(theme.accent, 0.18)}` : undefined,
          },
        ]}>
        <Icon name={icon} size={20} color={theme.textSecondary} />
        <TextInput
          {...rest}
          accessibilityLabel={rest.accessibilityLabel ?? label ?? placeholder}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          secureTextEntry={secret && !visible}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[styles.input, { color: theme.text }]}
        />
        {secret ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? t('auth.hidePassword') : t('auth.showPassword')}
            accessibilityState={{ selected: visible }}
            hitSlop={4}
            onPress={() => setVisible((current) => !current)}
            style={styles.eye}>
            <Icon name={visible ? 'eye' : 'eye-off'} size={20} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  field: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingLeft: 16,
    paddingRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  input: { flex: 1, minHeight: 52, fontFamily: fonts.semiBold, fontSize: 17 },
  eye: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
