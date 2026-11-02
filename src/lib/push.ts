import Constants from 'expo-constants';
import Storage from 'expo-sqlite/kv-store';
import { Platform } from 'react-native';

import type { LanguageCode, Translate } from '@/i18n';
import { pushToken } from '@/lib/notifications';
import { call } from '@/lib/social';

/** O que a pessoa quer receber dos amigos e quando ela dorme (para os avisos chegarem sem som). */
export type PushPrefs = {
  shine: boolean;
  poke: boolean;
  mural: boolean;
  requests: boolean;
  nightMinutes: number;
  morningMinutes: number;
  language: LanguageCode;
};

// O endereço cadastrado por último neste celular, para tirar o cadastro ao sair da conta.
const TOKEN_KEY = 'mindfree.push.token.v1';

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

function timeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Cadastra este celular na conta (precisa de @ e de permissão para notificar). Diz se conseguiu. */
export async function registerThisDevice(t: Translate): Promise<boolean> {
  const token = await pushToken(t, projectId());
  if (!token) return false;
  await call<void>('push_register', { p_token: token, p_platform: Platform.OS === 'ios' ? 'ios' : 'android' });
  await Storage.setItem(TOKEN_KEY, token).catch(() => undefined);
  return true;
}

/** Ao sair da conta: este celular para de receber os avisos dela. */
export async function forgetThisDevice() {
  const token = await Storage.getItem(TOKEN_KEY).catch(() => null);
  if (!token) return;
  await call<void>('push_unregister', { p_token: token }).catch(() => undefined);
  await Storage.removeItem(TOKEN_KEY).catch(() => undefined);
}

export function savePushPrefs(prefs: PushPrefs) {
  return call<void>('push_save_prefs', {
    p_shine: prefs.shine,
    p_poke: prefs.poke,
    p_mural: prefs.mural,
    p_requests: prefs.requests,
    p_night: prefs.nightMinutes,
    p_morning: prefs.morningMinutes,
    p_time_zone: timeZone(),
    p_language: prefs.language,
  });
}
