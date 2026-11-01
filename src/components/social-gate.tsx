import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/buttons';
import { Icon } from '@/components/icon';
import { OBS, ObservatoryScreen } from '@/components/observatory';
import { useT, type MessageKey } from '@/i18n';
import { isValidHandle, normalizeHandle, SocialError, type SocialFailure } from '@/lib/social';
import { useAccount } from '@/state/account';
import { useSettings } from '@/state/settings';
import { useSocial } from '@/state/social';
import { fonts } from '@/theme/typography';

/**
 * A porta da parte social: sem conta de verdade, convida a criar uma; com conta e sem @, pede o @;
 * pronta, mostra a tela. Também atualiza o perfil (números e pedidos) sempre que a tela abre.
 */
export function SocialGate({ children }: { children: ReactNode }) {
  const { signedIn } = useAccount();
  const { status, refresh } = useSocial();

  useFocusEffect(
    useCallback(() => {
      if (signedIn) void refresh();
    }, [signedIn, refresh]),
  );

  if (!signedIn) return <NeedAccount />;
  if (status === 'ready') return children;
  if (status === 'none') return <ChooseHandle />;
  if (status === 'error') return <Offline onRetry={() => void refresh()} />;
  return (
    <ObservatoryScreen dock={false} contentStyle={styles.centered}>
      <ActivityIndicator size="large" color={OBS.lilac} />
    </ObservatoryScreen>
  );
}

function GateTop() {
  const router = useRouter();
  return (
    <BackButton
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      color={OBS.text}
      style={styles.back}
    />
  );
}

function Planets() {
  return (
    <Svg width={220} height={110} viewBox="0 0 220 110" style={styles.planets}>
      <Ellipse cx={110} cy={70} rx={100} ry={26} fill="none" stroke="#2A3275" strokeDasharray="2 6" />
      <Circle cx={60} cy={66} r={26} fill="#C7B8FF" />
      <Circle cx={160} cy={66} r={26} fill="#FFD27A" />
      <Path d="M96 24 L140 10" stroke="#FFF4D6" strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={140} cy={10} r={3.2} fill="#FFF4D6" />
    </Svg>
  );
}

function ObsButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.primary, { opacity: disabled ? 0.55 : pressed ? 0.85 : 1 }]}>
      <AppText variant="bodyStrong" style={{ color: OBS.ink }}>
        {label}
      </AppText>
    </Pressable>
  );
}

function ObsLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" hitSlop={6} onPress={onPress} style={styles.link}>
      <AppText variant="bodyStrong" style={{ color: OBS.lilacText }}>
        {label}
      </AppText>
    </Pressable>
  );
}

function Privacy({ text }: { text: string }) {
  return (
    <View style={styles.privacy}>
      <Icon name="lock" size={16} color={OBS.faint} />
      <AppText variant="caption" style={[styles.flex, { color: OBS.faint }]}>
        {text}
      </AppText>
    </View>
  );
}

/** Sem conta: a rede precisa de e-mail para os amigos não se perderem ao trocar de celular. */
function NeedAccount() {
  const router = useRouter();
  const t = useT();
  return (
    <ObservatoryScreen dock={false}>
      <GateTop />
      <Planets />
      <View style={styles.intro}>
        <AppText variant="title" accessibilityRole="header" style={{ color: OBS.text }}>
          {t('social.gateTitle')}
        </AppText>
        <AppText variant="small" style={{ color: OBS.soft }}>
          {t('social.gateBody')}
        </AppText>
      </View>
      <View style={styles.actions}>
        <ObsButton label={t('settings.accountCreate')} onPress={() => router.push('/criar-conta')} />
        <ObsLink label={t('settings.accountSignIn')} onPress={() => router.push('/entrar')} />
      </View>
      <Privacy text={t('social.gatePrivacy')} />
    </ObservatoryScreen>
  );
}

