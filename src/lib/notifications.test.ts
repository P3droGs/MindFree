import { morningBody, nextOccurrence } from '@/lib/notifications';
import type { Journal, Task } from '@/state/journal';
import { fakeT } from '@/test/setup';

jest.mock('expo-notifications', () => ({}), { virtual: true });

const t = fakeT as never;
const task = (id: string, day: string, minutes: number | null, extra: Partial<Task> = {}): Task => ({
  id, title: id, day, minutes, reminder: true, done: false, changedAt: 1, createdAt: 1, ...extra,
});

describe('nextOccurrence', () => {
  it('hoje se o horário ainda não passou; senão amanhã', () => {
    const now = new Date(2026, 10, 4, 9, 0);
    expect(nextOccurrence(now, 22 * 60 + 30)).toEqual(new Date(2026, 10, 4, 22, 30));
    expect(nextOccurrence(now, 7 * 60)).toEqual(new Date(2026, 10, 5, 7, 0));
    expect(nextOccurrence(now, 9 * 60)).toEqual(new Date(2026, 10, 5, 9, 0));
  });
});

describe('morningBody (o resumo da manhã com as tarefas)', () => {
  it('sem tarefas, o convite de sempre', () => {
    expect(morningBody({ tasks: [], nights: [] }, '2026-11-05', t)).toBe('notif.morningBody');
  });

  it('até 3 tarefas do dia, com horário quando têm, na ordem do dia', () => {
    const j: Journal = { tasks: [task('Comprar pão', '2026-11-05', null), task('Dentista', '2026-11-05', 600), task('Academia', '2026-11-05', 420)], nights: [] };
    expect(morningBody(j, '2026-11-05', t)).toBe('07:00 Academia · 10:00 Dentista · Comprar pão');
  });

  it('com mais de 3, diz quantas sobram; feitas e exemplos ficam de fora', () => {
    const j: Journal = {
      tasks: [task('a', '2026-11-05', 540), task('b', '2026-11-05', 600), task('c', '2026-11-05', 660), task('d', '2026-11-05', 720), task('feita', '2026-11-05', 480, { done: true }), task('ex', '2026-11-05', 480, { example: true }), task('outro dia', '2026-11-06', 480)],
      nights: [],
    };
    expect(morningBody(j, '2026-11-05', t)).toBe('notif.morningTasksMore(list=09:00 a · 10:00 b · 11:00 c,n=1)');
  });
});
