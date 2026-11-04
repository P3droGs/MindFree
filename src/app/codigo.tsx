import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { AuthBackLink, AuthHeading } from '@/components/auth-parts';
import { BackButton, LinkButton, PrimaryButton } from '@/components/buttons';
import { CodeInput } from '@/components/code-input';
import { HeroSheet } from '@/components/hero-sheet';
import { TextField } from '@/components/text-field';
import { useT } from '@/i18n';
import { AUTH_FAILURE_TEXT } from '@/lib/auth-messages';
import { useAccount } from '@/state/account';
import { useSettings } from '@/state/settings';

/** As telas do caminho de entrar/criar conta, que saem todas juntas quando a conta fica pronta. */
const AUTH_ROUTES = new Set(['entrar', 'criar-conta', 'codigo']);

/**
 * O código de 6 números que chega por e-mail, em dois usos:
 * - `kind=recovery`: "Esqueci a senha". Depois do código, a pessoa escolhe a senha nova e já entra.
 * - `kind=signup`: confirmar o e-mail da conta recém-criada. Depois do código, a conta fica ativa e entra.
 * O e-mail vem pelo parâmetro só para mostrar na tela e reenviar: quem decide o que vale é o servidor.
 */
export default function CodeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const t = useT();
  const { height } = useWindowDimensions();
  const { settings } = useSettings();
  const { verifyCode, resendCode, setNewPassword } = useAccount();
  const params = useLocalSearchParams<{ kind?: string; email?: string }>();
  const kind = params.kind === 'signup' ? 'signup' : 'recovery';
  const email = params.email ?? '';
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'code' | 'password'>('code');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Fecha Entrar, Criar conta e esta tela de uma vez (ou segue para os horários, no primeiro uso). */
  const finish = () => {
    if (settings.onboarded) {
      const routes = navigation.getState()?.routes ?? [];
      let authScreens = 0;
      while (authScreens < routes.length && AUTH_ROUTES.has(routes[routes.length - 1 - authScreens].name)) authScreens += 1;
      router.dismiss(Math.max(authScreens, 1));
    } else router.replace('/horarios');
  };

  const verify = async () => {
    if (code.length < 6) {
      setError(t('code.incomplete'));
      return;
    }
    setBusy(true);
    setError(null);
    const failure = await verifyCode(email, code, kind);
    setBusy(false);
    if (failure) {
      setError(t(AUTH_FAILURE_TEXT[failure]));
      return;
    }
    if (kind === 'recovery') setStep('password');
    else finish();
  };

  const savePassword = async () => {
    if (password.length < 8) {
      setError(t('auth.passwordShort'));
      return;
    }
    setBusy(true);
    setError(null);
    const failure = await setNewPassword(password);
    setBusy(false);
    if (failure) {
      setError(t(AUTH_FAILURE_TEXT[failure]));
      return;
    }
    finish();
  };

  const resend = async () => {
    setBusy(true);
    setError(null);
    const failure = await resendCode(email, kind);
    setBusy(false);
    if (failure) setError(t(AUTH_FAILURE_TEXT[failure]));
    else setNotice(t('code.resent'));
  };

  return (
    <HeroSheet
      heroHeight={Math.round(Math.min(height * 0.28, 260))}
      overlay={<BackButton onPress={() => router.back()} color="#EEF0FF" style={styles.heroBack} />}>
      {step === 'code' ? (
        <>
          <AuthBackLink onPress={() => router.back()} />
          <AuthHeading
            title={kind === 'signup' ? t('signup.confirmTitle') : t('code.title')}
            subtitle={kind === 'signup' ? t('signup.confirmSub') : t('code.sub')}
          />
          <AppText variant="small" tone="secondary">
            {t('code.sentTo', { email })}
          </AppText>
          <CodeInput value={code} onChange={(value) => { setCode(value); setError(null); }} />
          {error ? (
            <AppText variant="small" tone="danger" accessibilityLiveRegion="polite">
              {error}
            </AppText>
          ) : null}
          {notice ? (
            <AppText variant="small" tone="secondary" accessibilityLiveRegion="polite">
              {notice}
            </AppText>
          ) : null}
          <PrimaryButton
            label={busy ? t('auth.working') : kind === 'signup' ? t('signup.confirm') : t('code.continue')}
            disabled={busy}
            onPress={() => void verify()}
          />
          <LinkButton label={t('code.resend')} align="center" onPress={() => void resend()} />
        </>
      ) : (
        <>
          <AuthHeading title={t('code.newTitle')} subtitle={t('code.newSub')} />
          <View style={styles.fields}>
            <TextField
              icon="lock"
              secret
              label={t('auth.passwordLabel')}
              placeholder={t('code.newPassword')}
              value={password}
              onChangeText={(value) => { setPassword(value); setError(null); }}
              error={error ?? undefined}
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="done"
              onSubmitEditing={() => void savePassword()}
            />
          </View>
          <PrimaryButton label={busy ? t('auth.working') : t('code.saveEnter')} disabled={busy} onPress={() => void savePassword()} />
        </>
      )}
    </HeroSheet>
  );
}

const styles = StyleSheet.create({
  heroBack: { marginLeft: -8, backgroundColor: 'rgba(16, 20, 46, 0.55)' },
  fields: { gap: 12 },
});
