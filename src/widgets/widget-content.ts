import { resolveLanguage, translator, type Translate } from '@/i18n';
import { formatMinutes, minutesOfDay } from '@/lib/time';
import { dayKey, starsInMonth, tasksOfDay, type Journal } from '@/state/journal';
import type { Settings } from '@/state/settings';
import { DAY_BACKGROUND, NIGHT_BACKGROUND } from '@/theme/palette';
import { resolveAccent } from '@/theme/theme-provider';
import { buildTheme } from '@/theme/tokens';

// O widget do iPhone roda isolado e não consegue importar nada: as regras daqui estão
// repetidas em `ios/`, e os textos já vão traduzidos nas props (`labels`, `caption`).
// Ao mudar algo aqui, mude lá também.

export type WidgetMode = 'dia' | 'noite';

export type WidgetTask = {
  id: string;
  title: string;
  /** "09:00", ou vazio quando a tarefa não tem horário. */
  time: string;
  done: boolean;
  changedAt: number;
};

/** Fundos fixos de dia e de noite do MindFree, com o destaque que a pessoa escolheu. */
export type WidgetPalette = {
  dayAccent: string;
  nightAccent: string;
  nightOnAccent: string;
  nightAccentText: string;
};

export type MindFreeWidgetProps = {
  mode: WidgetMode;
  /** Tarefas de hoje, mostradas no modo dia. */
  tasks: WidgetTask[];
  /** Tarefas concluídas no dia que está terminando, mostradas no modo noite. */
  doneToday: number;
  nightTime: string;
  morningTime: string;
  palette: WidgetPalette;
  labels: MindFreeLabels;
};

/** Textos do widget no idioma do app. `leftMany`, `check` e `uncheck` têm {n} e {title} para completar. */
export type MindFreeLabels = {
  today: string;
  next: string;
  record: string;
  nightTitle: string;
  freeDay: string;
  allDone: string;
  leftOne: string;
  leftMany: string;
  noTasks: string;
  emptyDay: string;
  allDoneToday: string;
  nightMessage: string;
  check: string;
  uncheck: string;
};

export type SkyWidgetProps = {
  mode: WidgetMode;
  /** Estrelas acesas no mês. */
  stars: number;
  /** A pessoa já esvaziou a mente nesta noite. */
  litTonight: boolean;
  title: string;
  /** Frase de baixo, já no idioma do app ("7 estrelas em outubro"). */
  caption: string;
};

export type WidgetSettings = Pick<
  Settings,
  'nightMinutes' | 'morningMinutes' | 'accentId' | 'accentCustom' | 'language'
>;

/** Quantas estrelas cabem no desenho do widget "Seu céu". */
export const SKY_STAR_SLOTS = 8;

/** Posições das estrelas no desenho (0 a 1, da esquerda e do topo), ligadas nesta ordem. */
export const SKY_STAR_POSITIONS: readonly (readonly [number, number])[] = [
  [0.08, 0.72],
  [0.24, 0.5],
  [0.38, 0.66],
  [0.52, 0.34],
  [0.67, 0.54],
  [0.81, 0.28],
  [0.93, 0.48],
  [0.62, 0.08],
];

/** O widget fica no modo noite do horário do lembrete da noite até o resumo da manhã. */
export function widgetModeAt(date: Date, nightMinutes: number, morningMinutes: number): WidgetMode {
  if (nightMinutes === morningMinutes) return 'dia';
  const minutes = minutesOfDay(date);
  const night =
    nightMinutes > morningMinutes
      ? minutes >= nightMinutes || minutes < morningMinutes
      : minutes >= nightMinutes && minutes < morningMinutes;
  return night ? 'noite' : 'dia';
}

/** Próximos horários em que o widget troca entre o dia e a noite. */
export function nextModeChanges(from: Date, nightMinutes: number, morningMinutes: number, count: number): Date[] {
  if (nightMinutes === morningMinutes) return [];
  const times = [morningMinutes, nightMinutes].sort((a, b) => a - b);
  const changes: Date[] = [];
  for (let offset = 0; changes.length < count; offset++) {
    for (const minutes of times) {
      const change = new Date(
        from.getFullYear(),
        from.getMonth(),
        from.getDate() + offset,
        Math.floor(minutes / 60),
        minutes % 60,
      );
      if (change > from) changes.push(change);
    }
  }
  return changes.slice(0, count);
}

