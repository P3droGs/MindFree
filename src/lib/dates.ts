import type { MessageKey, Translate } from '@/i18n';
import { dateFromKey } from '@/state/journal';

export function monthName(t: Translate, month: number): string {
  return t(`month.${month + 1}` as MessageKey);
}

export function weekdayName(t: Translate, weekday: number): string {
  return t(`weekday.${weekday}` as MessageKey);
}

/** "quarta, 21 de outubro" (na ordem e com as palavras de cada idioma). */
export function longDate(t: Translate, key: string): string {
  const date = dateFromKey(key);
  return t('date.long', {
    weekday: weekdayName(t, date.getDay()),
    day: date.getDate(),
    month: monthName(t, date.getMonth()),
  });
}

/** Título de um dia na lista: "Hoje", "Amanhã" ou a data por extenso. */
export function dayTitle(t: Translate, key: string, todayKey: string, tomorrowKey: string): string {
  if (key === todayKey) return `${t('date.today')} · ${longDate(t, key)}`;
  if (key === tomorrowKey) return `${t('date.tomorrow')} · ${longDate(t, key)}`;
  const text = longDate(t, key);
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

/** "agora há pouco", "há 3 h", "há 1 dia", "há 2 dias". */
export function timeAgo(t: Translate, createdAt: number, now: number): string {
  const hours = Math.floor((now - createdAt) / 3_600_000);
  if (hours < 1) return t('mural.justNow');
  if (hours < 24) return t('mural.hoursAgo', { n: hours });
  const days = Math.floor(hours / 24);
  if (days === 1) return t('mural.daysAgoOne');
  // O árabe tem forma própria para dois ("قبل يومين"); nos outros idiomas é igual ao plural.
  if (days === 2) return t('mural.daysAgoTwo');
  return t('mural.daysAgo', { n: days });
}
