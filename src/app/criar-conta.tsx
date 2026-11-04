import { useNavigation, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { AuthDivider, AuthHeading, SocialRow } from '@/components/auth-parts';
import { BackButton, LinkButton, PrimaryButton } from '@/components/buttons';
import { Checkbox } from '@/components/checkbox';
import { HeroSheet } from '@/components/hero-sheet';
import { TextField } from '@/components/text-field';
import { useT, type MessageKey } from '@/i18n';
import { AUTH_FAILURE_TEXT } from '@/lib/auth-messages';
import { isValidEmail, passwordStrength } from '@/lib/validation';
import { useAccount } from '@/state/account';
import { useSettings } from '@/state/settings';
import { useAppTheme } from '@/theme/theme-provider';

const STRENGTH_TEXT: MessageKey[] = ['signup.strength0', 'signup.strength1', 'signup.strength2', 'signup.strength3'];
/** As telas do caminho de entrar/criar conta, que saem todas juntas quando a conta fica pronta. */
const AUTH_ROUTES = new Set(['entrar', 'criar-conta']);

/**
 * Criar conta com e-mail e senha. O que a pessoa já fez neste celular vai junto para a nuvem.
 * Nesta fase de testes não há e-mail de confirmação (o envio de e-mails entra depois).
 */
export default function SignUpScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const theme = useAppTheme();
  const t = useT();
  const { height } = useWindowDimensions();
  const { settings, update } = useSettings();
  const { signUp } = useAccount();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  // Idade mínima e aceite dos termos e da política: uma caixa só, obrigatória, sem guardar nada além da conta.
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const strength = passwordStrength(password);
  const barColors = ['', theme.danger, '#FFC857', '#7FDBB6'];

  const createAccount = async () => {
    const next = {
      email: isValidEmail(email) ? undefined : t('auth.invalidEmail'),
      password: password.length >= 8 ? undefined : t('auth.passwordShort'),
    };
    setErrors({ ...next, form: agreed ? undefined : t('signup.ageRequired') });
    if (next.email || next.password || !agreed) return;
    setBusy(true);
    const failure = await signUp(email, password);
    setBusy(false);
    if (failure === 'confirm') {
      // A conta existe, mas só fica ativa com o código que foi para o e-mail.
      router.push({ pathname: '/codigo', params: { kind: 'signup', email: email.trim() } });
      return;
    }
    if (failure) {
      setErrors({ form: t(AUTH_FAILURE_TEXT[failure]) });
      return;
    }
    // Já usava o app (veio de Ajustes ou da rede): fecha Entrar e Criar conta e volta para onde estava.
    // No começo: segue para os horários (nome e cores ficam em Ajustes).
    if (settings.onboarded) {
      const routes = navigation.getState()?.routes ?? [];
      let authScreens = 0;
      while (authScreens < routes.length && AUTH_ROUTES.has(routes[routes.length - 1 - authScreens].name)) authScreens += 1;
      router.dismiss(Math.max(authScreens, 1));
    } else router.push('/horarios');
  };

  return (
    <HeroSheet
      heroHeight={Math.round(Math.min(height * 0.28, 260))}
      overlay={<BackButton onPress={() => router.back()} color="#EEF0FF" style={styles.heroBack} />}>
      <AuthHeading title={t('signup.title')} subtitle={t('signup.sub')} />
      <View style={styles.fields}>
        <TextField
          icon="mail"
          label={t('auth.emailLabel')}
          placeholder={t('auth.emailExample')}
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
        />
        <TextField
          icon="lock"
          secret
          label={t('auth.passwordLabel')}
          placeholder={t('signup.password')}
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={() => void createAccount()}
        />
        <View style={styles.strength}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.bars}>
            {[1, 2, 3].map((level) => (
              <View
                key={level}
                style={[styles.bar, { backgroundColor: strength >= level ? barColors[strength] : theme.border }]}
              />
            ))}
          </View>
          <AppText variant="caption" tone="secondary" accessibilityLiveRegion="polite">
            {t(STRENGTH_TEXT[strength])}
          </AppText>
        </View>
      </View>
      <View style={styles.keep}>
        <Checkbox
          label={t('auth.keep')}
          checked={settings.keepSignedIn}
          onChange={(keepSignedIn) => update({ keepSignedIn })}
        />
        <Checkbox label={t('signup.age')} checked={agreed} onChange={setAgreed} />
      </View>
      {errors.form ? (
        <AppText variant="small" tone="danger" accessibilityLiveRegion="polite">
          {errors.form}
        </AppText>
      ) : null}
      <PrimaryButton label={busy ? t('auth.working') : t('signup.submit')} disabled={busy} onPress={() => void createAccount()} />
      <AuthDivider label={t('auth.soonDivider')} />
      <SocialRow caption={t('auth.emailOnlySignup')} />
      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <AppText variant="small" tone="secondary">
            {t('signup.haveAccount')}
          </AppText>
          <LinkButton label={t('signup.signin')} onPress={() => router.dismissTo('/entrar')} />
        </View>
        <AppText variant="caption" tone="secondary" style={styles.center}>
          {t('signup.terms')}
        </AppText>
        <View style={styles.footerRow}>
          <LinkButton label={t('signup.readTerms')} onPress={() => router.push('/termos')} />
          <LinkButton label={t('consent.policy')} onPress={() => router.push('/privacidade')} />
        </View>
      </View>
    </HeroSheet>
  );
}

const styles = StyleSheet.create({
  heroBack: { marginLeft: -8, backgroundColor: 'rgba(16, 20, 46, 0.55)' },
  fields: { gap: 12 },
  strength: { gap: 6, paddingHorizontal: 4 },
  bars: { flexDirection: 'row', gap: 6 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  keep: { marginTop: -8 },
  footer: { marginTop: 'auto', gap: 2, alignItems: 'center' },
  footerRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: 6 },
  center: { textAlign: 'center' },
});
