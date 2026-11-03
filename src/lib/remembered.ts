/**
 * Guarda por um tempo curto o que o servidor respondeu, para as telas da rede não baixarem tudo de novo a cada
 * volta (abrir o mural, ir ao perfil, voltar ao mural: antes, três chamadas em segundos).
 * `fresh` força a ida ao servidor; `forget` apaga depois de uma ação (seguir, brilhar, apagar) para a próxima
 * abertura já mostrar a mudança.
 */
const memory = new Map<string, { at: number; value: unknown }>();

export const REMEMBER_MS = 30_000;

export async function remembered<T>(key: string, load: () => Promise<T>, fresh = false): Promise<T> {
  const hit = memory.get(key);
  if (!fresh && hit && Date.now() - hit.at < REMEMBER_MS) return hit.value as T;
  const value = await load();
  memory.set(key, { at: Date.now(), value });
  return value;
}

/** Esquece o que começa com `prefix` (sem argumento, esquece tudo: ao sair da conta). */
export function forget(prefix = '') {
  for (const key of memory.keys()) if (key.startsWith(prefix)) memory.delete(key);
}
