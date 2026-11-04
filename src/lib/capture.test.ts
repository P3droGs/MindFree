import { captureOrganized, captureText, defaultTaskDay, eveningDay, nightMoment, pendingNight } from '@/lib/capture';
import type { Journal } from '@/state/journal';

const EMPTY: Journal = { tasks: [], nights: [] };
const MORNING = 7 * 60;
const night = (h: number, m = 0) => new Date(2026, 10, 4, h, m);

describe('eveningDay e defaultTaskDay', () => {
  it('depois da meia-noite e antes do resumo, a noite ainda é a de ontem', () => {
    expect(eveningDay(night(23), MORNING)).toBe('2026-11-04');
    expect(eveningDay(new Date(2026, 10, 5, 1), MORNING)).toBe('2026-11-04');
    expect(eveningDay(new Date(2026, 10, 5, 7), MORNING)).toBe('2026-11-05');
  });

  it('de noite as tarefas sem dia vão para a manhã seguinte; de dia, para hoje', () => {
    expect(defaultTaskDay(night(22), MORNING)).toBe('2026-11-05');
    expect(defaultTaskDay(new Date(2026, 10, 5, 2), MORNING)).toBe('2026-11-05');
    expect(defaultTaskDay(new Date(2026, 10, 4, 15), MORNING)).toBe('2026-11-04');
  });
});

describe('captureText', () => {
  it('cria uma noite e as tarefas, com o dia certo para cada uma', () => {
    const { journal, noted } = captureText(EMPTY, 'pagar o boleto amanhã às 9, comprar pão', night(22), MORNING);
    expect(noted).toBe(2);
    expect(journal.nights).toHaveLength(1);
    expect(journal.nights[0]).toMatchObject({ day: '2026-11-04', via: 'texto', noted: 2, transcript: 'pagar o boleto amanhã às 9, comprar pão' });
    expect(journal.tasks.map((t) => [t.title, t.day, t.minutes])).toEqual([
      ['Pagar o boleto', '2026-11-05', 540],
      ['Comprar pão', '2026-11-05', null],
    ]);
    expect(journal.tasks.every((t) => t.nightId === journal.nights[0].id)).toBe(true);
  });
});

describe('captureOrganized (o que a IA devolve)', () => {
  const result = {
    transcript: 'falei bastante',
    tasks: [
      { title: ' Ligar pro dentista ', note: 'antes do almoço', date: '2026-11-05', time: '10:00' },
      { title: 'Data inválida vai para o dia padrão', note: '', date: '2020-01-01', time: '' },
      { title: 'Hora inválida fica sem lembrete', note: '', date: '2026-11-06', time: '25:00' },
    ],
  };

  it('aceita datas futuras válidas e corrige as inválidas', () => {
    const { journal } = captureOrganized(EMPTY, result, { via: 'voz', audioUri: 'file:///a.m4a' }, night(22), MORNING);
    expect(journal.tasks.map((t) => [t.title, t.day, t.minutes, t.reminder])).toEqual([
      ['Ligar pro dentista', '2026-11-05', 600, true],
      ['Data inválida vai para o dia padrão', '2026-11-05', null, false],
      ['Hora inválida fica sem lembrete', '2026-11-06', null, false],
    ]);
    expect(journal.nights[0]).toMatchObject({ via: 'voz', audioUri: 'file:///a.m4a', transcript: 'falei bastante', noted: 3 });
  });

  it('completa uma noite pendente em vez de criar outra', () => {
    const pending = pendingNight(EMPTY, 'file:///p.m4a', night(23), MORNING);
    const id = pending.nights[0].id;
    const { journal } = captureOrganized(pending, result, { via: 'voz', nightId: id }, night(23), MORNING);
    expect(journal.nights).toHaveLength(1);
    expect(journal.nights[0]).toMatchObject({ id, pending: false, noted: 3, transcript: 'falei bastante', audioUri: 'file:///p.m4a' });
    expect(journal.tasks.every((t) => t.nightId === id)).toBe(true);
  });
});

describe('nightMoment', () => {
  it('reconstrói o momento da gravação, inclusive depois da meia-noite', () => {
    expect(nightMoment({ id: 'n', day: '2026-11-04', at: 23 * 60 + 15, noted: 0, via: 'voz' }, MORNING)).toEqual(new Date(2026, 10, 4, 23, 15));
    expect(nightMoment({ id: 'n', day: '2026-11-04', at: 60, noted: 0, via: 'voz' }, MORNING)).toEqual(new Date(2026, 10, 5, 1, 0));
  });
});
