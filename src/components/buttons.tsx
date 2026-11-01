import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { AppleLogo, GoogleLogo } from '@/components/brand-logos';
import { Icon, type IconName } from '@/components/icon';
import { useT } from '@/i18n';
import { useAppTheme } from '@/theme/theme-provider';

type ButtonProps = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
};

export function PrimaryButton({ label, onPress, icon, disabled, large }: ButtonProps & { large?: boolean }) {
  const theme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        large && styles.large,
        {
          backgroundColor: theme.accent,
          experimental_backgroundImage: theme.accentGradient,
          boxShadow: disabled ? undefined : theme.accentGlow,
          opacity: disabled ? 0.55 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}>
      {icon ? <Icon name={icon} size={large ? 26 : 22} color={theme.onAccent} strokeWidth={2.3} /> : null}
      <AppText variant="button" tone="onAccent" style={large && styles.largeLabel}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function OutlineButton({ label, onPress, icon, disabled }: ButtonProps) {
  const theme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles.outline,
        { borderColor: theme.accent, opacity: disabled ? 0.55 : pressed ? 0.75 : 1 },
      ]}>
      {icon ? <Icon name={icon} size={20} color={theme.text} strokeWidth={2.2} /> : null}
      <AppText variant="button" style={styles.smallLabel}>
        {label}
      </AppText>
    </Pressable>
  );
}

/**
 * Entrar com Google ou Apple: branco no escuro, quase preto no claro (como pedem as duas marcas).
 * `label` é o texto visível; `accessibilityLabel` diz a ação inteira ("Continuar com Google").
 */
export function SocialButton({
  provider,
  label,
  accessibilityLabel,
  onPress,
}: {
  provider: 'apple' | 'google';
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const background = theme.dark ? '#FFFFFF' : '#16130F';
  const foreground = theme.dark ? '#10142E' : '#FFFFFF';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.social,
        { backgroundColor: background, boxShadow: theme.cardShadow, opacity: pressed ? 0.85 : 1 },
      ]}>
      {provider === 'apple' ? <AppleLogo size={19} color={foreground} /> : <GoogleLogo size={18} />}
      <AppText variant="bodyStrong" style={{ color: foreground }}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function LinkButton({
  label,
  onPress,
  tone = 'accent',
  align = 'start',
}: {
  label: string;
  onPress: () => void;
  tone?: 'accent' | 'danger' | 'primary';
  align?: 'start' | 'center';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.link, align === 'center' && styles.linkCenter, { opacity: pressed ? 0.6 : 1 }]}>
      <AppText variant="bodyStrong" tone={tone}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  style,
  color,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  color?: string;
}) {
  const theme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.icon, { opacity: pressed ? 0.6 : 1 }, style]}>
      <Icon name={icon} size={26} color={color ?? theme.text} strokeWidth={2.2} />
    </Pressable>
  );
}

/** Voltar: seta "←" no Android e "‹" no iPhone, como cada sistema costuma mostrar. */
export function BackButton({
  onPress,
  style,
  color,
}: {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  color?: string;
}) {
  const t = useT();
  return (
    <IconButton
      icon={Platform.OS === 'android' ? 'arrow-left' : 'chevron-left'}
      label={t('common.back')}
      onPress={onPress}
      style={style}
      color={color}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  large: { minHeight: 64 },
  largeLabel: { fontSize: 19 },
  outline: { borderWidth: 2 },
  smallLabel: { fontSize: 17 },
  social: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  linkCenter: { alignSelf: 'center' },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
