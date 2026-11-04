import { nextModeChanges, nextUp, remainingLabel, visibleTasks, widgetModeAt, type MindFreeWidgetProps, type WidgetTask } from '@/widgets/widget-content';

const NIGHT = 22 * 60 + 30;
const MORNING = 7 * 60;
const task = (id: string, done = false, time = '09:00'): WidgetTask => ({ id, title: id, time, done, changedAt: 1 });
const props = (tasks: WidgetTask[]): MindFreeWidgetProps => ({
  mode: 'dia', tasks, doneToday: 0, nightTime: '22:30', morningTime: '07:00',
  palette: { dayAccent: '#000', nightAccent: '#000', nightOnAccent: '#fff', nightAccentText: '#000' },
  labels: { today: 'Hoje', next: 'Próxima', record: 'Gravar', nightTitle: '', freeDay: 'livre', allDone: 'tudo', leftOne: 'falta 1', leftMany: 'faltam {n}', noTasks: '', emptyDay: '', allDoneToday: 'feito', nightMessage: '', check: '', uncheck: '' },
});

describe('widgetModeAt / nextModeChanges', () => {
  it('é noite do lembrete até o resumo, passando pela meia-noite', () => {
    expect(widgetModeAt(new Date(2026, 10, 4, 23), NIGHT, MORNING)).toBe('noite');
    expect(widgetModeAt(new Date(2026, 10, 5, 3), NIGHT, MORNING)).toBe('noite');
    expect(widgetModeAt(new Date(2026, 10, 5, 7), NIGHT, MORNING)).toBe('dia');
    expect(widgetModeAt(new Date(2026, 10, 5, 12), 600, 600)).toBe('dia');
  });
  it('as próximas trocas vêm em ordem e no futuro', () => {
    const from = new Date(2026, 10, 4, 12);
    const changes = nextModeChanges(from, NIGHT, MORNING, 3);
    expect(changes.map((d) => d.getTime())).toEqual([new Date(2026, 10, 4, 22, 30), new Date(2026, 10, 5, 7), new Date(2026, 10, 5, 22, 30)].map((d) => d.getTime()));
    expect(nextModeChanges(from, 600, 600, 3)).toEqual([]);
  });
});

describe('o que o widget mostra', () => {
  it('visibleTasks: até 3, as pendentes primeiro', () => {
    const list = [task('a', true), task('b'), task('c', true), task('d'), task('e')];
    expect(visibleTasks(list).map((t) => t.id)).toEqual(['b', 'd', 'e']);
    expect(visibleTasks(list.slice(0, 2)).map((t) => t.id)).toEqual(['a', 'b']);
  });
  it('remainingLabel e nextUp', () => {
    expect(remainingLabel(props([]))).toBe('livre');
    expect(remainingLabel(props([task('a', true)]))).toBe('tudo');
    expect(remainingLabel(props([task('a'), task('b')]))).toBe('faltam 2');
    expect(nextUp(props([task('a', true), task('b', false, '')]))).toEqual({ title: 'b', time: 'Hoje' });
    expect(nextUp(props([task('a', true)]))).toEqual({ title: 'feito', time: '✓' });
    expect(nextUp(props([]))).toEqual({ title: 'Gravar', time: '22:30' });
  });
});
