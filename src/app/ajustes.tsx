import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { AccentPicker } from '@/components/accent-picker';
import { AppText } from '@/components/app-text';
import { BackgroundPicker } from '@/components/background-picker';
import { BackButton, LinkButton, OutlineButton } from '@/components/buttons';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { LanguageSheet } from '@/components/language-sheet';
import { Screen } from '@/components/screen';
import { Segmented } from '@/components/segmented';
import { TimeStepper } from '@/components/time-stepper';
import { useI18n, type MessageKey } from '@/i18n';
import { aiAllowed } from '@/lib/consent';
import { deleteAllMedia, deleteLocalFile } from '@/lib/files';
import {
  cancelDailyReminders,
  hasExactAlarms,
  hasNotificationPermission,
  requestExactAlarms,
  requestNotificationPermission,
  scheduleDailyReminders,
} from '@/lib/notifications';
import { serverConfigured } from '@/lib/supabase';
import { formatMinutes } from '@/lib/time';
import { useAccount, type SyncStatus } from '@/state/account';
import { useJournal } from '@/state/journal-provider';
import { changePosts, deletePhoto, usePosts } from '@/state/posts';
import { useSettings, type Settings } from '@/state/settings';
import { useSocial } from '@/state/social';
import { useAppTheme } from '@/theme/theme-provider';
import { fonts } from '@/theme/typography';

