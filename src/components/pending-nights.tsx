import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { OutlineButton } from '@/components/buttons';
import { Card } from '@/components/card';
import { useI18n } from '@/i18n';
import { captureOrganized, nightMoment } from '@/lib/capture';
import { aiAllowed } from '@/lib/consent';
import { organizeOnServer, QuotaError } from '@/lib/organize';
import { useJournal } from '@/state/journal-provider';
import { useSettings } from '@/state/settings';
import { useAppTheme } from '@/theme/theme-provider';

/** Gravações que ficaram guardadas sem organizar (sem internet): um botão para organizar agora. */
export function PendingNights() {
  const theme = useAppTheme();
  const { t, language } = useI18n();
  const { settings } = useSettings();
  const { journal, change } = useJournal();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<'network' | 'quota' | null>(null);
  const pending = journal.nights.filter((night) => night.pending && night.audioUri);

  if (pending.length === 0 || !aiAllowed(settings)) return null;

  const organizeAll = async () => {
    setBusy(true);
    setFailed(null);
    for (const night of pending) {
      try {
        const now = nightMoment(night, settings.morningMinutes);
        const result = await organizeOnServer({ audioUri: night.audioUri! }, now, settings.morningMinutes, language.code);
        change((current) =>
          captureOrganized(current, result, { via: 'voz', nightId: night.id }, now, settings.morningMinutes).journal,
        );
      } catch (error) {
        setFailed(error instanceof QuotaError ? 'quota' : 'network');
        break;
      }
    }
    setBusy(false);
  };

  return (
    <Card>
      <AppText variant="bodyStrong">
        {pending.length === 1 ? t('home.pendingOne') : t('home.pendingMany', { n: pending.length })}
      </AppText>
      <AppText variant="small" tone="secondary">
        {failed === 'quota' ? t('home.pendingQuota') : failed ? t('home.pendingFailed') : t('home.pendingHint')}
      </AppText>
      {busy ? (
        <View style={styles.busy} accessibilityLiveRegion="polite">
          <ActivityIndicator color={theme.accent} />
          <AppText variant="small" tone="secondary">
            {t('saved.saving')}
          </AppText>
        </View>
      ) : (
        <OutlineButton label={t('home.pendingAction')} icon="checklist" onPress={() => void organizeAll()} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  busy: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
});
