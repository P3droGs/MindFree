import Storage from 'expo-sqlite/kv-store';

export type Task = {
  id: string;
  title: string;
  /** Detalhe curto embaixo do título ("Vence hoje", "Marcar a limpeza"). */
  note?: string;
  /** Dia da tarefa, no formato AAAA-MM-DD. */
  day: string;
  /** Horário do lembrete em minutos do dia; `null` quando a tarefa não tem horário. */
  minutes: number | null;
  /** Avisar no horário (desligado = só aparece na lista). */
  reminder: boolean;
  done: boolean;
  /** Quando a tarefa foi marcada ou desmarcada pela última vez (ms), no app ou no widget. */
  changedAt: number;
  createdAt: number;
  /** A noite em que a tarefa nasceu, quando veio de uma gravação ou de um texto. */
  nightId?: string;
  /** Tarefa de exemplo, criada enquanto a organização com IA não existe. */
  example?: boolean;
};

/** Uma noite em que a pessoa esvaziou a mente: cada uma acende uma estrela. */
export type Night = {
  id: string;
  /** A noite (AAAA-MM-DD do dia que estava terminando). */
  day: string;
  /** Hora em que gravou ou escreveu, em minutos do dia. */
  at: number;
  /** Quantas coisas saíram da cabeça nessa noite. */
  noted: number;
  via: 'voz' | 'texto';
  /** O que a pessoa escreveu, ou a transcrição do que ela falou. */
  transcript?: string;
  audioUri?: string;
  example?: boolean;
  /** Gravação guardada que ainda não foi organizada (por exemplo, sem internet). */
  pending?: boolean;
  /** Quando a noite mudou pela última vez (ms): é por aqui que a nuvem sabe o que enviar. */
  changedAt?: number;
};

/** Tudo o que a pessoa já organizou: as tarefas e as noites em que esvaziou a mente. */
export type Journal = {
  tasks: Task[];
  nights: Night[];
};

const STORAGE_KEY = 'mindfree.journal.v1';
const EMPTY_JOURNAL: Journal = { tasks: [], nights: [] };

export function loadJournal(): Journal {
  try {
    const saved = Storage.getItemSync(STORAGE_KEY);
    if (!saved) return EMPTY_JOURNAL;
    // Tarefas antigas não tinham `reminder` nem `createdAt`.
    type SavedTask = Omit<Task, 'reminder' | 'createdAt'> & Partial<Pick<Task, 'reminder' | 'createdAt'>>;
    const parsed = JSON.parse(saved) as { tasks?: SavedTask[]; nights?: (Night | string)[] };
    return {
      tasks: (parsed.tasks ?? []).map((task) => ({
        ...task,
        reminder: task.reminder ?? true,
        createdAt: task.createdAt ?? task.changedAt,
      })),
      // As primeiras versões guardavam só a data de cada noite.
      nights: (parsed.nights ?? []).map((night) =>
        typeof night === 'string' ? { id: `noite-${night}`, day: night, at: 0, noted: 0, via: 'voz' } : night,
      ),
    };
  } catch {
    return EMPTY_JOURNAL;
  }
}

export function saveJournal(journal: Journal): Promise<void> {
  return Storage.setItem(STORAGE_KEY, JSON.stringify(journal));
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function dateFromKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(key: string, amount: number): string {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + amount);
  return dayKey(date);
}

/** Tarefas do dia, das que têm horário mais cedo para as sem horário. */
export function tasksOfDay(journal: Journal, day: string): Task[] {
  return journal.tasks
    .filter((task) => task.day === day)
    .sort((a, b) => (a.minutes ?? Infinity) - (b.minutes ?? Infinity) || a.createdAt - b.createdAt);
}

export function nightOfDay(journal: Journal, day: string): Night | undefined {
  return journal.nights.filter((night) => night.day === day).at(-1);
}

export function nightsInMonth(journal: Journal, date: Date): Night[] {
  const month = dayKey(date).slice(0, 7);
  const byDay = new Map<string, Night>();
  for (const night of journal.nights) if (night.day.startsWith(month)) byDay.set(night.day, night);
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export function starsInMonth(journal: Journal, date: Date): number {
  return nightsInMonth(journal, date).length;
}

export function setTaskDone(journal: Journal, id: string, done: boolean, changedAt = Date.now()): Journal {
  return {
    ...journal,
    tasks: journal.tasks.map((task) => (task.id === id ? { ...task, done, changedAt } : task)),
  };
}

export function updateTask(journal: Journal, id: string, changes: Partial<Task>): Journal {
  return {
    ...journal,
    tasks: journal.tasks.map((task) => (task.id === id ? { ...task, ...changes, changedAt: Date.now() } : task)),
  };
}

export function removeTask(journal: Journal, id: string): Journal {
  return { ...journal, tasks: journal.tasks.filter((task) => task.id !== id) };
}

export function addTasks(journal: Journal, tasks: Task[]): Journal {
  return { ...journal, tasks: [...journal.tasks, ...tasks] };
}

export function addNight(journal: Journal, night: Night, tasks: Task[]): Journal {
  return { tasks: [...journal.tasks, ...tasks], nights: [...journal.nights, night] };
}

/**
 * Uma noite "acesa": quantas tarefas ela tem e quantas já foram feitas.
 * Duas gravações no mesmo dia são uma estrela só, então as tarefas das duas contam juntas.
 */
export function nightProgress(journal: Journal, night: Night): { noted: number; done: number } {
  const sameDay = journal.nights.filter((other) => other.day === night.day);
  let noted = 0;
  let done = 0;
  for (const recording of sameDay.length ? sameDay : [night]) {
    const tasks = journal.tasks.filter((task) => task.nightId === recording.id);
    noted += tasks.length || recording.noted;
    done += tasks.filter((task) => task.done).length;
  }
  return { noted, done };
}

/** Noites seguidas até `lastDay` (se ela ainda não acendeu, conta a partir da véspera). */
export function nightStreak(journal: Journal, lastDay: string): number {
  const lit = new Set(journal.nights.map((night) => night.day));
  let day = lit.has(lastDay) ? lastDay : addDays(lastDay, -1);
  let count = 0;
  while (lit.has(day)) {
    count += 1;
    day = addDays(day, -1);
  }
  return count;
}

/** A segunda-feira da semana de `day` (a semana do céu vai de segunda a domingo). */
export function mondayOf(day: string): string {
  return addDays(day, -((dateFromKey(day).getDay() + 6) % 7));
}

/** As 7 noites da semana de `day`, de segunda a domingo: acesa ou não. */
export function weekNights(journal: Journal, day: string): boolean[] {
  const monday = mondayOf(day);
  const lit = new Set(journal.nights.map((night) => night.day));
  return [0, 1, 2, 3, 4, 5, 6].map((offset) => lit.has(addDays(monday, offset)));
}
