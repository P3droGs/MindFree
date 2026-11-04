import { supabase } from '@/lib/supabase';

/** O seu perfil na rede, com os números. */
export type SocialProfile = {
  userId: string;
  handle: string;
  name: string;
  bio: string;
  private: boolean;
  /** Seu código de convite (6 letras e números). */
  code: string;
  /** Quantas pessoas entraram pelo seu convite. */
  invites: number;
  /** Você entrou pelo convite de alguém. */
  invited: boolean;
  followers: number;
  following: number;
  /** Pedidos esperando a sua aprovação. */
  requests: number;
  /** A moderação suspendeu a conta na rede: o app mostra o aviso em vez da parte social. */
  suspended?: boolean;
};

export type FollowState = 'none' | 'pending' | 'accepted';

/** Outra pessoa da rede. As estrelas só vêm quando você a segue (aprovado). */
export type Person = {
  userId: string;
  handle: string;
  name: string;
  private: boolean;
  iFollow: FollowState;
  followsMe: boolean;
  starsMonth: number | null;
  litToday: boolean | null;
};

/** Alguém que você segue, no céu da semana: só os dias com estrela. */
export type Friend = {
  userId: string;
  handle: string;
  name: string;
  /** Dias com estrela, AAAA-MM-DD. */
  days: string[];
  shined: boolean;
  poked: boolean;
};

export type Activity = {
  kind: 'shine' | 'poke' | 'follow';
  userId: string;
  handle: string;
  name: string;
  at: string;
};

export type Orbit = { followers: Person[]; following: Person[]; requests: Person[] };

/** Alguém que você bloqueou (só o @ e o nome, para desbloquear). */
export type BlockedPerson = { userId: string; handle: string; name: string };

export const REPORT_REASONS = ['spam', 'offensive', 'harassment', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Um aviso da moderação para a própria pessoa (nunca diz quem denunciou). */
export type ModerationNotice = {
  id: number;
  kind: 'post_removed' | 'suspended' | 'unsuspended';
  reason: string;
  /** No post apagado: a tarefa do post. */
  detail: string;
};

export type SocialFailure =
  | 'no_account'
  | 'no_profile'
  | 'handle_invalid'
  | 'handle_taken'
  | 'code_not_found'
  | 'own_code'
  | 'too_many'
  | 'photo_missing'
  | 'flagged'
  | 'suspended'
  | 'not_found'
  | 'network'
  | 'unknown';

export class SocialError extends Error {
  constructor(readonly failure: SocialFailure) {
    super(failure);
  }
}

/** Mesmo formato que o servidor aceita: 3 a 30 caracteres, letras minúsculas, números, ponto e _. */
const HANDLE = /^[a-z0-9](?:[a-z0-9._]{1,28}[a-z0-9])$/;

export function normalizeHandle(input: string): string {
  return input.trim().replace(/^@+/, '').toLowerCase();
}

export function isValidHandle(handle: string): boolean {
  return HANDLE.test(handle);
}

/** O nome que aparece: o nome, ou o @ quando a pessoa não pôs nome. */
export function displayName(person: { name: string; handle: string }): string {
  return person.name.trim() || `@${person.handle}`;
}

export function initialOf(person: { name: string; handle: string }): string {
  return (person.name.trim()[0] ?? person.handle[0] ?? '?').toLocaleUpperCase();
}

/** Cor do planeta de cada pessoa: sempre a mesma para o mesmo @. */
const PLANET_COLORS = ['#FFD27A', '#8FE3C1', '#FFB8CF', '#A6D2FF', '#7FDBB6', '#FFB38A', '#C7B8FF', '#8EC5FF'];
export function planetColor(userId: string): string {
  let hash = 0;
  for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PLANET_COLORS[hash % PLANET_COLORS.length];
}

function failureOf(error: { message?: string; code?: string } | null): SocialFailure {
  const message = error?.message ?? '';
  const match = /mindfree:([a-z_]+)/.exec(message);
  if (match) return (match[1] as SocialFailure) ?? 'unknown';
  if (/network|fetch|timeout/i.test(message)) return 'network';
  return 'unknown';
}

/** O que dizer quando uma ação da rede falha: "calma" quando bateu no limite por minuto; senão, "sem internet". */
export function failureText(error: unknown, t: (key: 'social.tooMany' | 'social.offline') => string): string {
  return t(error instanceof SocialError && error.failure === 'too_many' ? 'social.tooMany' : 'social.offline');
}

export async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new SocialError('network');
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new SocialError(failureOf(error));
  return data as T;
}

export const social = {
  /** Nulo: a conta ainda não entrou na rede (não escolheu o @). */
  profile: () => call<SocialProfile | null>('social_profile'),
  saveProfile: (input: { handle: string; name: string; bio: string; private: boolean }) =>
    call<SocialProfile>('social_save_profile', {
      p_handle: input.handle,
      p_name: input.name,
      p_bio: input.bio,
      p_private: input.private,
    }),
  search: (query: string, today: string) => call<Person[]>('social_search', { p_query: query, p_today: today }),
  follow: (userId: string) => call<FollowState>('social_follow', { p_target: userId }),
  unfollow: (userId: string) => call<void>('social_unfollow', { p_target: userId }),
  respond: (userId: string, accept: boolean) => call<void>('social_respond', { p_follower: userId, p_accept: accept }),
  orbit: (today: string) => call<Orbit>('social_orbit', { p_today: today }),
  friendsWeek: (monday: string, today: string) => call<Friend[]>('social_friends_week', { p_monday: monday, p_today: today }),
  interact: (userId: string, kind: 'shine' | 'poke', day: string, on: boolean) =>
    call<void>('social_interact', { p_target: userId, p_kind: kind, p_day: day, p_on: on }),
  activity: () => call<Activity[]>('social_activity'),
  /** Some dos dois lados: desfaz o seguir e os brilhos. A pessoa não é avisada. */
  block: (userId: string) => call<void>('social_block', { p_target: userId }),
  unblock: (userId: string) => call<void>('social_unblock', { p_target: userId }),
  blockedList: () => call<BlockedPerson[]>('social_blocked_list'),
  removeFollower: (userId: string) => call<void>('social_remove_follower', { p_follower: userId }),
  /** Vai para uma tabela que só o dono do app vê no Supabase. */
  report: (userId: string, reason: ReportReason, details: string) =>
    call<void>('social_report', { p_target: userId, p_reason: reason, p_details: details }),
  /** Avisos da moderação ainda não vistos (post apagado, conta suspensa ou reativada). */
  notices: () => call<ModerationNotice[]>('mod_my_notices'),
  noticeSeen: (id: number) => call<void>('mod_notice_seen', { p_id: id }),
  /** Usa o código de um amigo: os dois passam a se seguir. */
  redeemInvite: async (code: string): Promise<Person> => {
    const result = await call<{ ok: boolean; reason?: SocialFailure; friend?: Person }>('social_use_invite', {
      p_code: code,
    });
    if (!result.ok || !result.friend) throw new SocialError(result.reason ?? 'unknown');
    return result.friend;
  },
};
