import type * as NotificationsModule from 'expo-notifications';
import { Platform } from 'react-native';

import type { Translate } from '@/i18n';
import { dateFromKey, type Task } from '@/state/journal';

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

function dailyTrigger(N: typeof NotificationsModule, minutes: number): NotificationsModule.DailyTriggerInput {
  return {
    type: N.SchedulableTriggerInputTypes.DAILY,
    hour: Math.floor(minutes / 60),
    minute: minutes % 60,
    channelId: CHANNEL_ID,
  };
}

/**
 * Agenda (ou reagenda) os dois avisos de todo dia: o lembrete da noite e o resumo da manhã.
 * O texto vai no idioma de agora; quando o idioma muda, é preciso reagendar.
 */
export async function scheduleDailyReminders(nightMinutes: number, morningMinutes: number, t: Translate) {
  const N = notifications();
  if (!N) return;
  await ensureChannel(N, t);
  await cancelDailyReminders();
  await N.scheduleNotificationAsync({
    identifier: NIGHT_REMINDER_ID,
    content: {
      title: t('notif.nightTitle'),
      body: t('notif.nightBody'),
    },
    trigger: dailyTrigger(N, nightMinutes),
  });
  await N.scheduleNotificationAsync({
    identifier: MORNING_SUMMARY_ID,
    content: {
      title: t('notif.morningTitle'),
      body: t('notif.morningBody'),
    },
    trigger: dailyTrigger(N, morningMinutes),
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
/** O iPhone guarda no máximo 64 avisos agendados; sobra espaço para os dois avisos do dia. */
const MAX_TASK_REMINDERS = 50;

/**
 * Agenda um aviso no horário de cada tarefa que ainda falta (só as próximas, e só se o
 * celular deixar notificar). Chamar de novo sempre que as tarefas mudam: refaz a lista toda.
 */
export async function scheduleTaskReminders(tasks: Task[], t: Translate) {
  const N = notifications();
  if (!N || !(await hasNotificationPermission())) return;
  await ensureChannel(N, t);
  const scheduled = await N.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((notification) => notification.identifier.startsWith(TASK_PREFIX))
      .map((notification) => N.cancelScheduledNotificationAsync(notification.identifier)),
  );

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

  for (const { task, date } of upcoming) {
    await N.scheduleNotificationAsync({
      identifier: TASK_PREFIX + task.id,
      content: { title: task.title, body: task.note || t('notif.taskBody') },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL_ID },
    });
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
 * inclusive no que abriu o app fechado. Devolve a função que para de escutar.
 */
export function listenNotificationOpens(open: (path: string) => void): () => void {
  const N = notifications();
  if (!N) return () => undefined;
  const handle = (response: NotificationsModule.NotificationResponse | null) => {
    const url = response?.notification.request.content.data?.url;
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
