import { createContext, use, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useT } from '@/i18n';
import { scheduleTaskReminders } from '@/lib/notifications';
import { loadJournal, saveJournal, type Journal } from '@/state/journal';

type JournalValue = {
  journal: Journal;
  /** Muda o diário: recebe o atual e devolve o novo. Salva no celular sozinho. */
  change: (update: (current: Journal) => Journal) => void;
};

const JournalContext = createContext<JournalValue | null>(null);

export function JournalProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [journal, setJournal] = useState(loadJournal);
  const loaded = useRef(true);

  // Salva a cada mudança (menos a primeira leitura, que já veio do celular).
  useEffect(() => {
    if (loaded.current) {
      loaded.current = false;
      return;
    }
    saveJournal(journal).catch(() => undefined);
  }, [journal]);

  // O widget pode marcar tarefas com o app fechado: ao voltar, relê o que está salvo.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        loaded.current = true;
        setJournal(loadJournal());
      }
    });
    return () => subscription.remove();
  }, []);

  // Lembretes de cada tarefa, no horário dela (com atraso, para não reagendar a cada toque).
  useEffect(() => {
    const timeout = setTimeout(() => {
      scheduleTaskReminders(journal.tasks, t).catch(() => undefined);
    }, 1200);
    return () => clearTimeout(timeout);
  }, [journal.tasks, t]);

  return <JournalContext value={{ journal, change: (update) => setJournal(update) }}>{children}</JournalContext>;
}

export function useJournal(): JournalValue {
  const value = use(JournalContext);
  if (!value) throw new Error('useJournal precisa estar dentro de JournalProvider.');
  return value;
}
