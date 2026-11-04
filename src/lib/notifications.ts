import type * as NotificationsModule from 'expo-notifications';
import { Platform } from 'react-native';

import type { Translate } from '@/i18n';
import { eveningDay } from '@/lib/capture';
import { formatMinutes } from '@/lib/time';
import { dateFromKey, dayKey, nightOfDay, tasksOfDay, type Journal, type Task } from '@/state/journal';

const CHANNEL_ID = 'lembretes';
const NIGHT_REMINDER_ID = 'mindfree-noite';
const MORNING_SUMMARY_ID = 'mindfree-manha';

let cached: typeof NotificationsModule | null | undefined;

/**
 * A biblioteca de notificações, carregada só quando precisa. O Expo Go do Android não tem mais
 * a parte nativa dela (desde o SDK 53) e o app inteiro travava ao abrir; lá os lembretes ficam
 * desligados. No iPhone e no app instalado de verdade, tudo funciona normalmente.
 */
function notifications(): typeof NotificationsModule | null {
  if (cached === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cached = require('expo-notifications') as typeof NotificationsModule;
    } catch {
      cached = null;
    }
  }
  return cached;
}

/** Mostra os avisos mesmo com o app aberto. Chamar uma vez, na abertura do app. */
export function configureNotifications() {
  notifications()?.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensureChannel(N: typeof NotificationsModule, t: Translate) {
  if (Platform.OS !== 'android') return;
  // No Android 13+, o pedido de permissão só aparece depois que existe um canal.
  await N.setNotificationChannelAsync(CHANNEL_ID, {
    name: t('notif.channel'),
    importance: N.AndroidImportance.HIGH,
  });
}

function isAllowed(N: typeof NotificationsModule, permission: NotificationsModule.NotificationPermissionsStatus): boolean {
  return permission.granted || permission.ios?.status === N.IosAuthorizationStatus.PROVISIONAL;
}

export async function hasNotificationPermission(): Promise<boolean> {
  const N = notifications();
  if (!N) return false;
  return isAllowed(N, await N.getPermissionsAsync());
}

/** Pede permissão para notificar (se ainda der para pedir) e diz se o app pode notificar. */
export async function requestNotificationPermission(t: Translate): Promise<boolean> {
  const N = notifications();
  if (!N) return false;
  await ensureChannel(N, t);
  const current = await N.getPermissionsAsync();
  if (isAllowed(N, current) || !current.canAskAgain) return isAllowed(N, current);
  return isAllowed(N, await N.requestPermissionsAsync());
}

/** A próxima vez (a partir de `now`) em que dá `minutes` do dia: hoje, se ainda não passou; senão amanhã. */
export function nextOccurrence(now: Date, minutes: number): Date {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.floor(minutes / 60), minutes % 60, 0, 0);
  if (date.getTime() <= now.getTime()) date.setDate(date.getDate() + 1);
  return date;
}

/**
 * O texto do resumo da manhã: as primeiras tarefas do dia que começa (com horário quando têm),
 * para a pessoa saber o que a espera sem abrir o app. Sem tarefas, o convite de sempre.
 */
export function morningBody(journal: Journal, day: string, t: Translate): string {
  const tasks = tasksOfDay(journal, day).filter((task) => !task.done && !task.example);
  if (tasks.length === 0) return t('notif.morningBody');
  const shown = tasks.slice(0, 3).map((task) => (task.minutes === null ? task.title : `${formatMinutes(task.minutes)} ${task.title}`));
  const more = tasks.length - shown.length;
  return more > 0 ? t('notif.morningTasksMore', { list: shown.join(' · '), n: more }) : shown.join(' · ');
}

/**
 * Agenda (ou reagenda) os dois avisos do dia: o lembrete da noite e o resumo da manhã, cada um na próxima
 * ocorrência. Com o diário, o resumo traz as tarefas do dia e o lembrete da noite é pulado quando a estrela
 * de hoje já acendeu (o JournalProvider chama de novo a cada mudança, então eles acompanham a vida da pessoa).
 * O texto vai no idioma de agora; quando o idioma muda, é preciso reagendar.
 */
