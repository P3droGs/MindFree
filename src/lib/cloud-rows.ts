import type { Journal, Night, Task } from '@/state/journal';

// Como tarefas e noites ficam na nuvem (tabelas tasks e nights do Supabase) e como voltam para o celular.
// Áudio e transcrição nunca vão: ficam só no aparelho.

export type TaskRow = {
  user_id?: string;
  id: string;
  title: string;
  note: string | null;
  day: string;
  minutes: number | null;
  reminder: boolean;
  done: boolean;
  night_id: string | null;
  created_at: string;
  changed_at: string;
  deleted_at: string | null;
  synced_at?: string;
};

export type NightRow = {
  user_id?: string;
  id: string;
  day: string;
  at: number;
  noted: number;
  via: 'voz' | 'texto';
  pending: boolean;
  changed_at: string;
  deleted_at: string | null;
  synced_at?: string;
};

const iso = (ms: number) => new Date(ms).toISOString();

export function toTaskRow(task: Task, userId: string): TaskRow {
  return {
    user_id: userId,
    id: task.id,
    title: task.title.slice(0, 200),
    note: task.note ? task.note.slice(0, 300) : null,
    day: task.day,
    minutes: task.minutes,
    reminder: task.reminder,
    done: task.done,
    night_id: task.nightId ?? null,
    created_at: iso(task.createdAt || task.changedAt),
    changed_at: iso(task.changedAt),
    deleted_at: null,
  };
}

export function toNightRow(night: Night, userId: string): NightRow {
  return {
    user_id: userId,
    id: night.id,
    day: night.day,
    at: night.at,
    noted: Math.min(night.noted, 100),
    via: night.via,
    pending: !!night.pending,
    changed_at: iso(night.changedAt ?? 1),
    deleted_at: null,
  };
}

function fromTaskRow(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    note: row.note ?? undefined,
    day: row.day,
    minutes: row.minutes,
    reminder: row.reminder,
    done: row.done,
    nightId: row.night_id ?? undefined,
    createdAt: Date.parse(row.created_at),
    changedAt: Date.parse(row.changed_at),
  };
}

/**
 * Junta o que veio da nuvem com o que está no celular. Vence a mudança mais recente;
 * o que foi apagado aqui e ainda não subiu (`pendingDeleted`) não volta.
 * Devolve o mesmo objeto quando nada muda, para não salvar à toa.
 */
export function mergeRemote(
  journal: Journal,
  taskRows: TaskRow[],
  nightRows: NightRow[],
  pendingDeleted: { tasks: Set<string>; nights: Set<string> },
): Journal {
  let changed = false;
  const tasks = new Map(journal.tasks.map((task) => [task.id, task]));
  for (const row of taskRows) {
    const local = tasks.get(row.id);
    const remoteChangedAt = Date.parse(row.changed_at);
    if (row.deleted_at) {
      if (local && local.changedAt <= remoteChangedAt) {
        tasks.delete(row.id);
        changed = true;
      }
      continue;
    }
    if (pendingDeleted.tasks.has(row.id)) continue;
    if (!local || remoteChangedAt > local.changedAt) {
      tasks.set(row.id, { ...local, ...fromTaskRow(row) });
      changed = true;
    }
  }

  const nights = new Map(journal.nights.map((night) => [night.id, night]));
  for (const row of nightRows) {
    const local = nights.get(row.id);
    const remoteChangedAt = Date.parse(row.changed_at);
    if (row.deleted_at) {
      if (local && (local.changedAt ?? 0) <= remoteChangedAt) {
        nights.delete(row.id);
        changed = true;
      }
      continue;
    }
    if (pendingDeleted.nights.has(row.id)) continue;
    if (!local || remoteChangedAt > (local.changedAt ?? 0)) {
      nights.set(row.id, {
        ...local,
        id: row.id,
        day: row.day,
        at: row.at,
        noted: row.noted,
        via: row.via,
        pending: row.pending || undefined,
        changedAt: remoteChangedAt,
        // A transcrição e o áudio só existem no celular onde a pessoa gravou.
        transcript: local?.transcript,
        audioUri: local?.audioUri,
      });
      changed = true;
    }
  }

  return changed ? { tasks: [...tasks.values()], nights: [...nights.values()] } : journal;
}
