export const MINUTES_PER_DAY = 24 * 60;

export function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** É noite das 18h até o horário do resumo da manhã. */
export function isNight(date: Date, morningMinutes: number): boolean {
  const minutes = minutesOfDay(date);
  return minutes >= 18 * 60 || minutes < morningMinutes;
}

/** Chave da saudação certa para a hora (bom dia, boa tarde ou boa noite). */
export function greetingKey(date: Date): 'greeting.morning' | 'greeting.afternoon' | 'greeting.night' {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'greeting.morning';
  if (hour >= 12 && hour < 18) return 'greeting.afternoon';
  return 'greeting.night';
}
