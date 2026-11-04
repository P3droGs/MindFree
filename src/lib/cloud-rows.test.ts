import { mergeRemote, toNightRow, toTaskRow } from '@/lib/cloud-rows';
import type { Journal, Night, Task } from '@/state/journal';

const task = (id: string, changedAt: number, extra: Partial<Task> = {}): Task => ({
  id, title: id, day: '2026-11-04', minutes: null, reminder: false, done: false, changedAt, createdAt: changedAt, ...extra,
});
const night = (id: string, changedAt: number, extra: Partial<Night> = {}): Night => ({ id, day: '2026-11-04', at: 1320, noted: 1, via: 'voz', changedAt, ...extra });
const none = { tasks: new Set<string>(), nights: new Set<string>() };

describe('toTaskRow/toNightRow', () => {
  it('corta os textos nos limites do servidor e nunca manda áudio ou transcrição', () => {
    const row = toTaskRow(task('a', 1000, { title: 'x'.repeat(300), note: 'y'.repeat(400) }), 'u');
    expect(row.title).toHaveLength(200);
    expect(row.note).toHaveLength(300);
    const n = toNightRow(night('n', 1000, { noted: 500, audioUri: 'file:///a', transcript: 'segredo' }), 'u');
    expect(n.noted).toBe(100);
    expect(JSON.stringify(n)).not.toContain('segredo');
    expect(JSON.stringify(n)).not.toContain('file:///');
  });
});

describe('mergeRemote: a última mudança vence', () => {
  const local: Journal = { tasks: [task('a', 2000, { title: 'local' })], nights: [night('n', 2000, { transcript: 'só aqui', audioUri: 'file:///n' })] };
  const row = (changedAt: number, extra = {}) => ({ ...toTaskRow(task('a', changedAt, { title: 'nuvem' }), 'u'), ...extra });

  it('a nuvem mais nova substitui; a mais velha é ignorada', () => {
    expect(mergeRemote(local, [row(3000)], [], none).tasks[0].title).toBe('nuvem');
    expect(mergeRemote(local, [row(1000)], [], none)).toBe(local);
  });

  it('apagada na nuvem some aqui, só se a nuvem for mais nova', () => {
    expect(mergeRemote(local, [row(3000, { deleted_at: 'x' })], [], none).tasks).toHaveLength(0);
    expect(mergeRemote(local, [row(1000, { deleted_at: 'x' })], [], none).tasks).toHaveLength(1);
  });

  it('o que foi apagado aqui e ainda não subiu não volta', () => {
    const pending = { tasks: new Set(['a']), nights: new Set<string>() };
    expect(mergeRemote({ tasks: [], nights: [] }, [row(3000)], [], pending).tasks).toHaveLength(0);
  });

  it('uma noite que chega da nuvem mantém a transcrição e o áudio locais', () => {
    const remote = toNightRow(night('n', 3000, { noted: 7 }), 'u');
    const merged = mergeRemote(local, [], [remote], none);
    expect(merged.nights[0]).toMatchObject({ noted: 7, transcript: 'só aqui', audioUri: 'file:///n' });
  });
});