/** Depois da meia-noite e antes do resumo da manhã, ainda conta como o dia anterior. */
function dayEndingAt(date: Date, morningMinutes: number): Date {
  return minutesOfDay(date) < morningMinutes
    ? new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1)
    : date;
}

export function buildWidgetProps(
  journal: Journal,
  settings: WidgetSettings,
  date: Date,
): { mindfree: MindFreeWidgetProps; sky: SkyWidgetProps } {
  const mode = widgetModeAt(date, settings.nightMinutes, settings.morningMinutes);
  const today = dayEndingAt(date, settings.morningMinutes);
  const day = dayKey(today);
  const tasks = tasksOfDay(journal, day);
  const accent = resolveAccent(settings);
  const dayTheme = buildTheme(DAY_BACKGROUND, accent);
  const nightTheme = buildTheme(NIGHT_BACKGROUND, accent);
  const t = translator(resolveLanguage(settings.language));
  const nightTime = formatMinutes(settings.nightMinutes);
  const morningTime = formatMinutes(settings.morningMinutes);
  const doneToday = tasks.filter((task) => task.done).length;
  const stars = starsInMonth(journal, today);
  const litTonight = journal.nights.some((night) => night.day === day);

  return {
    mindfree: {
      mode,
      tasks: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        time: task.minutes === null ? '' : formatMinutes(task.minutes),
        done: task.done,
        changedAt: task.changedAt,
      })),
      doneToday,
      nightTime,
      morningTime,
      palette: {
        dayAccent: dayTheme.accentStrong,
        nightAccent: nightTheme.accent,
        nightOnAccent: nightTheme.onAccent,
        nightAccentText: nightTheme.accentStrong,
      },
      labels: {
        today: t('widget.today'),
        next: t('widget.next'),
        record: t('home.record'),
        nightTitle: t('notif.nightTitle'),
        freeDay: t('widget.freeDay'),
        allDone: t('widget.allDone'),
        leftOne: t('widget.leftOne'),
        leftMany: t('widget.leftMany'),
        noTasks: t('widget.noTasks'),
        emptyDay: t('widget.emptyDay', { time: nightTime }),
        allDoneToday: t('widget.allDoneToday'),
        nightMessage: nightMessage(t, doneToday, morningTime),
        check: t('widget.check'),
        uncheck: t('widget.uncheck'),
      },
    },
    sky: {
      mode,
      stars,
      litTonight,
      title: t('home.sky'),
      caption: skyCaption(t, mode, stars, litTonight, today),
    },
  };
}

/** Até 3 tarefas; com mais que isso, as que faltam vêm primeiro. */
export function visibleTasks(tasks: WidgetTask[]): WidgetTask[] {
  if (tasks.length <= 3) return tasks;
  return [...tasks.filter((task) => !task.done), ...tasks.filter((task) => task.done)].slice(0, 3);
}

export function remainingLabel(props: MindFreeWidgetProps): string {
  const pending = props.tasks.filter((task) => !task.done).length;
  if (props.tasks.length === 0) return props.labels.freeDay;
  if (pending === 0) return props.labels.allDone;
  return pending === 1 ? props.labels.leftOne : props.labels.leftMany.replace('{n}', String(pending));
}

/** O que aparece no widget pequeno de dia: a próxima tarefa ou, sem nada pendente, a noite. */
export function nextUp(props: MindFreeWidgetProps): { title: string; time: string } {
  const next = props.tasks.find((task) => !task.done);
  if (next) return { title: next.title, time: next.time || props.labels.today };
  if (props.tasks.length > 0) return { title: props.labels.allDoneToday, time: '✓' };
  return { title: props.labels.record, time: props.nightTime };
}

function nightMessage(t: Translate, done: number, morningTime: string): string {
  const opening = done === 0 ? t('widget.talk') : done === 1 ? t('widget.doneOne') : t('widget.doneMany', { n: done });
  return `${opening} ${t('widget.tomorrow', { time: morningTime })}`;
}

function skyCaption(t: Translate, mode: WidgetMode, stars: number, litTonight: boolean, today: Date): string {
  if (mode === 'noite' && !litTonight) return t('widget.skyTonight', { n: stars + 1 });
  if (stars === 0) return t('widget.skyFirst');
  const month = t(`month.${today.getMonth() + 1}` as 'month.1');
  return stars === 1 ? t('widget.starsOne', { month }) : t('widget.starsMany', { n: stars, month });
}
