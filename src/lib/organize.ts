import { defaultTaskDay, type OrganizedTask } from '@/lib/capture';
import { accessToken, serverConfigured, supabaseKey, supabaseUrl } from '@/lib/supabase';
import { formatMinutes, minutesOfDay } from '@/lib/time';
import { dayKey } from '@/state/journal';

/** Sem o servidor configurado, a gravação continua criando tarefas de exemplo. */
export const aiConfigured = serverConfigured;

/** A pessoa (ou o app inteiro) chegou ao limite de organizações do dia. */
export class QuotaError extends Error {}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIMEOUT_MS = 90_000;

export type Organized = { transcript: string; tasks: OrganizedTask[] };

/**
 * Manda a gravação (ou o texto) para o servidor, que transcreve com a OpenAI e organiza com o Claude.
 * `now` é o momento da noite em que a pessoa falou, para "amanhã" e "sexta" darem o dia certo.
 */
export async function organizeOnServer(
  input: { audioUri: string } | { text: string },
  now: Date,
  morningMinutes: number,
  language: string,
): Promise<Organized> {
  if (!aiConfigured) throw new Error('O servidor do MindFree não está configurado.');

  const form = new FormData();
  if ('text' in input) {
    form.append('text', input.text);
  } else {
    const name = input.audioUri.split('/').pop() || 'gravacao.m4a';
    // No React Native, um arquivo entra no formulário pelo endereço dele no celular.
    form.append('audio', { uri: input.audioUri, name, type: 'audio/mp4' } as unknown as Blob);
  }
  form.append('today', dayKey(now));
  form.append('time', formatMinutes(minutesOfDay(now)));
  form.append('weekday', WEEKDAYS[now.getDay()]);
  form.append('defaultDay', defaultTaskDay(now, morningMinutes));
  form.append('language', language);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const token = await accessToken();
    const response = await fetch(`${supabaseUrl}/functions/v1/organizar`, {
      method: 'POST',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` },
      body: form,
      signal: controller.signal,
    });
    if (response.status === 429) throw new QuotaError('Limite de organizações do dia.');
    if (!response.ok) throw new Error(`O servidor respondeu ${response.status}.`);
    const result = (await response.json()) as Partial<Organized>;
    return { transcript: result.transcript ?? '', tasks: Array.isArray(result.tasks) ? result.tasks : [] };
  } finally {
    clearTimeout(timeout);
  }
}
