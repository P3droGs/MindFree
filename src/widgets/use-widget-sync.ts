import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useJournal } from '@/state/journal-provider';
import { useSettings } from '@/state/settings';
import { syncWidgets, watchWidgetTaps } from '@/widgets/sync';

/** Mantém os widgets da tela inicial em dia com os horários, as cores, o idioma e as tarefas do app. */
export function useWidgetSync() {
  const { settings } = useSettings();
  const { journal } = useJournal();
  const { nightMinutes, morningMinutes, accentId, accentCustom, language } = settings;

  useEffect(() => {
    const sync = () => {
      syncWidgets({ nightMinutes, morningMinutes, accentId, accentCustom, language }).catch(() => undefined);
    };
    // Espera a pessoa parar de mexer na roda de cores ou nos horários antes de atualizar.
    const timeout = setTimeout(sync, 800);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    const stopWatching = watchWidgetTaps(sync);
    return () => {
      clearTimeout(timeout);
      appState.remove();
      stopWatching();
    };
    // `journal` entra para atualizar o widget quando uma tarefa muda dentro do app.
  }, [nightMinutes, morningMinutes, accentId, accentCustom, language, journal]);
}
