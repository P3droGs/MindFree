import Storage from 'expo-sqlite/kv-store';

import {
  addDays,
  dayKey,
  expiredRecordings,
  forgetRecordings,
  loadJournal,
  mondayOf,
  nightProgress,
  nightStreak,
  saveJournalNow,
  setTaskDone,
  starsInMonth,
  tasksOfDay,
  weekNights,
  type Journal,
  type Night,
  type Task,
} from '@/state/journal';

const DAY = 24 * 60 * 60 * 1000;
const task = (id: string, day: string, extra: Partial<Task> = {}): Task => ({
  id, title: id, day, minutes: null, reminder: false, done: false, changedAt: 1, createdAt: 1, ...extra,
});
const night = (id: string, day: string, extra: Partial<Night> = {}): Night => ({ id, day, at: 1320, noted: 1, via: 'voz', ...extra });

describe('datas', () => {
  it('dayKey/addDays/mondayOf', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(mondayOf('2026-11-04')).toBe('2026-11-02');
    expect(mondayOf('2026-11-08')).toBe('2026-11-02');
    expect(mondayOf('2026-11-02')).toBe('2026-11-02');
  });
});

describe('tarefas', () => {
  it('tasksOfDay ordena por horário e deixa as sem horário por último', () => {
    const j: Journal = { tasks: [task('c', '2026-11-04'), task('a', '2026-11-04', { minutes: 600 }), task('b', '2026-11-04', { minutes: 540 }), task('x', '2026-11-05')], nights: [] };
    expect(tasksOfDay(j, '2026-11-04').map((t) => t.id)).toEqual(['b', 'a', 'c']);
  });

  it('setTaskDone muda só a tarefa e marca a hora', () => {
    const j: Journal = { tasks: [task('a', '2026-11-04'), task('b', '2026-11-04')], nights: [] };
    const next = setTaskDone(j, 'a', true, 999);
    expect(next.tasks[0]).toMatchObject({ done: true, changedAt: 999 });
    expect(next.tasks[1]).toBe(j.tasks[1]);
  });
});

describe('noites e estrelas', () => {
  it('duas gravações no mesmo dia são uma estrela só', () => {
    const j: Journal = { tasks: [], nights: [night('n1', '2026-11-03'), night('n2', '2026-11-03'), night('n3', '2026-11-04')] };
    expect(starsInMonth(j, new Date(2026, 10, 10))).toBe(2);
  });

  it('nightProgress soma as tarefas das gravações do mesmo dia', () => {
    const j: Journal = {
      tasks: [task('a', '2026-11-05', { nightId: 'n1', done: true }), task('b', '2026-11-05', { nightId: 'n2' })],
      nights: [night('n1', '2026-11-04'), night('n2', '2026-11-04')],
    };
    expect(nightProgress(j, j.nights[0])).toEqual({ noted: 2, done: 1 });
  });

  it('nightStreak conta noites seguidas, a partir de ontem se hoje ainda não acendeu', () => {
    const j: Journal = { tasks: [], nights: [night('a', '2026-11-01'), night('b', '2026-11-02'), night('c', '2026-11-03')] };
    expect(nightStreak(j, '2026-11-03')).toBe(3);
    expect(nightStreak(j, '2026-11-04')).toBe(3);
    expect(nightStreak(j, '2026-11-06')).toBe(0);
  });

  it('weekNights marca de segunda a domingo', () => {
    const j: Journal = { tasks: [], nights: [night('a', '2026-11-02'), night('b', '2026-11-04')] };
    expect(weekNights(j, '2026-11-04')).toEqual([true, false, true, false, false, false, false]);
  });
});

describe('áudio sai 7 dias depois de organizado', () => {
  const now = Date.UTC(2026, 10, 4, 12);
  const j: Journal = {
    tasks: [],
    nights: [
      night('velha', '2026-10-20', { audioUri: 'file:///v.m4a', changedAt: now - 8 * DAY, transcript: 'x' }),
      night('recente', '2026-10-30', { audioUri: 'file:///r.m4a', changedAt: now - 6 * DAY }),
      night('pendente', '2026-10-01', { audioUri: 'file:///p.m4a', changedAt: now - 30 * DAY, pending: true }),
      night('exemplo', '2026-10-01', { audioUri: 'file:///e.m4a', changedAt: now - 30 * DAY, example: true }),
      night('sem-audio', '2026-10-01', { changedAt: now - 30 * DAY }),
    ],
  };

  it('só a organizada há mais de 7 dias vence; pendente e exemplo nunca', () => {
    expect(expiredRecordings(j, now).map((n) => n.id)).toEqual(['velha']);
  });

  it('forgetRecordings tira o áudio e mantém texto, changedAt e as outras noites', () => {
    const next = forgetRecordings(j, new Set(['velha']));
    expect(next.nights[0]).toMatchObject({ transcript: 'x', changedAt: now - 8 * DAY });
    expect(next.nights[0].audioUri).toBeUndefined();
    expect(next.nights[1]).toBe(j.nights[1]);
  });
});

describe('guardar e ler', () => {
  it('lê o que gravou, completando tarefas antigas sem reminder/createdAt', () => {
    Storage.setItemSync('mindfree.journal.v1', JSON.stringify({ tasks: [{ id: 't', title: 'T', day: '2026-11-04', minutes: null, done: false, changedAt: 5 }], nights: ['2026-11-03'] }));
    const j = loadJournal();
    expect(j.tasks[0]).toMatchObject({ reminder: true, createdAt: 5 });
    expect(j.nights[0]).toMatchObject({ id: 'noite-2026-11-03', day: '2026-11-03' });
  });

  it('saveJournalNow grava na hora e loadJournal devolve igual', () => {
    const j: Journal = { tasks: [task('a', '2026-11-04')], nights: [night('n', '2026-11-04')] };
    saveJournalNow(j);
    expect(loadJournal()).toEqual(j);
  });

  it('sem nada gravado ou com JSON quebrado, volta vazio', () => {
    expect(loadJournal()).toEqual({ tasks: [], nights: [] });
    Storage.setItemSync('mindfree.journal.v1', '{quebrado');
    expect(loadJournal()).toEqual({ tasks: [], nights: [] });
  });
});
