import { createClient, type Session } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';

import { loadSettings } from '@/state/settings';

// Endereço do projeto no Supabase e a chave publicável (pública por natureza: só diz "veio do app").
// Ficam no arquivo .env.local, que não vai para o Git.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY;

export const serverConfigured = !!SUPABASE_URL && !!SUPABASE_KEY;
export const supabaseUrl = SUPABASE_URL ?? '';
export const supabaseKey = SUPABASE_KEY ?? '';

// O login fica no chaveiro protegido do celular (Keychain no iPhone, Keystore no Android).
// Cada item de lá guarda pouco texto, então a sessão vai em pedaços.
const CHUNK_SIZE = 1800;
const memory = new Map<string, string>();
const slot = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

function isAnonymousSession(value: string): boolean {
  try {
    return (JSON.parse(value) as Partial<Session>).user?.is_anonymous === true;
  } catch {
    return false;
  }
}

async function deleteChunks(key: string) {
  const count = Number((await SecureStore.getItemAsync(`${key}.n`)) ?? 0);
  for (let index = 0; index < count; index += 1) await SecureStore.deleteItemAsync(`${key}.${index}`);
  await SecureStore.deleteItemAsync(`${key}.n`);
}

const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const inMemory = memory.get(key);
    if (inMemory !== undefined) return inMemory;
    const id = slot(key);
    const count = Number((await SecureStore.getItemAsync(`${id}.n`)) ?? 0);
    if (!count) return null;
    const parts: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const part = await SecureStore.getItemAsync(`${id}.${index}`);
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    const id = slot(key);
    // "Me manter conectado" desligado: a conta de verdade fica só na memória e sai quando o app fecha.
    // A conta invisível sempre fica guardada (é ela que conta o limite de uso da IA).
    if (!loadSettings().keepSignedIn && !isAnonymousSession(value)) {
      memory.set(key, value);
      await deleteChunks(id);
      return;
    }
    memory.delete(key);
    await deleteChunks(id);
    const count = Math.ceil(value.length / CHUNK_SIZE);
    for (let index = 0; index < count; index += 1) {
      await SecureStore.setItemAsync(`${id}.${index}`, value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE));
    }
    await SecureStore.setItemAsync(`${id}.n`, String(count));
  },
  async removeItem(key: string): Promise<void> {
    memory.delete(key);
    await deleteChunks(slot(key));
  },
};

export const supabase = serverConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { storage: secureStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    })
  : null;

// No celular, o login só se renova enquanto o app está aberto na tela.
if (supabase) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/**
 * O login para falar com o servidor: a conta da pessoa ou, se ela não tiver,
 * a conta invisível (criada na primeira vez que precisa, só para o limite de uso da IA).
 */
export async function accessToken(): Promise<string> {
  if (!supabase) throw new Error('O servidor do MindFree não está configurado.');
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.access_token;
  const { data: created, error } = await supabase.auth.signInAnonymously();
  if (error || !created.session) throw error ?? new Error('Sem login.');
  return created.session.access_token;
}
