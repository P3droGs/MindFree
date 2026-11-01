import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { AuthBackLink, AuthDivider, AuthHeading, SocialRow } from '@/components/auth-parts';
import { BackButton, LinkButton, OutlineButton, PrimaryButton } from '@/components/buttons';
import { Checkbox } from '@/components/checkbox';
import { HeroSheet } from '@/components/hero-sheet';
import { TextField } from '@/components/text-field';
import { useT } from '@/i18n';
import { AUTH_FAILURE_TEXT } from '@/lib/auth-messages';
import { isValidEmail } from '@/lib/validation';
import { useAccount } from '@/state/account';
import { useSettings } from '@/state/settings';

type Mode = 'entrar' | 'recuperar';

/** Entrar numa conta que já existe: no começo ("Já tenho conta") ou depois, por Ajustes. */
export default function SignInScreen() {
  const router = useRouter();
  const t = useT();
  const { height } = useWindowDimensions();
  const { settings, update } = useSettings();
  const { signIn } = useAccount();
  const [mode, setMode] = useState<Mode>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const next = {
      email: isValidEmail(email) ? undefined : t('auth.invalidEmail'),
      password: password ? undefined : t('auth.passwordRequired'),
    };
    setErrors(next);
    if (next.email || next.password) return;
    setBusy(true);
    const { failure, restored } = await signIn(email, password);
    setBusy(false);
    if (failure) {
      setErrors({ form: t(AUTH_FAILURE_TEXT[failure]) });
      return;
    }
    // Veio de Ajustes: volta para lá. No começo: se a conta trouxe os ajustes, já entra no app.
    if (settings.onboarded) router.back();
    else if (restored) router.replace('/');
    else router.push('/horarios');
  };

  const goTo = (next: Mode) => {
    setErrors({});
    setMode(next);
  };

  return (
    // Voltar no topo (em vez da marca, que ficava embaixo do desenho em telas mais baixas).
    <HeroSheet
      heroHeight={Math.round(Math.min(height * 0.36, 330))}
      overlay={
        <BackButton
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          color="#EEF0FF"
          style={styles.heroBack}
        />
      }>
      {mode === 'entrar' ? (
        <>
          <AuthHeading title={t('signin.title')} subtitle={t('signin.sub')} />
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
              placeholder={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
            />
          </View>
          <View style={styles.options}>
            <Checkbox
              label={t('auth.keep')}
              checked={settings.keepSignedIn}
              onChange={(keepSignedIn) => update({ keepSignedIn })}
            />
            <LinkButton label={t('signin.forgot')} onPress={() => goTo('recuperar')} />
          </View>
          {errors.form ? (
            <AppText variant="small" tone="danger" accessibilityLiveRegion="polite">
              {errors.form}
            </AppText>
          ) : null}
          <PrimaryButton label={busy ? t('auth.working') : t('signin.submit')} disabled={busy} onPress={() => void submit()} />
          {/* Google e Apple ainda não funcionam: o "em breve" vem antes, e o texto embaixo diz que é com e-mail. */}
          <AuthDivider label={t('auth.soonDivider')} />
          <SocialRow caption={t('auth.emailOnlySignin')} />
          <View style={styles.footer}>
            <AppText variant="small" tone="secondary">
              {t('signin.noAccount')}
            </AppText>
            <LinkButton label={t('signin.create')} onPress={() => router.push('/criar-conta')} />
          </View>
        </>
      ) : null}

      {mode === 'recuperar' ? (
        <>
          <AuthBackLink onPress={() => goTo('entrar')} />
          <AuthHeading title={t('forgot.title')} subtitle={t('forgot.soon')} />
          <OutlineButton label={t('signin.create')} icon="user-plus" onPress={() => router.push('/criar-conta')} />
        </>
      ) : null}
    </HeroSheet>
  );
}

const styles = StyleSheet.create({
  heroBack: { marginLeft: -8, backgroundColor: 'rgba(16, 20, 46, 0.55)' },
  fields: { gap: 12 },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 8,
    marginTop: -6,
  },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: 6, marginTop: 'auto' },
});
