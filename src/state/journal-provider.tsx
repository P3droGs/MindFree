import { createContext, use, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useT } from '@/i18n';
import { scheduleTaskReminders } from '@/lib/notifications';
import { loadJournal, saveJournalNow, type Journal } from '@/state/journal';

type JournalValue = {
  journal: Journal;
  /** Muda o diário: recebe o atual e devolve o novo. Salva no celular sozinho. */
  change: (update: (current: Journal) => Journal) => void;
};

const JournalContext = createContext<JournalValue | null>(null);

export function JournalProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [journal, setJournal] = useState(loadJournal);
  // O que está gravado no celular agora. Só salva quando o diário fica diferente disso.
  // (Antes era uma marca de "acabei de ler", que ficava presa quando a releitura não mudava nada,
  // como no app recém-instalado, e a primeira noite gravada não era salva.)
  const saved = useRef<string | null>(null);

  useEffect(() => {
    const json = JSON.stringify(journal);
    if (saved.current === null) {
      saved.current = json;
      return;
    }
    if (json === saved.current) return;
    saved.current = json;
    // Na hora e sem esperar: se o app for para o fundo logo depois, a releitura já encontra isto.
    saveJournalNow(journal);
  }, [journal]);

  // O widget pode marcar tarefas com o app fechado: ao voltar, relê o que está salvo.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const next = loadJournal();
        saved.current = JSON.stringify(next);
        setJournal(next);
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
