import { buildExport, exportFileName } from '@/lib/export';
import type { Journal } from '@/state/journal';
import type { Settings } from '@/state/settings';

const settings = {
  onboarded: true,
  name: 'Ana',
  accentId: 'classic',
  backgroundMode: 'auto',
  nightMinutes: 22 * 60 + 30,
  morningMinutes: 7 * 60,
  language: 'pt-BR',
  keepSignedIn: true,
  bio: 'oi',
  privateAccount: false,
  muralSleeps: true,
  pushShine: true,
  pushPoke: false,
  pushMural: true,
  pushRequests: true,
} as unknown as Settings;

const journal: Journal = {
  tasks: [
    { id: 't1', title: 'Pagar a conta', day: '2026-11-05', minutes: 9 * 60, reminder: true, done: false, changedAt: 1, createdAt: 1, nightId: 'n1' },
    { id: 'ex', title: 'Exemplo', day: '2026-11-05', minutes: null, reminder: true, done: false, changedAt: 1, createdAt: 1, example: true },
  ],
  nights: [
    { id: 'n1', day: '2026-11-04', at: 1, noted: 1, via: 'voz', transcript: 'pagar a conta amanhã às 9', audioUri: 'file:///x.m4a' },
    { id: 'nx', day: '2026-11-03', at: 1, noted: 4, via: 'voz', example: true },
  ],
};

describe('buildExport (o arquivo "Exportar meus dados")', () => {
  it('leva tarefas e noites de verdade, com horários legíveis, e deixa exemplos e caminhos de fora', () => {
    const out = buildExport({ now: new Date(Date.UTC(2026, 10, 4, 12)), version: '1.0.0', language: 'pt-BR', settings, journal, account: null, network: null });
    expect(out.tasks).toHaveLength(1);
    expect(out.tasks[0]).toMatchObject({ title: 'Pagar a conta', time: '09:00', nightId: 'n1' });
    expect(out.nights).toHaveLength(1);
    expect(out.nights[0]).toMatchObject({ transcript: 'pagar a conta amanhã às 9', audioStillOnPhone: true });
    expect(JSON.stringify(out)).not.toContain('file:///');
    expect(out.settings.nightReminder).toBe('22:30');
    expect(out.account).toBeNull();
    expect(out.network).toBeNull();
  });

  it('com conta e rede, leva o perfil, quem segue quem, bloqueados e posts; sem servidor, diz "unavailable"', () => {
    const profile = { userId: 'u', handle: 'ana', name: 'Ana', bio: 'oi', private: false, code: 'ABC123', invites: 2, invited: false, followers: 1, following: 0, requests: 0 };
    const out = buildExport({
      now: new Date(), version: '1.0.0', language: 'en', settings, journal,
      account: { id: 'u', email: 'ana@example.com' },
      network: {
        profile,
        orbit: { followers: [{ userId: 'b', handle: 'bruno', name: 'Bruno', private: false, iFollow: 'none', followsMe: true, starsMonth: null, litToday: null }], following: [], requests: [] },
        blocked: [{ userId: 'c', handle: 'carla', name: 'Carla' }],
        posts: [{ id: 'p', authorId: 'u', handle: 'ana', name: 'Ana', mine: true, taskTitle: 'Correr', caption: '', photoPath: 'u/x.jpg', createdAt: '2026-11-04T10:00:00Z', iShined: false, shines: 3, shinedBy: [] }],
      },
    });
    expect(out.account).toEqual({ id: 'u', email: 'ana@example.com' });
    const network = out.network as Exclude<typeof out.network, string | null>;
    expect(network.profile).toMatchObject({ handle: 'ana', inviteCode: 'ABC123' });
    expect(network.followers).toEqual([{ handle: 'bruno', name: 'Bruno' }]);
    expect(network.blocked).toEqual([{ handle: 'carla', name: 'Carla' }]);
    expect(network.posts?.[0]).toMatchObject({ taskTitle: 'Correr', shines: 3 });
    expect(JSON.stringify(out)).not.toContain('u/x.jpg');
    expect(buildExport({ now: new Date(), version: '1', language: 'en', settings, journal, account: { id: 'u', email: null }, network: 'unavailable' }).network).toBe('unavailable');
  });

  it('nomeia o arquivo pelo dia local', () => {
    expect(exportFileName(new Date(2026, 10, 4, 23, 30))).toBe('mindfree-dados-2026-11-04.json');
  });
});
