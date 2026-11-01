import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BackButton, PrimaryButton } from '@/components/buttons';
import { Card } from '@/components/card';
import { Icon, type IconName } from '@/components/icon';
import { ProgressDots } from '@/components/progress-dots';
import { Screen, Spacer } from '@/components/screen';
import { TimeStepper } from '@/components/time-stepper';
import { requestNotificationPermission, scheduleDailyReminders } from '@/lib/notifications';
import { useT } from '@/i18n';
import { useSettings } from '@/state/settings';
import { useAppTheme } from '@/theme/theme-provider';

export default function ScheduleScreen() {
  const router = useRouter();
  const t = useT();
  const { settings, update } = useSettings();
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    setSaving(true);
    try {
      if (await requestNotificationPermission(t)) {
        await scheduleDailyReminders(settings.nightMinutes, settings.morningMinutes, t);
      } else {
        Alert.alert(t('schedule.deniedTitle'), t('schedule.deniedBody'));
      }
    } catch {
      Alert.alert(t('schedule.errorTitle'), t('schedule.errorBody'));
    }
    setSaving(false);
    // Ao terminar o primeiro uso, a navegação troca sozinha para a tela inicial.
    update({ onboarded: true });
  };

  return (
    <Screen>
      {/* Veio das Boas-vindas ou de Entrar/Criar conta; aberta por um link, volta para o começo. */}
      <BackButton
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/boas-vindas'))}
        style={styles.back}
      />

      <View style={styles.intro}>
        <AppText variant="title" accessibilityRole="header">
          {t('schedule.title')}
        </AppText>
        <AppText tone="secondary">{t('schedule.sub')}</AppText>
      </View>

      <ReminderCard
        icon="moon"
        title={t('schedule.night')}
        description={t('schedule.nightDesc')}
        minutes={settings.nightMinutes}
        onChange={(nightMinutes) => update({ nightMinutes })}
      />
      <ReminderCard
        icon="sun"
        title={t('schedule.morning')}
        description={t('schedule.morningDesc')}
        minutes={settings.morningMinutes}
        onChange={(morningMinutes) => update({ morningMinutes })}
      />

      <Spacer />

      <View style={styles.footer}>
        <PrimaryButton label={saving ? t('schedule.activating') : t('schedule.activate')} disabled={saving} onPress={finish} />
        <AppText variant="small" tone="secondary" style={styles.center}>
          {t('schedule.permissionHint')}
        </AppText>
        <ProgressDots total={2} current={1} />
      </View>
    </Screen>
  );
}

type ReminderCardProps = {
  icon: IconName;
  title: string;
  description: string;
  minutes: number;
  onChange: (minutes: number) => void;
};

function ReminderCard({ icon, title, description, minutes, onChange }: ReminderCardProps) {
  const theme = useAppTheme();

  return (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIcon, { backgroundColor: theme.raised }]}>
          <Icon name={icon} size={20} color={theme.accentStrong} strokeWidth={2.2} />
        </View>
        <View style={styles.cardText}>
          <AppText variant="bodyStrong">{title}</AppText>
          <AppText variant="caption" tone="secondary">
            {description}
          </AppText>
        </View>
      </View>
      <TimeStepper label={title} minutes={minutes} onChange={onChange} />
    </Card>
  );
}

const styles = StyleSheet.create({
  back: { marginLeft: -10 },
  intro: { gap: 8 },
  card: { gap: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1 },
  footer: { gap: 14 },
  center: { textAlign: 'center' },
});