/** Os avisos dos amigos (push), cada um com o seu botão. */
const PUSH_KINDS: { key: keyof Pick<Settings, 'pushShine' | 'pushPoke' | 'pushMural' | 'pushRequests'>; label: MessageKey }[] = [
  { key: 'pushShine', label: 'push.shine' },
  { key: 'pushPoke', label: 'push.poke' },
  { key: 'pushMural', label: 'push.mural' },
  { key: 'pushRequests', label: 'push.requests' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { language, t } = useI18n();
  const { settings, update, reset } = useSettings();
  const { journal, change } = useJournal();
  const posts = usePosts();
  const aiOn = aiAllowed(settings);
  const { account, signedIn, syncStatus, clockWrong, signOut, deleteAccount } = useAccount();
  const { status: socialStatus } = useSocial();
  const { nightMinutes, morningMinutes } = settings;
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [notificationsOn, setNotificationsOn] = useState<boolean | null>(null);
  const [exactOn, setExactOn] = useState(true);
  const [languagesOpen, setLanguagesOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      hasNotificationPermission()
        .then(setNotificationsOn)
        .catch(() => setNotificationsOn(false));
      hasExactAlarms()
        .then(setExactOn)
        .catch(() => setExactOn(true));
    }, []),
  );

  // Reagenda os avisos quando os horários ou o idioma mudam (com atraso, para não agendar a cada toque).
  useEffect(() => {
    if (!notificationsOn) return;
    const timeout = setTimeout(() => {
      scheduleDailyReminders(nightMinutes, morningMinutes, t).catch(() => undefined);
    }, 800);
    return () => clearTimeout(timeout);
  }, [notificationsOn, nightMinutes, morningMinutes, t]);

  // Na volta do ajuste do Android, o app reagenda tudo como alarme exato (useExactAlarmRefresh).
  const enableExactAlarms = async () => setExactOn(await requestExactAlarms());

  const enableNotifications = async () => {
    const allowed = await requestNotificationPermission(t);
    setNotificationsOn(allowed);
    if (!allowed) {
      Alert.alert(t('settings.deniedTitle'), t('settings.deniedBody'), [
        { text: t('settings.notNow'), style: 'cancel' },
        { text: t('settings.openSettings'), onPress: () => Linking.openSettings() },
      ]);
    }
  };

  // Ligar a IA sempre passa pela tela do consentimento; desligar é na hora (pela LGPD, retirar tem que ser fácil).
  const toggleAi = (on: boolean) => {
    if (on) router.push({ pathname: '/consentimento', params: { next: 'voltar' } });
    else update({ aiConsent: 'declined', aiConsentAt: Date.now() });
  };

  const confirmSignOut = () => {
    const leave = async (force: boolean) => {
      const result = await signOut(force);
      if (result === 'unsynced') {
        Alert.alert(t('settings.signOutTitle'), t('settings.signOutUnsynced'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('settings.signOutConfirm'), style: 'destructive', onPress: () => void leave(true) },
        ]);
      }
    };
    Alert.alert(t('settings.signOutTitle'), t('settings.signOutBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.signOutConfirm'), style: 'destructive', onPress: () => void leave(false) },
    ]);
  };

  /** Apaga do celular tudo o que o MindFree guardou (e a conta, se tiver) e volta para o começo. */
  const deleteAll = () => {
    Alert.alert(t('settings.deleteAllTitle'), signedIn ? t('settings.deleteAllBodyAccount') : t('settings.deleteAllBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.deleteAllConfirm'),
        style: 'destructive',
        onPress: async () => {
          // Primeiro a conta no servidor: se não der (sem internet), nada é apagado.
          if (signedIn && !(await deleteAccount())) {
            Alert.alert(t('settings.deleteAllTitle'), t('settings.deleteAllFailed'));
            return;
          }
          for (const night of journal.nights) if (night.audioUri) deleteLocalFile(night.audioUri);
          for (const post of posts) deletePhoto(post.photoUri);
          deleteAllMedia();
          changePosts(() => []);
          // Sem tarefas, os lembretes de cada uma são cancelados e os widgets ficam vazios.
          change(() => ({ tasks: [], nights: [] }));
          cancelDailyReminders().catch(() => undefined);
          reset();
        },
      },
    ]);
  };

  return (
    <Screen scrollEnabled={scrollEnabled}>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} style={styles.back} />
        <AppText variant="title" accessibilityRole="header">
          {t('settings.title')}
        </AppText>
      </View>

      {serverConfigured ? (
        <Section title={t('settings.account')}>
          <Card>
            {signedIn ? (
              <>
                <View style={styles.accountRow}>
                  <View style={[styles.accountBadge, { backgroundColor: theme.raised }]}>
                    <AppText variant="bodyStrong" tone="accent">
                      {(account?.email?.[0] ?? '?').toLocaleUpperCase()}
                    </AppText>
                  </View>
                  <View style={styles.accountText}>
                    <AppText variant="bodyStrong" numberOfLines={1}>
                      {account?.email}
                    </AppText>
                    <AppText variant="small" tone="secondary" accessibilityLiveRegion="polite">
                      {t(SYNC_TEXT[syncStatus])}
                    </AppText>
                  </View>
                </View>
                {clockWrong ? (
                  <AppText variant="small" tone="danger" accessibilityLiveRegion="polite">
                    {t('settings.clockWrong')}
                  </AppText>
                ) : null}
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <LinkButton label={t('settings.signOut')} tone="primary" onPress={confirmSignOut} />
              </>
            ) : (
              <>
                <AppText variant="small" tone="secondary">
                  {t('settings.accountNone')}
                </AppText>
                <OutlineButton label={t('settings.accountCreate')} icon="user-plus" onPress={() => router.push('/criar-conta')} />
                <LinkButton label={t('settings.accountSignIn')} align="center" onPress={() => router.push('/entrar')} />
              </>
            )}
          </Card>
        </Section>
      ) : null}

      <Section title={t('settings.appearance')}>
        <Card style={styles.appearance}>
          <AppText variant="bodyStrong">{t('settings.color')}</AppText>
          <AccentPicker onSlidingChange={(sliding) => setScrollEnabled(!sliding)} />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <AppText variant="bodyStrong">{t('settings.background')}</AppText>
          <BackgroundPicker onSlidingChange={(sliding) => setScrollEnabled(!sliding)} />
        </Card>
      </Section>

      <Section title={t('settings.times')}>
        <Card>
          <View style={styles.timeRow}>
            <AppText variant="bodyStrong" style={styles.timeLabel}>
              {t('schedule.night')}
            </AppText>
            <TimeStepper
              size="compact"
              label={t('schedule.night')}
              minutes={nightMinutes}
              onChange={(value) => update({ nightMinutes: value })}
            />
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.timeRow}>
            <AppText variant="bodyStrong" style={styles.timeLabel}>
              {t('schedule.morning')}
            </AppText>
            <TimeStepper
              size="compact"
              label={t('schedule.morning')}
              minutes={morningMinutes}
              onChange={(value) => update({ morningMinutes: value })}
            />
          </View>
        </Card>
      </Section>

      <Section title={t('settings.notifications')}>
        <Card>
          {notificationsOn === false ? (
            <>
              <AppText variant="small" tone="secondary">
                {t('settings.notifOff')}
              </AppText>
              <OutlineButton label={t('settings.notifEnable')} icon="bell" onPress={enableNotifications} />
            </>
          ) : (
            <AppText variant="small" tone="secondary">
              {notificationsOn
                ? t('settings.notifOn', { night: formatMinutes(nightMinutes), morning: formatMinutes(morningMinutes) })
                : t('settings.checking')}
            </AppText>
          )}
          {notificationsOn && !exactOn ? (
            <>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <AppText variant="small" tone="secondary">
                {t('exact.settingsOff')}
              </AppText>
              <OutlineButton label={t('exact.allow')} icon="bell" onPress={() => void enableExactAlarms()} />
            </>
          ) : null}
          {/* Os avisos dos amigos só existem para quem entrou na rede (tem @). */}
          {socialStatus === 'ready' ? (
            <>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <View style={styles.aiText}>
                <AppText variant="bodyStrong">{t('push.title')}</AppText>
                <AppText variant="small" tone="secondary">
                  {t('push.hint', { night: formatMinutes(nightMinutes), morning: formatMinutes(morningMinutes) })}
                </AppText>
              </View>
              {PUSH_KINDS.map(({ key, label }) => (
                <View key={key} style={styles.aiRow}>
                  <AppText variant="body" style={styles.aiText}>
                    {t(label)}
                  </AppText>
                  <Switch
                    value={settings[key]}
                    onValueChange={(value) => update({ [key]: value })}
                    accessibilityLabel={t(label)}
                    trackColor={{ true: theme.accent, false: theme.raised }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              ))}
            </>
          ) : null}
        </Card>
      </Section>

      <Section title={t('settings.general')}>
        <Card>
          {/* O nome da saudação ("Boa noite, Ana!"). Fica só aqui: o primeiro uso não pergunta mais. */}
          <View style={styles.nameField}>
            <AppText variant="bodyStrong">
              {t('settings.nameQuestion')}{' '}
              <AppText variant="bodyStrong" tone="secondary">
                {t('common.optional')}
              </AppText>
            </AppText>
            <TextInput
              accessibilityLabel={`${t('settings.nameQuestion')} ${t('common.optional')}`}
              value={settings.name}
              onChangeText={(name) => update({ name })}
              placeholder={t('settings.namePlaceholder')}
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="words"
              autoComplete="given-name"
              textContentType="givenName"
              returnKeyType="done"
              style={[styles.nameInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
            />
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('lang.button', {
              name: settings.language === 'device' ? t('lang.device') : language.native,
            })}
            onPress={() => setLanguagesOpen(true)}
            style={({ pressed }) => [styles.languageRow, { opacity: pressed ? 0.7 : 1 }]}>
            <Icon name="globe" size={20} color={theme.text} />
            {/* Com fonte grande, quem quebra a linha é o nome do idioma, nunca a palavra "Idioma". */}
            <AppText variant="bodyStrong" style={styles.languageName}>
              {t('lang.label')}
            </AppText>
            <AppText variant="small" tone="secondary" style={styles.languageValue}>
              {settings.language === 'device' ? t('lang.device') : language.native}
            </AppText>
            <Icon name="chevron-right" size={18} color={theme.textSecondary} strokeWidth={2.4} />
          </Pressable>
        </Card>
      </Section>

      <Section title={t('settings.privacy')}>
        <Card>
          <View style={styles.aiRow}>
            <View style={styles.aiText}>
              <AppText variant="bodyStrong">{t('settings.aiTitle')}</AppText>
              <AppText variant="small" tone="secondary">
                {aiOn ? t('settings.aiOn') : t('settings.aiOff')}
              </AppText>
            </View>
            <Switch
              value={aiOn}
              onValueChange={toggleAi}
              accessibilityLabel={t('settings.aiTitle')}
              trackColor={{ true: theme.accent, false: theme.raised }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/privacidade')}
            style={({ pressed }) => [styles.languageRow, { opacity: pressed ? 0.7 : 1 }]}>
            <Icon name="lock" size={20} color={theme.text} />
            <AppText variant="bodyStrong" style={styles.languageLabel}>
              {t('settings.privacyPolicy')}
            </AppText>
            <Icon name="chevron-right" size={18} color={theme.textSecondary} strokeWidth={2.4} />
          </Pressable>
          {signedIn ? (
            <>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/bloqueados')}
                style={({ pressed }) => [styles.languageRow, { opacity: pressed ? 0.7 : 1 }]}>
                <Icon name="eye-off" size={20} color={theme.text} />
                <AppText variant="bodyStrong" style={styles.languageLabel}>
                  {t('safety.blockedTitle')}
                </AppText>
                <Icon name="chevron-right" size={18} color={theme.textSecondary} strokeWidth={2.4} />
              </Pressable>
            </>
          ) : null}
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <LinkButton label={t('settings.deleteAll')} tone="danger" onPress={deleteAll} />
        </Card>
      </Section>

      {/* Só para testar: não aparece no app publicado, por isso os textos não são traduzidos. */}
      {__DEV__ ? (
        <Section title="Teste (só no desenvolvimento)">
          <Card>
            <AppText variant="bodyStrong">Ver como fica</AppText>
            <Segmented
              options={[
                { value: 'real', label: 'Agora' },
                { value: 'noite', label: 'À noite' },
                { value: 'manha', label: 'Manhã' },
              ]}
              value={settings.testClock}
              onChange={(testClock) => update({ testClock })}
            />
            <AppText variant="caption" tone="secondary">
              {settings.testClock === 'real'
                ? 'O app segue o relógio do celular.'
                : settings.testClock === 'noite'
                  ? 'O app finge que são 23:00 de hoje. Grave ou escreva e depois troque para Manhã.'
                  : 'O app finge que é a manhã de amanhã, com o resumo da noite.'}
            </AppText>
          </Card>
        </Section>
      ) : null}

      <AppText variant="caption" tone="secondary" style={styles.center}>
        {t('settings.version', { version: Constants.expoConfig?.version ?? '?' })}
      </AppText>

      <LanguageSheet visible={languagesOpen} onClose={() => setLanguagesOpen(false)} />
    </Screen>
  );
}

const SYNC_TEXT: Record<SyncStatus, 'settings.syncDone' | 'settings.syncing' | 'settings.syncOffline'> = {
  off: 'settings.syncDone',
  syncing: 'settings.syncing',
  synced: 'settings.syncDone',
  offline: 'settings.syncOffline',
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="label" tone="secondary" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4 },
  back: { marginLeft: -10 },
  section: { gap: 8 },
  appearance: { gap: 12 },
  divider: { height: 1, marginVertical: 2 },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  timeLabel: { flex: 1 },
  nameField: { gap: 8 },
  nameInput: { height: 52, borderRadius: 16, borderWidth: 1, paddingHorizontal: 18, fontFamily: fonts.semiBold, fontSize: 17 },
  languageRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  languageLabel: { flex: 1 },
  languageName: { flexGrow: 1, flexShrink: 0 },
  languageValue: { flexShrink: 1, textAlign: 'right' },
  aiRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  accountBadge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  accountText: { flex: 1, gap: 2 },
  aiText: { flex: 1, gap: 2 },
  center: { textAlign: 'center' },
});