const HANDLE_ERROR: Partial<Record<SocialFailure, MessageKey>> = {
  handle_invalid: 'social.handleHint',
  handle_taken: 'social.handleTaken',
  network: 'social.offline',
};

/** Primeira vez na rede: a pessoa escolhe o @ (e, se quiser, o nome que os outros veem). */
function ChooseHandle() {
  const t = useT();
  const { settings, update } = useSettings();
  const { saveHandle } = useSocial();
  const [handle, setHandle] = useState('');
  const [error, setError] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);

  const join = async () => {
    const clean = normalizeHandle(handle);
    if (!isValidHandle(clean)) {
      setError('social.handleHint');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveHandle(clean);
    } catch (failure) {
      setError(HANDLE_ERROR[failure instanceof SocialError ? failure.failure : 'unknown'] ?? 'auth.genericError');
      setBusy(false);
    }
  };

  return (
    <ObservatoryScreen dock={false}>
      <GateTop />
      <View style={styles.intro}>
        <AppText variant="title" accessibilityRole="header" style={{ color: OBS.text }}>
          {t('social.handleTitle')}
        </AppText>
        <AppText variant="small" style={{ color: OBS.soft }}>
          {t('social.handleSub')}
        </AppText>
      </View>

      <View style={styles.field}>
        <AppText variant="bodyStrong" style={{ color: OBS.text }}>
          {t('social.handleLabel')}
        </AppText>
        <View style={[styles.inputRow, error && error !== 'social.offline' && { borderColor: OBS.danger }]}>
          <AppText variant="bodyStrong" style={{ color: OBS.faint }}>
            @
          </AppText>
          <TextInput
            value={handle}
            onChangeText={(value) => {
              setHandle(value.replace(/^@+/, ''));
              setError(null);
            }}
            placeholder={t('social.handlePlaceholder')}
            placeholderTextColor={OBS.faint}
            accessibilityLabel={t('social.handleLabel')}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            maxLength={30}
            returnKeyType="done"
            onSubmitEditing={() => void join()}
            style={styles.input}
          />
        </View>
        <AppText variant="caption" accessibilityLiveRegion="polite" style={{ color: error ? OBS.danger : OBS.faint }}>
          {t(error ?? 'social.handleHint')}
        </AppText>
      </View>

      <View style={styles.field}>
        <AppText variant="bodyStrong" style={{ color: OBS.text }}>
          {t('social.nameLabel')}
        </AppText>
        <View style={styles.inputRow}>
          <TextInput
            value={settings.name}
            onChangeText={(name) => update({ name })}
            placeholder={t('settings.namePlaceholder')}
            placeholderTextColor={OBS.faint}
            accessibilityLabel={t('social.nameLabel')}
            autoCapitalize="words"
            autoComplete="given-name"
            maxLength={60}
            style={styles.input}
          />
        </View>
      </View>

      <Privacy text={t('social.handlePrivacy')} />
      <ObsButton label={busy ? t('auth.working') : t('social.join')} disabled={busy} onPress={() => void join()} />
    </ObservatoryScreen>
  );
}

function Offline({ onRetry }: { onRetry: () => void }) {
  const t = useT();
  return (
    <ObservatoryScreen dock={false}>
      <GateTop />
      <View style={styles.intro}>
        <AppText variant="heading" accessibilityRole="header" style={{ color: OBS.text }}>
          {t('social.offline')}
        </AppText>
      </View>
      <ObsButton label={t('social.retry')} onPress={onRetry} />
    </ObservatoryScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  back: { marginLeft: -10 },
  planets: { alignSelf: 'center' },
  intro: { gap: 8 },
  actions: { gap: 6 },
  primary: {
    minHeight: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: OBS.lilac,
  },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  privacy: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  field: { gap: 8 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: OBS.cardBorder,
    backgroundColor: OBS.card,
  },
  input: { flex: 1, minHeight: 52, color: OBS.text, fontFamily: fonts.semiBold, fontSize: 17 },
});
