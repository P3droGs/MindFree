import Storage from 'expo-sqlite/kv-store';
import { createContext, use, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { mergeRemote, toNightRow, toTaskRow, type NightRow, type TaskRow } from '@/lib/cloud-rows';
import { deleteAllMedia } from '@/lib/files';
import { mural } from '@/lib/mural';
import { forgetThisDevice } from '@/lib/push';
import { supabase } from '@/lib/supabase';
import { useJournal } from '@/state/journal-provider';
import { changePosts } from '@/state/posts';
import { DEFAULT_SETTINGS, useSettings, type Settings } from '@/state/settings';

/** A conta de agora: de verdade (e-mail e senha) ou a invisível, que só serve para o limite da IA. */
export type Account = { id: string; email: string | null; anonymous: boolean };
export type SyncStatus = 'off' | 'syncing' | 'synced' | 'offline';
export type AuthFailure = 'credentials' | 'taken' | 'weak' | 'busy' | 'network' | 'unavailable' | 'confirm' | 'unknown';

type AccountValue = {
  account: Account | null;
  /** Tem conta de verdade (não a invisível). */
  signedIn: boolean;
  syncStatus: SyncStatus;
  signIn: (email: string, password: string) => Promise<{ failure: AuthFailure | null; restored: boolean }>;
  signUp: (email: string, password: string) => Promise<AuthFailure | null>;
  /** "unsynced": não deu para guardar as últimas mudanças; chame de novo com `force` para sair mesmo assim. */
  signOut: (force?: boolean) => Promise<'ok' | 'unsynced'>;
  /** Apaga a conta no servidor (com tudo o que está nela). Falso se não conseguiu. */
  deleteAccount: () => Promise<boolean>;
};

// Ajustes que acompanham a conta (vão para a tabela profiles). Ficam de fora os que são do aparelho:
// cadastro concluído, "me manter conectado", consentimento da IA e o relógio de teste.
const CLOUD_SETTINGS = [
  'name',
  'bio',
  'accentId',
  'accentCustom',
  'backgroundMode',
  'backgroundSource',
  'backgroundColor',
  'backgroundCustom',
  'nightMinutes',
  'morningMinutes',
  'language',
  'privateAccount',
  'muralSleeps',
  'pushShine',
  'pushPoke',
  'pushMural',
  'pushRequests',
  'constellationNames',
] as const satisfies readonly (keyof Settings)[];

function cloudSettings(settings: Settings): Partial<Settings> {
  return Object.fromEntries(CLOUD_SETTINGS.map((key) => [key, settings[key]]));
}

/** Só aceita da nuvem o que tem o mesmo tipo do padrão (um ajuste estranho não quebra o app). */
function sanitizeCloudSettings(remote: Record<string, unknown>): Partial<Settings> {
  const result: Record<string, unknown> = {};
  for (const key of CLOUD_SETTINGS) {
    const value = remote[key];
    const fallback = DEFAULT_SETTINGS[key];
    // typeof não separa objeto de null nem de lista (as cores e os nomes das constelações são objetos).
    const sameShape =
      typeof value === typeof fallback && (value === null) === (fallback === null) && Array.isArray(value) === Array.isArray(fallback);
    if (key in remote && sameShape) result[key] = value;
  }
  return result as Partial<Settings>;
}

type SyncState = {
  userId: string | null;
  /** Até quando (relógio do celular) as mudanças daqui já subiram. */
  pushedAt: number;
  /** Até onde (relógio do servidor) já puxamos as novidades da nuvem. */
  taskCursor: string;
  nightCursor: string;
  /** Apagadas aqui e ainda não avisadas para a nuvem. */
  deletedTasks: string[];
  deletedNights: string[];
};

const SYNC_KEY = 'mindfree.sync.v1';
const EPOCH = '1970-01-01T00:00:00.000Z';
const PAGE = 500;
const PUSH_DELAY_MS = 2500;

const freshState = (userId: string | null): SyncState => ({
  userId,
  pushedAt: 0,
  taskCursor: EPOCH,
  nightCursor: EPOCH,
  deletedTasks: [],
  deletedNights: [],
});

function loadSyncState(): SyncState {
  try {
    const saved = Storage.getItemSync(SYNC_KEY);
    return saved ? { ...freshState(null), ...(JSON.parse(saved) as Partial<SyncState>) } : freshState(null);
  } catch {
    return freshState(null);
  }
}

function failureOf(error: unknown): AuthFailure {
  const e = error as { code?: string; name?: string; status?: number } | null;
  if (!e) return 'unknown';
  if (e.name === 'AuthRetryableFetchError' || e.status === 0) return 'network';
  switch (e.code) {
    case 'invalid_credentials':
      return 'credentials';
    case 'user_already_exists':
    case 'email_exists':
      return 'taken';
    case 'weak_password':
      return 'weak';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'busy';
    case 'email_provider_disabled':
    case 'signup_disabled':
      return 'unavailable';
    default:
      return 'unknown';
  }
}

const toAccount = (user: { id: string; email?: string | null; is_anonymous?: boolean } | null | undefined) =>
  user ? { id: user.id, email: user.email ?? null, anonymous: !!user.is_anonymous } : null;

const AccountContext = createContext<AccountValue | null>(null);

/**
 * A conta e a nuvem. O celular continua sendo a fonte principal (funciona sem internet);
 * com conta de verdade, tarefas, noites e ajustes sobem e descem sozinhos.
 */
export function AccountProvider({ children }: { children: ReactNode }) {
  const { journal, change } = useJournal();
  const { settings, update } = useSettings();
  const [account, setAccount] = useState<Account | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('off');

  const [initialSyncState] = useState(loadSyncState);
  const accountRef = useRef(account);
  const journalRef = useRef(journal);
  const settingsRef = useRef(settings);
  const stateRef = useRef(initialSyncState);
  const prevIds = useRef<{ tasks: Set<string>; nights: Set<string> } | null>(null);
  // Mudanças que vieram da nuvem (ou de sair da conta) não são "apagadas aqui".
  const skipDiff = useRef(false);
  const suspended = useRef(false);
  const firstSyncDone = useRef(false);
  const running = useRef<Promise<void> | null>(null);

  // As funções de sincronizar rodam fora da renderização: leem sempre o valor mais novo por aqui.
  useEffect(() => {
    accountRef.current = account;
  }, [account]);
  useEffect(() => {
    journalRef.current = journal;
  }, [journal]);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const saveState = (next: SyncState) => {
    stateRef.current = next;
    Storage.setItem(SYNC_KEY, JSON.stringify(next)).catch(() => undefined);
  };
  const permanent = () => {
    const current = accountRef.current;
    return current && !current.anonymous ? current : null;
  };

  // Login guardado no celular e avisos de entrar/sair.
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      const restored = toAccount(data.session?.user);
      const hadAccount = stateRef.current.userId;
      if ((!restored || restored.anonymous) && hadAccount && !settingsRef.current.keepSignedIn) clearLocal();
      setAccount(restored);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setAccount(toAccount(session?.user)));
    return () => data.subscription.unsubscribe();
    // Roda uma vez, quando o app abre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const push = async () => {
    const user = permanent();
    if (!supabase || !user) return;
    const state = stateRef.current;
    const startedAt = Date.now();
    const current = journalRef.current;
    // Exemplos ficam só no celular: são demonstração, não tarefas da pessoa.
    const taskRows = current.tasks
      .filter((task) => !task.example && task.changedAt > state.pushedAt)
      .map((task) => toTaskRow(task, user.id));
    const nightRows = current.nights
      .filter((night) => !night.example && (night.changedAt ?? 1) > state.pushedAt)
      .map((night) => toNightRow(night, user.id));
    for (let index = 0; index < taskRows.length; index += 200) {
      const { error } = await supabase.from('tasks').upsert(taskRows.slice(index, index + 200), { onConflict: 'user_id,id' });
      if (error) throw error;
    }
    for (let index = 0; index < nightRows.length; index += 200) {
      const { error } = await supabase.from('nights').upsert(nightRows.slice(index, index + 200), { onConflict: 'user_id,id' });
      if (error) throw error;
    }
    const deletedTasks = [...state.deletedTasks];
    const deletedNights = [...state.deletedNights];
    const now = new Date().toISOString();
    if (deletedTasks.length) {
      const { error } = await supabase.from('tasks').update({ deleted_at: now, changed_at: now }).in('id', deletedTasks);
      if (error) throw error;
    }
    if (deletedNights.length) {
      const { error } = await supabase.from('nights').update({ deleted_at: now, changed_at: now }).in('id', deletedNights);
      if (error) throw error;
    }
    const latest = stateRef.current;
    saveState({
      ...latest,
      pushedAt: startedAt,
      deletedTasks: latest.deletedTasks.filter((id) => !deletedTasks.includes(id)),
      deletedNights: latest.deletedNights.filter((id) => !deletedNights.includes(id)),
    });
  };

  const pull = async () => {
    const user = permanent();
    const client = supabase;
    if (!client || !user) return;
    const fetchAll = async <Row extends { synced_at?: string }>(table: 'tasks' | 'nights', cursor: string) => {
      const rows: Row[] = [];
      let from = cursor;
      for (;;) {
        const { data, error } = await client.from(table).select('*').gt('synced_at', from).order('synced_at').limit(PAGE);
        if (error) throw error;
        const page = (data ?? []) as Row[];
        rows.push(...page);
        if (page.length < PAGE) break;
        from = page[page.length - 1].synced_at ?? from;
      }
      return rows;
    };
    const state = stateRef.current;
    const taskRows = await fetchAll<TaskRow>('tasks', state.taskCursor);
    const nightRows = await fetchAll<NightRow>('nights', state.nightCursor);
    if (taskRows.length || nightRows.length) {
      const pending = { tasks: new Set(state.deletedTasks), nights: new Set(state.deletedNights) };
      change((current) => {
        const merged = mergeRemote(current, taskRows, nightRows, pending);
        if (merged !== current) skipDiff.current = true;
        return merged;
      });
    }
    saveState({
      ...stateRef.current,
      taskCursor: taskRows.at(-1)?.synced_at ?? state.taskCursor,
      nightCursor: nightRows.at(-1)?.synced_at ?? state.nightCursor,
    });
  };

  const pushProfile = async () => {
    const user = permanent();
    if (!supabase || !user) return;
    const { error } = await supabase
      .from('profiles')
      .upsert({ user_id: user.id, settings: cloudSettings(settingsRef.current), changed_at: new Date().toISOString() });
    if (error) throw error;
  };

  /** Traz os ajustes da conta (nome, cores, horários...). Verdadeiro se a conta já tinha um perfil. */
  const restoreProfile = async () => {
    if (!supabase) return false;
    const { data, error } = await supabase.from('profiles').select('settings').maybeSingle();
    if (error || !data?.settings || typeof data.settings !== 'object') return false;
    const remote = sanitizeCloudSettings(data.settings as Record<string, unknown>);
    if (Object.keys(remote).length === 0) return false;
    update({ ...remote, onboarded: true });
    return true;
  };

  /** Puxa e envia, uma vez por vez (se já estiver rodando, espera a atual e roda de novo). */
  const sync = async (): Promise<void> => {
    if (!permanent()) return;
    if (running.current) {
      await running.current;
      return sync();
    }
    const job = (async () => {
      setSyncStatus('syncing');
      try {
        await pull();
        await push();
        setSyncStatus('synced');
      } catch {
        setSyncStatus('offline');
      }
    })();
    running.current = job;
    try {
      await job;
    } finally {
      running.current = null;
    }
  };

  // Entrou numa conta de verdade: começa do zero para ela e sincroniza tudo.
  const accountKey = account && !account.anonymous ? account.id : null;
  useEffect(() => {
    firstSyncDone.current = false;
    if (!accountKey) return;
    suspended.current = false;
    skipDiff.current = false;
    const previousUser = stateRef.current.userId;
    if (previousUser !== accountKey) {
      // 3. Este celular tinha dados de OUTRA conta (que saiu sem "Me manter conectado"):
      // eles já estão na nuvem dela e não podem ir para a conta nova.
      if (previousUser) clearLocal();
      suspended.current = false;
      saveState(freshState(accountKey));
    }
    void sync().then(() => {
      firstSyncDone.current = true;
    });
    // `sync` lê tudo por refs; só a troca de conta importa aqui.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountKey]);

  // Cada mudança no diário: anota o que foi apagado e envia depois de um tempinho.
  useEffect(() => {
    const ids = { tasks: new Set(journal.tasks.map((task) => task.id)), nights: new Set(journal.nights.map((night) => night.id)) };
    const previous = prevIds.current;
    prevIds.current = ids;
    if (skipDiff.current) {
      skipDiff.current = false;
      return;
    }
    if (!previous || suspended.current || !permanent()) return;
    const goneTasks = [...previous.tasks].filter((id) => !ids.tasks.has(id));
    const goneNights = [...previous.nights].filter((id) => !ids.nights.has(id));
    if (goneTasks.length || goneNights.length) {
      const state = stateRef.current;
      saveState({
        ...state,
        deletedTasks: [...state.deletedTasks, ...goneTasks].slice(-1000),
        deletedNights: [...state.deletedNights, ...goneNights].slice(-1000),
      });
    }
    const timeout = setTimeout(() => {
      push()
        .then(() => setSyncStatus('synced'))
        .catch(() => setSyncStatus('offline'));
    }, PUSH_DELAY_MS);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journal]);

  // Mudou nome, cor ou horário: guarda no perfil da conta.
  const cloudSettingsJson = JSON.stringify(cloudSettings(settings));
  const lastCloudSettings = useRef(cloudSettingsJson);
  useEffect(() => {
    if (lastCloudSettings.current === cloudSettingsJson) return;
    lastCloudSettings.current = cloudSettingsJson;
    if (!accountKey || !firstSyncDone.current) return;
    const timeout = setTimeout(() => {
      pushProfile().catch(() => setSyncStatus('offline'));
    }, 3000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudSettingsJson, accountKey]);

  // Voltou para o app: traz o que mudou em outro celular.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync();
      else if (state === 'background') push().catch(() => undefined);
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn: AccountValue['signIn'] = async (email, password) => {
    if (!supabase) return { failure: 'unavailable', restored: false };
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { failure: failureOf(error), restored: false };
    const restored = await restoreProfile().catch(() => false);
    return { failure: null, restored };
  };

  const signUp: AccountValue['signUp'] = async (email, password) => {
    if (!supabase) return 'unavailable';
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) return failureOf(error);
    // Com a confirmação de e-mail ligada no Supabase, a conta nasce sem login.
    if (!data.session) return 'confirm';
    // Conta nova: o perfil nasce com os ajustes deste celular.
    accountRef.current = toAccount(data.session.user);
    await pushProfile().catch(() => undefined);
    return null;
  };

  /** Limpa deste celular o que é da conta: tarefas, noites, gravações e fotos (os ajustes ficam). */
  const clearLocal = () => {
    suspended.current = true;
    if (journalRef.current.tasks.length || journalRef.current.nights.length) skipDiff.current = true;
    deleteAllMedia();
    changePosts(() => []);
    change(() => ({ tasks: [], nights: [] }));
    saveState(freshState(null));
  };

  const signOut: AccountValue['signOut'] = async (force = false) => {
    if (!supabase) return 'ok';
    suspended.current = true;
    try {
      await push();
    } catch {
      if (!force) {
        suspended.current = false;
        return 'unsynced';
      }
    }
    // Este celular para de receber os avisos dos amigos desta conta.
    await forgetThisDevice();
    // Global: a sessão deixa de valer também no servidor (um celular perdido com o app aberto não continua logado).
    await supabase.auth.signOut({ scope: 'global' }).catch(() => undefined);
    clearLocal();
    return 'ok';
  };

  const deleteAccount: AccountValue['deleteAccount'] = async () => {
    if (!supabase || !permanent()) return true;
    suspended.current = true;
    // As fotos do mural moram no Storage, que não some junto com a conta: saem antes.
    if (account) await mural.removeAllMine(account.id).catch(() => undefined);
    const { error } = await supabase.rpc('delete_my_account');
    if (error) {
      suspended.current = false;
      return false;
    }
    await supabase.auth.signOut({ scope: 'global' }).catch(() => undefined);
    saveState(freshState(null));
    return true;
  };

  const value: AccountValue = {
    account,
    signedIn: !!account && !account.anonymous,
    // Sem conta de verdade não há o que sincronizar.
    syncStatus: accountKey ? syncStatus : 'off',
    signIn,
    signUp,
    signOut,
    deleteAccount,
  };
  return <AccountContext value={value}>{children}</AccountContext>;
}

export function useAccount(): AccountValue {
  const value = use(AccountContext);
  if (!value) throw new Error('useAccount precisa estar dentro de AccountProvider.');
  return value;
}
