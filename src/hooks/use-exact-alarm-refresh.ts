import Storage from 'expo-sqlite/kv-store';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useT } from '@/i18n';
import { hasExactAlarms, hasNotificationPermission, scheduleDailyReminders, scheduleTaskReminders } from '@/lib/notifications';
import { useJournal } from '@/state/journal-provider';
import { useSettings } from '@/state/settings';

// Se o app podia usar alarme exato da última vez que olhou.
const EXACT_KEY = 'mindfree.exactAlarms.v1';

/**
 * Mantém os avisos agendados quando a permissão de alarme exato muda (Android 12+):
 * - ligou: os avisos de antes continuam "aproximados" e são refeitos na hora certa;
 * - desligou: o Android apaga os alarmes do app (até o lembrete da noite) e o app agenda de novo.
 * Confere ao abrir e ao voltar para o app, comparando com o que viu da última vez.
 */
export function useExactAlarmRefresh() {
  const t = useT();
  const { settings } = useSettings();
  const { journal } = useJournal();
  const latest = useRef({ settings, tasks: journal.tasks, t });
  useEffect(() => {
    latest.current = { settings, tasks: journal.tasks, t };
  }, [settings, journal.tasks, t]);

  useEffect(() => {
    const check = async () => {
      const now = await hasExactAlarms();
      const before = Storage.getItemSync(EXACT_KEY);
      Storage.setItemSync(EXACT_KEY, now ? '1' : '0');
      // Sem registro (primeira vez com esta versão), reagenda uma vez por garantia.
      if (before === (now ? '1' : '0')) return;
      const current = latest.current;
      if (!current.settings.onboarded || !(await hasNotificationPermission())) return;
      await scheduleDailyReminders(current.settings.nightMinutes, current.settings.morningMinutes, current.t);
      await scheduleTaskReminders(current.tasks, current.t, true);
    };
    void check().catch(() => undefined);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check().catch(() => undefined);
    });
    return () => subscription.remove();
  }, []);
}
