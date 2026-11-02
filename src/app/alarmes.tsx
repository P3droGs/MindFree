import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BackButton, LinkButton, PrimaryButton } from '@/components/buttons';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { ProgressDots } from '@/components/progress-dots';
import { Screen, Spacer } from '@/components/screen';
import { useT } from '@/i18n';
import { requestExactAlarms, scheduleDailyReminders } from '@/lib/notifications';
import { useSettings } from '@/state/settings';
import { useAppTheme } from '@/theme/theme-provider';

/**
 * Primeiro uso, só no Android 12+ e só se faltar: pede "Alarmes e lembretes" para os avisos
 * chegarem no minuto certo (sem isso, o Android pode atrasar até 1 hora). Dá para pular.
 */
export default function ExactAlarmsScreen() {
  const router = useRouter();
  const t = useT();
  const theme = useAppTheme();
  const { settings, update } = useSettings();
  const [asking, setAsking] = useState(false);

  const allow = async () => {
    setAsking(true);
    // Na volta do ajuste, os dois avisos do dia são refeitos já como alarme exato.
    if (await requestExactAlarms()) {
      await scheduleDailyReminders(settings.nightMinutes, settings.morningMinutes, t).catch(() => undefined);
    }
    setAsking(false);
    update({ onboarded: true });
  };

  return (
    <Screen>
      <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/horarios'))} style={styles.back} />

      <View style={styles.intro}>
        <AppText variant="title" accessibilityRole="header">
          {t('exact.title')}
        </AppText>
        <AppText tone="secondary">{t('exact.body')}</AppText>
      </View>

      <Card style={styles.card}>
        <View style={[styles.cardIcon, { backgroundColor: theme.raised }]}>
          <Icon name="bell" size={20} color={theme.accentStrong} strokeWidth={2.2} />
        </View>
        <AppText variant="small" tone="secondary" style={styles.flex}>
          {t('exact.hint')}
        </AppText>
      </Card>

      <Spacer />

      <View style={styles.footer}>
        <PrimaryButton label={asking ? t('schedule.activating') : t('exact.allow')} disabled={asking} onPress={allow} />
        <LinkButton label={t('exact.later')} align="center" onPress={() => update({ onboarded: true })} />
        <ProgressDots total={2} current={1} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { marginLeft: -10 },
  intro: { gap: 8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  footer: { gap: 14 },
});
