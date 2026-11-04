import type { CloudPost } from '@/lib/mural';
import type { BlockedPerson, Orbit, SocialProfile } from '@/lib/social';
import { formatMinutes } from '@/lib/time';
import type { Journal } from '@/state/journal';
import type { Settings } from '@/state/settings';

/** O que a rede guarda sobre a pessoa; `'unavailable'` quando o servidor não respondeu na hora de exportar. */
export type ExportNetwork =
  | { profile: SocialProfile; orbit: Orbit | null; blocked: BlockedPerson[] | null; posts: CloudPost[] | null }
  | 'unavailable'
  | null;

export type ExportInput = {
  now: Date;
  version: string;
  language: string;
  settings: Settings;
  journal: Journal;
  account: { id: string; email: string | null } | null;
  network: ExportNetwork;
};

const person = (p: { handle: string; name: string }) => ({ handle: p.handle, name: p.name });

/**
 * Monta o arquivo "Exportar meus dados" (direito de acesso e portabilidade da LGPD): tudo o que o app
 * guarda sobre a pessoa, legível, sem caminhos de arquivo nem exemplos. O áudio não vai: ele some do
 * celular 7 dias depois de organizado, e o texto dele já está aqui.
 */
export function buildExport(input: ExportInput) {
  const { settings, journal, network } = input;
  return {
    app: 'MindFree',
    version: input.version,
    exportedAt: input.now.toISOString(),
    language: input.language,
    settings: {
      name: settings.name,
      language: settings.language,
      nightReminder: formatMinutes(settings.nightMinutes),
      morningSummary: formatMinutes(settings.morningMinutes),
      accent: settings.accentId,
      background: settings.backgroundMode,
      keepSignedIn: settings.keepSignedIn,
      bio: settings.bio,
      privateAccount: settings.privateAccount,
      muralSleeps: settings.muralSleeps,
      friendAlerts: { shine: settings.pushShine, poke: settings.pushPoke, mural: settings.pushMural, requests: settings.pushRequests },
    },
    tasks: journal.tasks
      .filter((task) => !task.example)
      .map((task) => ({
        id: task.id,
        title: task.title,
        note: task.note ?? null,
        day: task.day,
        time: task.minutes === null ? null : formatMinutes(task.minutes),
        reminder: task.reminder,
        done: task.done,
        createdAt: new Date(task.createdAt).toISOString(),
        changedAt: new Date(task.changedAt).toISOString(),
        nightId: task.nightId ?? null,
      })),
    nights: journal.nights
      .filter((night) => !night.example)
      .map((night) => ({
        id: night.id,
        day: night.day,
        at: new Date(night.at).toISOString(),
        via: night.via,
        noted: night.noted,
        transcript: night.transcript ?? null,
        pending: !!night.pending,
        audioStillOnPhone: !!night.audioUri,
      })),
    account: input.account ? { id: input.account.id, email: input.account.email } : null,
    network:
      network === 'unavailable'
        ? 'unavailable'
        : network
          ? {
              profile: {
                handle: network.profile.handle,
                name: network.profile.name,
                bio: network.profile.bio,
                private: network.profile.private,
                inviteCode: network.profile.code,
                invitesUsed: network.profile.invites,
              },
              followers: network.orbit ? network.orbit.followers.map(person) : null,
              following: network.orbit ? network.orbit.following.map(person) : null,
              requests: network.orbit ? network.orbit.requests.map(person) : null,
              blocked: network.blocked ? network.blocked.map(person) : null,
              posts: network.posts
                ? network.posts.map((post) => ({ id: post.id, taskTitle: post.taskTitle, caption: post.caption, createdAt: post.createdAt, shines: post.shines }))
                : null,
            }
          : null,
  };
}

/** O nome do arquivo: `mindfree-dados-AAAA-MM-DD.json`, no dia local. */
export function exportFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `mindfree-dados-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}