export async function scheduleDailyReminders(nightMinutes: number, morningMinutes: number, t: Translate, journal?: Journal) {
  const N = notifications();
  if (!N) return;
  await ensureChannel(N, t);
  await cancelDailyReminders();
  const now = new Date();
  const nightAt = nextOccurrence(now, nightMinutes);
  const morningAt = nextOccurrence(now, morningMinutes);
  // A noite que o lembrete anuncia já acendeu? Então ele só volta na noite seguinte.
  const litAlready = !!journal && !!nightOfDay(journal, eveningDay(nightAt, morningMinutes));
  if (litAlready) nightAt.setDate(nightAt.getDate() + 1);
  await N.scheduleNotificationAsync({
    identifier: NIGHT_REMINDER_ID,
    content: { title: t('notif.nightTitle'), body: t('notif.nightBody') },
    trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: nightAt, channelId: CHANNEL_ID },
  });
  await N.scheduleNotificationAsync({
    identifier: MORNING_SUMMARY_ID,
    content: {
      title: t('notif.morningTitle'),
      body: journal ? morningBody(journal, dayKey(morningAt), t) : t('notif.morningBody'),
    },
    trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: morningAt, channelId: CHANNEL_ID },
  });
}

export async function cancelDailyReminders() {
  const N = notifications();
  if (!N) return;
  await Promise.all(
    [NIGHT_REMINDER_ID, MORNING_SUMMARY_ID].map((id) => N.cancelScheduledNotificationAsync(id).catch(() => undefined)),
  );
}

const TASK_PREFIX = 'mindfree-tarefa-';
/** A categoria dos lembretes de tarefa: os botões "+1 h" e "Amanhã" no próprio aviso. */
const TASK_CATEGORY = 'tarefa';
export const SNOOZE_HOUR = 'adiar-1h';
export const SNOOZE_TOMORROW = 'adiar-amanha';

async function ensureTaskCategory(N: typeof NotificationsModule, t: Translate) {
  await N.setNotificationCategoryAsync(TASK_CATEGORY, [
    { identifier: SNOOZE_HOUR, buttonTitle: t('notif.snoozeHour'), options: { opensAppToForeground: false } },
    { identifier: SNOOZE_TOMORROW, buttonTitle: t('notif.snoozeTomorrow'), options: { opensAppToForeground: false } },
  ]).catch(() => undefined);
}
/** O iPhone guarda no máximo 64 avisos agendados; sobra espaço para os dois avisos do dia. */
const MAX_TASK_REMINDERS = 50;

// O que está agendado agora, por tarefa: "horário|título|corpo". Só mexe no que mudou.
const scheduledTasks = new Map<string, string>();

/**
 * Agenda um aviso no horário de cada tarefa que ainda falta (só as próximas, e só se o
 * celular deixar notificar). Chamar de novo sempre que as tarefas mudam. Marcar uma tarefa como feita
 * cancela só o aviso dela: os outros ficam como estão (antes, cada toque cancelava e refazia os 50).
 * `rebuild` refaz tudo: para quando o texto (idioma) ou o tipo de alarme muda.
 */
export async function scheduleTaskReminders(tasks: Task[], t: Translate, rebuild = false) {
  const N = notifications();
  if (!N || !(await hasNotificationPermission())) return;
  await ensureChannel(N, t);
  if (rebuild || scheduledTasks.size === 0) await ensureTaskCategory(N, t);

  // Na primeira vez (ou ao refazer), descobre o que o sistema tem, para não agendar em dobro nem
  // deixar aviso de uma tarefa que não existe mais.
  if (rebuild || scheduledTasks.size === 0) {
    const scheduled = await N.getAllScheduledNotificationsAsync();
    scheduledTasks.clear();
    for (const notification of scheduled) {
      if (!notification.identifier.startsWith(TASK_PREFIX)) continue;
      // Sem assinatura conhecida: entra como "desconhecido", e abaixo é refeito.
      scheduledTasks.set(notification.identifier.slice(TASK_PREFIX.length), '?');
    }
  }

  const now = Date.now();
  const upcoming = tasks
    .filter((task) => !task.done && !task.example && task.reminder && task.minutes !== null)
    .map((task) => {
      const date = dateFromKey(task.day);
      date.setHours(Math.floor((task.minutes ?? 0) / 60), (task.minutes ?? 0) % 60, 0, 0);
      return { task, date };
    })
    .filter(({ date }) => date.getTime() > now)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, MAX_TASK_REMINDERS);

  const wanted = new Map(
    upcoming.map(({ task, date }) => [task.id, { date, signature: `${date.getTime()}|${task.title}|${task.note || t('notif.taskBody')}` }]),
  );
  for (const [id] of scheduledTasks) {
    if (wanted.has(id)) continue;
    await N.cancelScheduledNotificationAsync(TASK_PREFIX + id).catch(() => undefined);
    scheduledTasks.delete(id);
  }
  for (const [id, { date, signature }] of wanted) {
    if (scheduledTasks.get(id) === signature) continue;
    const task = upcoming.find((item) => item.task.id === id)!.task;
    await N.scheduleNotificationAsync({
      identifier: TASK_PREFIX + id,
      content: { title: task.title, body: task.note || t('notif.taskBody'), categoryIdentifier: TASK_CATEGORY, data: { taskId: id } },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL_ID },
    });
    scheduledTasks.set(id, signature);
  }
}

