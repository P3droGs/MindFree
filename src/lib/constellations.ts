import type { MessageKey, Translate } from '@/i18n';
import type { Journal } from '@/state/journal';

/** Quantos nomes prontos existem (sky.name1 … sky.name16): imagens simples, que todo mundo reconhece. */
export const CONSTELLATION_NAME_COUNT = 16;
/** Tamanho máximo do nome que a pessoa dá. */
export const CONSTELLATION_NAME_MAX = 30;

/** O mês de uma constelação, no formato AAAA-MM. */
export type MonthKey = string;

export type Constellation = {
  month: MonthKey;
  /** Dias do mês com estrela, em ordem. */
  days: number[];
};

/** Onde fica a estrela de cada dia do mês: um caminho que serpenteia pelo céu. */
export function starPosition(day: number, width: number): [number, number] {
  const column = (day - 1) % 8;
  const row = Math.floor((day - 1) / 8);
  const forward = row % 2 === 0;
  const x = 28 + ((forward ? column : 7 - column) * (width - 56)) / 7;
  const wobble = ((day * 37) % 23) - 11;
  return [x, 34 + row * 46 + wobble];
}

/** O nome que o app sugere para o mês: meses seguidos nunca se repetem, e a lista dá a volta a cada 16 meses. */
export function suggestedName(t: Translate, month: MonthKey): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const index = ((year * 12 + monthNumber - 1) % CONSTELLATION_NAME_COUNT) + 1;
  return t(`sky.name${index}` as MessageKey);
}

/** O nome que a pessoa deu, limpo; vazio quando ela não deu nenhum (ou veio algo estranho da nuvem). */
export function customName(names: Record<string, unknown>, month: MonthKey): string {
  const value = names[month];
  return typeof value === 'string' ? value.trim().slice(0, CONSTELLATION_NAME_MAX) : '';
}

export function constellationName(t: Translate, names: Record<string, unknown>, month: MonthKey): string {
  return customName(names, month) || suggestedName(t, month);
}

/** Os meses que já terminaram e têm ao menos uma estrela, do mais recente para o mais antigo. */
export function pastConstellations(journal: Journal, currentMonth: MonthKey): Constellation[] {
  const byMonth = new Map<MonthKey, Set<number>>();
  for (const night of journal.nights) {
    const month = night.day.slice(0, 7);
    if (month >= currentMonth) continue;
    const days = byMonth.get(month) ?? new Set<number>();
    days.add(Number(night.day.slice(8, 10)));
    byMonth.set(month, days);
  }
  return [...byMonth]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, days]) => ({ month, days: [...days].sort((a, b) => a - b) }));
}

/** O desenho pequeno da constelação, com as estrelas nos mesmos lugares do céu grande. */
export function miniPoints(days: number[], width: number, height: number): [number, number][] {
  // No céu grande (300 de largura), x vai de 28 a 272 e y fica entre 23 e 183.
  return days.map((day) => {
    const [x, y] = starPosition(day, 300);
    return [4 + ((x - 28) / 244) * (width - 8), 4 + ((y - 23) / 160) * (height - 8)];
  });
}
