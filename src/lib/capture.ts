import type { Translate } from '@/i18n';
import { parseTasks } from '@/lib/parse-tasks';
import { isNight, minutesOfDay } from '@/lib/time';
import { addDays, addNight, dateFromKey, dayKey, newId, type Journal, type Night, type Task } from '@/state/journal';

/** A noite que está acontecendo: depois da meia-noite e antes do resumo, ainda é a de ontem. */
export function eveningDay(now: Date, morningMinutes: number): string {
  const day = dayKey(now);
  return minutesOfDay(now) < morningMinutes ? addDays(day, -1) : day;
}

/** Para onde vão as tarefas sem dia: de noite, para a manhã seguinte; de dia, para hoje. */
export function defaultTaskDay(now: Date, morningMinutes: number): string {
  return isNight(now, morningMinutes) ? addDays(eveningDay(now, morningMinutes), 1) : dayKey(now);
}

function task(fields: Pick<Task, 'title' | 'day' | 'minutes'> & Partial<Task>): Task {
  const now = Date.now();
  return { id: newId('tarefa'), reminder: true, done: false, changedAt: now, createdAt: now, ...fields };
}

/** O texto do "Prefere escrever?": cada pedaço vira uma tarefa de verdade. */
export function captureText(journal: Journal, text: string, now: Date, morningMinutes: number) {
  const nightId = newId('noite');
  const fallbackDay = defaultTaskDay(now, morningMinutes);
  const tasks = parseTasks(text, now).map((draft) =>
    task({
      title: draft.title,
      day: draft.dayOffset === null ? fallbackDay : addDays(dayKey(now), draft.dayOffset),
      minutes: draft.minutes,
      nightId,
    }),
  );
  const night: Night = {
    id: nightId,
    changedAt: Date.now(),
    day: eveningDay(now, morningMinutes),
    at: minutesOfDay(now),
    noted: tasks.length,
    via: 'texto',
    transcript: text.trim(),
  };
  return { journal: addNight(journal, night, tasks), noted: tasks.length };
}

/**
 * A gravação de voz. Enquanto a transcrição e a IA não existem, a fala fica guardada e
 * entram tarefas de exemplo, marcadas como exemplo, para dar para ver como fica de manhã.
 */
export function captureVoice(journal: Journal, audioUri: string | null, now: Date, morningMinutes: number, t: Translate) {
  const nightId = newId('noite');
  const morning = defaultTaskDay(now, morningMinutes);
  const examples: [string, string, string, number][] = [
    [t('example.task1'), t('example.note1'), morning, 9 * 60],
    [t('example.task2'), t('example.note2'), morning, 10 * 60],
    [t('example.task3'), t('example.note3'), morning, 18 * 60 + 30],
    [t('example.task4'), t('example.note4'), addDays(morning, 2), 9 * 60],
  ];
  const tasks = examples.map(([title, note, day, minutes]) =>
    task({ title, note, day, minutes, nightId, example: true }),
  );
  const night: Night = {
    id: nightId,
    changedAt: Date.now(),
    day: eveningDay(now, morningMinutes),
    at: minutesOfDay(now),
    noted: tasks.length,
    via: 'voz',
    audioUri: audioUri ?? undefined,
    example: true,
  };
  return { journal: addNight(journal, night, tasks), noted: tasks.length };
}

export function manualTask(title: string, day: string): Task {
  return task({ title: title.trim(), day, minutes: null, reminder: false });
}

/** Uma tarefa como volta do servidor: data AAAA-MM-DD e horário "HH:MM" (ou vazio). */
export type OrganizedTask = { title: string; note: string; date: string; time: string };

function parseTime(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

/**
 * Guarda o que a IA organizou: as tarefas de verdade e a noite que acendeu.
 * Com `nightId`, completa uma noite que tinha ficado pendente.
 */
export function captureOrganized(
  journal: Journal,
  result: { transcript: string; tasks: OrganizedTask[] },
  source: { via: Night['via']; audioUri?: string; nightId?: string },
  now: Date,
  morningMinutes: number,
) {
  const today = dayKey(now);
  const fallbackDay = defaultTaskDay(now, morningMinutes);
  const nightId = source.nightId ?? newId('noite');
  const tasks = result.tasks.map((item) => {
    const minutes = parseTime(item.time);
    const validDay = /^\d{4}-\d{2}-\d{2}$/.test(item.date) && item.date >= today && item.date <= addDays(today, 366);
    return task({
      title: item.title.trim().slice(0, 120),
      note: item.note.trim().slice(0, 200) || undefined,
      day: validDay ? item.date : fallbackDay,
      minutes,
      reminder: minutes !== null,
      nightId,
    });
  });

  if (source.nightId) {
    return {
      journal: {
        tasks: [...journal.tasks, ...tasks],
        nights: journal.nights.map((night) =>
          night.id === source.nightId
            ? {
                ...night,
                pending: false,
                noted: tasks.length,
                transcript: result.transcript || night.transcript,
                changedAt: Date.now(),
              }
            : night,
        ),
      },
      noted: tasks.length,
    };
  }

  const night: Night = {
    id: nightId,
    changedAt: Date.now(),
    day: eveningDay(now, morningMinutes),
    at: minutesOfDay(now),
    noted: tasks.length,
    via: source.via,
    transcript: result.transcript || undefined,
    audioUri: source.audioUri,
  };
  return { journal: addNight(journal, night, tasks), noted: tasks.length };
}

/** A gravação fica guardada para organizar depois (sem internet ou com o servidor fora do ar). */
export function pendingNight(journal: Journal, audioUri: string | null, now: Date, morningMinutes: number): Journal {
  const night: Night = {
    id: newId('noite'),
    changedAt: Date.now(),
    day: eveningDay(now, morningMinutes),
    at: minutesOfDay(now),
    noted: 0,
    via: 'voz',
    audioUri: audioUri ?? undefined,
    pending: true,
  };
  return addNight(journal, night, []);
}

/** O momento em que a noite foi gravada (para entender "amanhã" do jeito que a pessoa falou). */
export function nightMoment(night: Night, morningMinutes: number): Date {
  const date = dateFromKey(night.day);
  // Depois da meia-noite e antes do resumo, a noite ainda é a do dia anterior.
  if (night.at < morningMinutes) date.setDate(date.getDate() + 1);
  date.setMinutes(night.at);
  return date;
}
