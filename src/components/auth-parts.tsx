import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { SocialButton } from '@/components/buttons';
import { Icon } from '@/components/icon';
import { useT } from '@/i18n';
import { useAppTheme } from '@/theme/theme-provider';

export function AuthHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.heading}>
      <AppText variant="title" accessibilityRole="header" style={styles.title}>
        {title}
      </AppText>
      <AppText variant="small" tone="secondary">
        {subtitle}
      </AppText>
    </View>
  );
}

/** Linha com "ou continue com" no meio. */
export function AuthDivider({ label }: { label: string }) {
  const theme = useAppTheme();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.divider}>
      <View style={[styles.line, { backgroundColor: theme.border }]} />
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <View style={[styles.line, { backgroundColor: theme.border }]} />
    </View>
  );
}

/**
 * Google e Apple lado a lado no iPhone; no Android só Google, com o texto inteiro.
 * Ainda "em breve": os dois precisam do app instalado de verdade (e a Apple, da conta de desenvolvedor).
 * `caption` diz, embaixo, que por enquanto é só com e-mail e senha.
 */
/** Entrar com o Google (funciona) e, no iPhone, a Apple ainda como "em breve". */
export function SocialRow({ caption, onGoogle, busy }: { caption: string; onGoogle: () => void; busy?: boolean }) {
  const t = useT();
  const android = Platform.OS === 'android';
  const soon = () => Alert.alert(t('auth.soonTitle'), t('auth.soonBodyApple'));
  const google = () => {
    if (!busy) onGoogle();
  };
  return (
    <View style={styles.socialBlock}>
      {android ? (
        <View style={styles.social}>
          <SocialButton provider="google" label={t('auth.withGoogle')} accessibilityLabel={t('auth.withGoogle')} onPress={google} />
        </View>
      ) : (
        <View style={styles.social}>
          <SocialButton provider="google" label="Google" accessibilityLabel={t('auth.withGoogle')} onPress={google} />
          <SocialButton provider="apple" label={t('auth.appleSoon')} accessibilityLabel={t('auth.withApple')} onPress={soon} />
        </View>
      )}
      <AppText variant="caption" tone="secondary" style={styles.soon}>
        {caption}
      </AppText>
    </View>
  );
}

/** "‹ Voltar" dentro do painel, para os passos de recuperar a senha e confirmar o código. */
export function AuthBackLink({ onPress }: { onPress: () => void }) {
  const theme = useAppTheme();
  const t = useT();
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.back, { opacity: pressed ? 0.6 : 1 }]}>
      <Icon
        name={Platform.OS === 'android' ? 'arrow-left' : 'chevron-left'}
        size={22}
        color={theme.text}
        strokeWidth={2.4}
      />
      <AppText variant="bodyStrong">{t('common.back')}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 4 },
  title: { fontSize: 28, lineHeight: 34 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { flex: 1, height: 1 },
  socialBlock: { gap: 8 },
  social: { flexDirection: 'row', gap: 12 },
  soon: { textAlign: 'center' },
  back: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginLeft: -6,
    marginTop: -12,
  },
});
