/**
 * Separa um texto livre em tarefas, sem IA: cada linha, vírgula ou ponto vira uma tarefa,
 * e horários ("às 9", "10h", "18:30") e dias ("hoje", "amanhã", "sexta") são reconhecidos.
 * É o que o "Prefere escrever?" usa enquanto a organização com IA não chega.
 */

export type TaskDraft = {
  title: string;
  minutes: number | null;
  /** `null`: o dia padrão (amanhã, se for à noite). Número: dias a partir de hoje. */
  dayOffset: number | null;
};

// Limites de palavra que entendem acentos (o \b do JavaScript só conhece letras sem acento).
const B = String.raw`(?<![\p{L}\d])`;
const E = String.raw`(?![\p{L}\d])`;
const word = (body: string) => new RegExp(`${B}(?:${body})${E}`, 'iu');

const FILLERS = [
  /^(?:e\s+)?(?:eu\s+)?(?:preciso|tenho que|tenho de|devo|vou|quero|lembrar de|não esquecer de|nao esquecer de)\s+/iu,
  /^(?:and\s+)?(?:i\s+)?(?:need to|have to|must|should|remember to|don't forget to)\s+/iu,
  /^(?:tengo que|necesito|debo)\s+/iu,
];

const TODAY = word(`hoje|today|hoy|aujourd'hui|heute|oggi`);
const TOMORROW = word('amanhã|amanha|tomorrow|mañana|demain|morgen|domani');
// Domingo = 0, como Date.getDay().
const WEEKDAYS: [RegExp, number][] = [
  [word('domingo|sunday|dimanche|sonntag|domenica'), 0],
  [word('segunda(?:-feira)?|monday|lunes|lundi|montag|lunedì'), 1],
  [word('terça(?:-feira)?|terca(?:-feira)?|tuesday|martes|mardi|dienstag|martedì'), 2],
  [word('quarta(?:-feira)?|wednesday|miércoles|mercredi|mittwoch|mercoledì'), 3],
  [word('quinta(?:-feira)?|thursday|jueves|jeudi|donnerstag|giovedì'), 4],
  [word('sexta(?:-feira)?|friday|viernes|vendredi|freitag|venerdì'), 5],
  [word('sábado|sabado|saturday|samedi|samstag|sabato'), 6],
];
const DAY_PREFIX = new RegExp(String.raw`${B}(?:na|no|de|on|el|le|am|il)\s+$`, 'iu');

// "às 9", "as 18:30", "at 7", "a las 10"; ou "10h", "10h30", "18:30".
const TIME_AFTER_WORD = new RegExp(
  String.raw`${B}(?:às|as|at|a las|à|um|alle)\s+(\d{1,2})(?:[:h](\d{2}))?\s*(?:h|hs|horas|hrs|pm|am)?${E}`,
  'iu',
);
const TIME_ALONE = new RegExp(String.raw`${B}(\d{1,2})(?::(\d{2})|h(\d{2})?)(?:\s*(?:hs|horas))?${E}`, 'iu');
const PM = /(\d{1,2})(?::\d{2})?\s*pm/iu;

function readTime(piece: string): { minutes: number | null; rest: string } {
  const match = piece.match(TIME_AFTER_WORD) ?? piece.match(TIME_ALONE);
  if (!match) return { minutes: null, rest: piece };
  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? match[3] ?? 0);
  if (PM.test(match[0]) && hours < 12) hours += 12;
  if (hours > 23 || minutes > 59) return { minutes: null, rest: piece };
  return { minutes: hours * 60 + minutes, rest: piece.replace(match[0], ' ') };
}

function readDay(piece: string, today: Date): { dayOffset: number | null; rest: string } {
  if (TOMORROW.test(piece)) return { dayOffset: 1, rest: piece.replace(TOMORROW, ' ') };
  if (TODAY.test(piece)) return { dayOffset: 0, rest: piece.replace(TODAY, ' ') };
  for (const [pattern, weekday] of WEEKDAYS) {
    const match = piece.match(pattern);
    if (match) {
      const ahead = (weekday - today.getDay() + 7) % 7 || 7;
      const before = piece.slice(0, match.index).replace(DAY_PREFIX, '');
      return { dayOffset: ahead, rest: before + ' ' + piece.slice((match.index ?? 0) + match[0].length) };
    }
  }
  return { dayOffset: null, rest: piece };
}

function tidy(text: string): string {
  let title = text.replace(/\s+/g, ' ').trim().replace(/^[-•*·]\s*/, '');
  for (const filler of FILLERS) title = title.replace(filler, '');
  title = title.replace(/\s+(?:na|no|de|à|às|para|pra|on|at)$/i, '').replace(/[.!?;:]+$/, '').trim();
  return title ? title.charAt(0).toLocaleUpperCase() + title.slice(1) : '';
}

export function parseTasks(text: string, today = new Date()): TaskDraft[] {
  return text
    .split(/\n|;|,|\.\s+|\.$/)
    .map((piece) => {
      const time = readTime(piece);
      const day = readDay(time.rest, today);
      return { title: tidy(day.rest), minutes: time.minutes, dayOffset: day.dayOffset };
    })
    .filter((draft) => draft.title.length > 1);
}