// Avisos da rede (push) --------------------------------------------------------------------------

/** Os dois canais dos avisos dos amigos: com som, e sem som (o servidor usa este no horário de sono). */
export const FRIENDS_CHANNEL_ID = 'amigos';
export const FRIENDS_QUIET_CHANNEL_ID = 'amigos-silencio';

async function ensureFriendChannels(N: typeof NotificationsModule, t: Translate) {
  if (Platform.OS !== 'android') return;
  await N.setNotificationChannelAsync(FRIENDS_CHANNEL_ID, {
    name: t('push.channel'),
    importance: N.AndroidImportance.HIGH,
  });
  await N.setNotificationChannelAsync(FRIENDS_QUIET_CHANNEL_ID, {
    name: t('push.channelQuiet'),
    importance: N.AndroidImportance.LOW,
    sound: null,
    enableVibrate: false,
  });
}

/**
 * O endereço deste celular no Expo Push, para o servidor mandar os avisos dos amigos.
 * Nulo quando não dá: emulador sem Google, Expo Go no Android, sem permissão ou sem o projeto EAS.
 */
export async function pushToken(t: Translate, projectId: string | undefined): Promise<string | null> {
  const N = notifications();
  if (!N || !projectId || !(await hasNotificationPermission())) return null;
  try {
    await ensureFriendChannels(N, t);
    return (await N.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return null;
  }
}

/**
 * Chama `open` com o caminho do app (ex.: "/mural") quando a pessoa toca num aviso dos amigos,
 * inclusive no que abriu o app fechado, e `snooze` quando ela toca em "+1 h" ou "Amanhã" num lembrete
 * de tarefa. Devolve a função que para de escutar.
 */
export function listenNotificationOpens(
  open: (path: string) => void,
  snooze?: (taskId: string, by: 'hour' | 'tomorrow') => void,
): () => void {
  const N = notifications();
  if (!N) return () => undefined;
  const handle = (response: NotificationsModule.NotificationResponse | null) => {
    if (!response) return;
    const data = response.notification.request.content.data ?? {};
    const taskId = data.taskId;
    if (typeof taskId === 'string' && (response.actionIdentifier === SNOOZE_HOUR || response.actionIdentifier === SNOOZE_TOMORROW)) {
      snooze?.(taskId, response.actionIdentifier === SNOOZE_HOUR ? 'hour' : 'tomorrow');
      return;
    }
    const url = data.url;
    if (typeof url === 'string' && url.startsWith('/')) open(url);
  };
  const last = N.getLastNotificationResponse();
  if (last) {
    handle(last);
    N.clearLastNotificationResponse();
  }
  const subscription = N.addNotificationResponseReceivedListener(handle);
  return () => subscription.remove();
}

// Alarme exato (Android) -------------------------------------------------------------------------

/**
 * O Android 12+ só entrega um aviso agendado no minuto certo se o app puder usar alarmes exatos
 * ("Alarmes e lembretes" nos ajustes do sistema). Sem isso, o aviso pode atrasar até 1 hora.
 * No iPhone (e no Expo Go do Android, sem avisos) não há o que pedir: responde que sim.
 */
export async function hasExactAlarms(): Promise<boolean> {
  const N = notifications();
  if (!N || Platform.OS !== 'android') return true;
  try {
    return (await N.getExactAlarmPermissionsAsync()).granted;
  } catch {
    return true;
  }
}

/** Abre o ajuste do Android para permitir alarmes exatos e diz, na volta, se a pessoa permitiu. */
export async function requestExactAlarms(): Promise<boolean> {
  const N = notifications();
  if (!N || Platform.OS !== 'android') return true;
  try {
    return (await N.requestExactAlarmPermissionsAsync()).granted;
  } catch {
    return hasExactAlarms();
  }
}
