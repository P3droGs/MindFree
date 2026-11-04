import { constellationName, customName, miniPoints, pastConstellations, starPosition, suggestedName } from '@/lib/constellations';
import { aiAllowed, CONSENT_VERSION, shouldAskConsent } from '@/lib/consent';
import { dayTitle, longDate, timeAgo } from '@/lib/dates';
import { forget, remembered } from '@/lib/remembered';
import { formatMinutes, greetingKey, isNight, minutesOfDay } from '@/lib/time';
import { isValidEmail, passwordStrength } from '@/lib/validation';
import { fakeT } from '@/test/setup';

const t = fakeT as never;

describe('time', () => {
  it('formatMinutes e minutesOfDay', () => {
    expect(formatMinutes(0)).toBe('00:00');
    expect(formatMinutes(9 * 60 + 5)).toBe('09:05');
    expect(minutesOfDay(new Date(2026, 0, 1, 22, 30))).toBe(1350);
  });
  it('isNight: das 18h até o resumo da manhã', () => {
    expect(isNight(new Date(2026, 0, 1, 18), 420)).toBe(true);
    expect(isNight(new Date(2026, 0, 1, 6, 59), 420)).toBe(true);
    expect(isNight(new Date(2026, 0, 1, 7), 420)).toBe(false);
    expect(isNight(new Date(2026, 0, 1, 12), 420)).toBe(false);
  });
  it('greetingKey', () => {
    expect(greetingKey(new Date(2026, 0, 1, 8))).toBe('greeting.morning');
    expect(greetingKey(new Date(2026, 0, 1, 13))).toBe('greeting.afternoon');
    expect(greetingKey(new Date(2026, 0, 1, 21))).toBe('greeting.night');
    expect(greetingKey(new Date(2026, 0, 1, 3))).toBe('greeting.night');
  });
});

describe('dates', () => {
  it('longDate, dayTitle e timeAgo pedem as chaves certas', () => {
    expect(longDate(t, '2026-11-04')).toBe('date.long(weekday=weekday.3,day=4,month=month.11)');
    expect(dayTitle(t, '2026-11-04', '2026-11-04', '2026-11-05')).toContain('date.today');
    expect(dayTitle(t, '2026-11-05', '2026-11-04', '2026-11-05')).toContain('date.tomorrow');
    const h = 3_600_000;
    expect(timeAgo(t, 0, 10 * 60_000)).toBe('mural.justNow');
    expect(timeAgo(t, 0, 3 * h)).toBe('mural.hoursAgo(n=3)');
    expect(timeAgo(t, 0, 25 * h)).toBe('mural.daysAgoOne');
    expect(timeAgo(t, 0, 49 * h)).toBe('mural.daysAgoTwo');
    expect(timeAgo(t, 0, 80 * h)).toBe('mural.daysAgo(n=3)');
  });
});

describe('validation', () => {
  it('isValidEmail e passwordStrength', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail(' a@b.com ')).toBe(true);
    expect(passwordStrength('')).toBe(0);
    expect(passwordStrength('curta')).toBe(1);
    expect(passwordStrength('somenteminusculas')).toBe(3);
    expect(passwordStrength('Abc12345')).toBe(3);
    expect(passwordStrength('abcdefgh')).toBe(2);
  });
});

describe('consent', () => {
  it('só com "granted" na versão atual a IA é permitida; versão velha pergunta de novo', () => {
    expect(aiAllowed({ aiConsent: 'granted', aiConsentVersion: CONSENT_VERSION })).toBe(true);
    expect(aiAllowed({ aiConsent: 'declined', aiConsentVersion: CONSENT_VERSION })).toBe(false);
    expect(aiAllowed({ aiConsent: 'granted', aiConsentVersion: CONSENT_VERSION - 1 })).toBe(false);
    expect(shouldAskConsent({ aiConsent: 'unknown', aiConsentVersion: 0 })).toBe(true);
    expect(shouldAskConsent({ aiConsent: 'granted', aiConsentVersion: CONSENT_VERSION - 1 })).toBe(true);
    expect(shouldAskConsent({ aiConsent: 'declined', aiConsentVersion: 0 })).toBe(false);
  });
});

describe('constellations', () => {
  it('nome sugerido não repete em meses seguidos e dá a volta em 16', () => {
    const a = suggestedName(t, '2026-01');
    expect(a).not.toBe(suggestedName(t, '2026-02'));
    expect(a).toBe(suggestedName(t, '2027-05'));
  });
  it('nome da pessoa vence o sugerido, limpo e cortado; estranho é ignorado', () => {
    expect(customName({ '2026-01': '  Minha  ' }, '2026-01')).toBe('Minha');
    expect(customName({ '2026-01': 'x'.repeat(50) }, '2026-01')).toHaveLength(30);
    expect(customName({ '2026-01': 42 }, '2026-01')).toBe('');
    expect(constellationName(t, {}, '2026-01')).toBe(suggestedName(t, '2026-01'));
  });
  it('pastConstellations agrupa por mês passado, do mais recente para o mais antigo', () => {
    const j = { tasks: [], nights: [{ id: 'a', day: '2026-09-03', at: 0, noted: 0, via: 'voz' as const }, { id: 'b', day: '2026-09-03', at: 0, noted: 0, via: 'voz' as const }, { id: 'c', day: '2026-10-20', at: 0, noted: 0, via: 'voz' as const }, { id: 'd', day: '2026-11-01', at: 0, noted: 0, via: 'voz' as const }] };
    expect(pastConstellations(j, '2026-11')).toEqual([{ month: '2026-10', days: [20] }, { month: '2026-09', days: [3] }]);
  });
  it('starPosition fica dentro do céu e miniPoints dentro da miniatura', () => {
    for (let day = 1; day <= 31; day++) {
      const [x, y] = starPosition(day, 300);
      expect(x).toBeGreaterThanOrEqual(28);
      expect(x).toBeLessThanOrEqual(272);
      expect(y).toBeGreaterThan(0);
    }
    for (const [x, y] of miniPoints([1, 15, 31], 52, 36)) {
      expect(x).toBeGreaterThanOrEqual(4);
      expect(x).toBeLessThanOrEqual(48);
      expect(y).toBeGreaterThanOrEqual(4);
      expect(y).toBeLessThanOrEqual(32);
    }
  });
});

describe('remembered (cache de 30 s)', () => {
  beforeEach(() => forget());
  it('lembra, esquece por prefixo e "fresh" força a ida ao servidor', async () => {
    let calls = 0;
    const load = async () => ++calls;
    expect(await remembered('a.x', load)).toBe(1);
    expect(await remembered('a.x', load)).toBe(1);
    expect(await remembered('a.x', load, true)).toBe(2);
    forget('b.');
    expect(await remembered('a.x', load)).toBe(2);
    forget('a.');
    expect(await remembered('a.x', load)).toBe(3);
  });
});
