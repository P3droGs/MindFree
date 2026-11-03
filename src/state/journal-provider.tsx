import { createContext, use, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useT } from '@/i18n';
import { deleteLocalFile } from '@/lib/files';
import { scheduleTaskReminders } from '@/lib/notifications';
import { expiredRecordings, forgetRecordings, loadJournal, saveJournalNow, type Journal } from '@/state/journal';

type JournalValue = {
  journal: Journal;
  /** Muda o diário: recebe o atual e devolve o novo. Salva no celular sozinho. */
  change: (update: (current: Journal) => Journal) => void;
};

const JournalContext = createContext<JournalValue | null>(null);

/**
 * Lê o diário salvo. De quebra, o áudio das noites organizadas há mais de 7 dias sai do celular (o texto,
 * as tarefas e a estrela ficam): é ao abrir o app e ao voltar para ele que esse prazo vence.
 * Devolve também o que estava salvo, para gravar de novo só se a limpeza mudou alguma coisa.
 */
function readJournal(): { journal: Journal; cleaned: boolean } {
  const stored = loadJournal();
  const expired = expiredRecordings(stored);
  for (const night of expired) if (night.audioUri) deleteLocalFile(night.audioUri);
  const journal = expired.length ? forgetRecordings(stored, new Set(expired.map((night) => night.id))) : stored;
  return { journal, cleaned: expired.length > 0 };
}

export function JournalProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [first] = useState(readJournal);
  const [journal, setJournal] = useState(first.journal);
  // O objeto do diário que já está gravado no celular. Só salva quando `journal` é outro objeto: cada
  // `change()` cria um novo, e a releitura do disco entra já marcada como gravada. Comparar por identidade
  // custa nada; antes era um JSON.stringify do diário inteiro a cada render.
  // (Uma marca de "acabei de ler" ficava presa quando a releitura não mudava nada, como no app recém-instalado,
  // e a primeira noite gravada não era salva; por isso a comparação é com o objeto, não com uma marca.)
  const saved = useRef<Journal | null>(first.cleaned ? null : first.journal);

  useEffect(() => {
    if (journal === saved.current) return;
    saved.current = journal;
    // Na hora e sem esperar: se o app for para o fundo logo depois, a releitura já encontra isto.
    saveJournalNow(journal);
  }, [journal]);

  // O widget pode marcar tarefas com o app fechado: ao voltar, relê o que está salvo.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const next = readJournal();
        if (!next.cleaned) saved.current = next.journal;
        setJournal(next.journal);
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
