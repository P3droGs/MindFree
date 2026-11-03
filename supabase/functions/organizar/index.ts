// Função do Supabase que organiza a noite: recebe a gravação (ou o texto que a pessoa escreveu),
// transforma a fala em texto com a OpenAI e pede ao Claude as tarefas, com dia e horário.
// As chaves ficam só aqui no servidor (secrets do Supabase), nunca dentro do app.
// Cada pedido vem com o login da pessoa (conta de verdade ou a invisível) e gasta uma
// organização do limite diário dela (ver consume_ai_quota na migração das contas).
import Anthropic from 'npm:@anthropic-ai/sdk@1.1.0';
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

// O app grava no máximo 3 minutos de voz em mono: cerca de 0,7 MB no Android (32 kbps) e 1,1 MB no iPhone
// (48 kbps). O limite é apertado de propósito: a transcrição é cobrada por minuto, e um arquivo maior do que
// o app produz seria um áudio longo mandado por fora, gastando muitas vezes o custo de uma organização.
const MAX_AUDIO_BYTES = 1536 * 1024;
const MAX_BODY_BYTES = MAX_AUDIO_BYTES + 64 * 1024;
const MAX_TEXT_CHARS = 4000;
const LANGUAGES = new Set(['pt-BR', 'pt-PT', 'en', 'es', 'fr', 'de', 'it', 'ja', 'ko', 'zh', 'hi', 'ar']);
const WEEKDAYS = new Set(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

const SCHEMA = {
  type: 'object',
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          note: { type: 'string' },
          date: { type: 'string' },
          time: { type: 'string' },
        },
        required: ['title', 'note', 'date', 'time'],
        additionalProperties: false,
      },
    },
  },
  required: ['tasks'],
  additionalProperties: false,
};

const SYSTEM = `You turn a person's bedtime brain dump into a short to-do list for the next days.
They spoke (or wrote) freely before sleeping, so expect filler words, repetitions and unfinished sentences.

For each thing they need to do, return one task:
- title: a short action in the same language the person used (e.g. "Ligar pro dentista"). Fix obvious transcription mistakes.
- note: one short helpful detail they mentioned (deadline, reason, who), or "" if there is none.
- date: the day to do it, as YYYY-MM-DD. Resolve words like "tomorrow", "Friday", "next week" from the current date you are given. If they gave no day, use the default day you are given. Never return a day before today.
- time: "HH:MM" (24h) only if they said a time or a clear moment ("at 10", "after lunch" = 13:00). Otherwise "".

Merge duplicates. Leave out worries or thoughts that have no action. If there is nothing to do, return an empty list.`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function transcribe(audio: File, language: string): Promise<string> {
  const form = new FormData();
  form.append('file', audio, audio.name || 'gravacao.m4a');
  form.append('model', 'gpt-4o-mini-transcribe');
  // A OpenAI espera o código curto do idioma ("pt", "en", "ja"...).
  form.append('language', language.split('-')[0]);
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}` },
    body: form,
  });
  if (!response.ok) throw new Error(`transcription ${response.status}: ${await response.text()}`);
  const result = (await response.json()) as { text?: string };
  return (result.text ?? '').trim();
}

type Task = { title: string; note: string; date: string; time: string };

async function organize(transcript: string, context: Record<string, string>): Promise<Task[]> {
  const response = await anthropic.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    system: SYSTEM,
    // Se o modelo recusar por engano, a própria API tenta de novo no modelo recomendado.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [
      {
        role: 'user',
        content: [
          `Now: ${context.weekday}, ${context.today} ${context.time} (the person's local time).`,
          `Default day for tasks without a day: ${context.defaultDay}.`,
          `App language: ${context.language}.`,
          '',
          '<brain_dump>',
          transcript,
          '</brain_dump>',
        ].join('\n'),
      },
    ],
  });

  const message = response;
  if (message.stop_reason === 'refusal') throw new Error('refusal');
  const text = message.content.find((block) => block.type === 'text');
  if (!text || text.type !== 'text') throw new Error('no text in response');
  const parsed = JSON.parse(text.text) as { tasks: Task[] };
  return parsed.tasks
    .filter((task) => task.title.trim())
    .slice(0, 30)
    .map((task) => ({ ...task, title: task.title.trim().slice(0, 120), note: task.note.trim().slice(0, 200) }));
}

/** Lê o corpo do pedido parando no limite, para um envio gigante não ocupar a memória do servidor. */
async function readLimited(request: Request, limit: number): Promise<Uint8Array<ArrayBuffer> | null> {
  if (Number(request.headers.get('content-length') ?? '0') > limit) return null;
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method' }, 405);

  // O app manda a chave publicável do projeto: é só um filtro de "veio do app", não um login.
  const appKey = Deno.env.get('APP_PUBLISHABLE_KEY');
  if (!appKey || request.headers.get('apikey') !== appKey) return json({ error: 'unauthorized' }, 401);

  // Quem está pedindo: o Supabase confere o login no próprio serviço de contas.
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const authorization = request.headers.get('authorization') ?? '';
  if (!supabaseUrl || !authorization.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);
  const supabase = createClient(supabaseUrl, appKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: who, error: whoError } = await supabase.auth.getUser(authorization.slice('Bearer '.length));
  if (whoError || !who.user) return json({ error: 'unauthorized' }, 401);

  const body = await readLimited(request, MAX_BODY_BYTES);
  if (!body) return json({ error: 'too large' }, 413);
  let form: FormData;
  try {
    form = await new Response(body, {
      headers: { 'Content-Type': request.headers.get('content-type') ?? '' },
    }).formData();
  } catch {
    return json({ error: 'bad form' }, 400);
  }

  const context = {
    today: String(form.get('today') ?? ''),
    time: String(form.get('time') ?? ''),
    weekday: String(form.get('weekday') ?? ''),
    defaultDay: String(form.get('defaultDay') ?? ''),
    language: String(form.get('language') ?? 'pt-BR'),
  };
  // Tudo isso entra no pedido ao Claude: só passa o formato que o app manda.
  if (
    !DATE.test(context.today) ||
    !DATE.test(context.defaultDay) ||
    !TIME.test(context.time) ||
    !WEEKDAYS.has(context.weekday) ||
    !LANGUAGES.has(context.language)
  ) {
    return json({ error: 'bad context' }, 400);
  }

  try {
    let transcript = String(form.get('text') ?? '').trim();
    const audio = form.get('audio');
    if (!transcript && !(audio instanceof File)) return json({ transcript: '', tasks: [] });
    if (transcript.length > MAX_TEXT_CHARS) return json({ error: 'text too long' }, 413);
    if (!transcript && audio instanceof File) {
      if (audio.size > MAX_AUDIO_BYTES) return json({ error: 'audio too large' }, 413);
      if (!audio.type.startsWith('audio/')) return json({ error: 'not audio' }, 415);
    }

    // Só agora, com um pedido válido, gasta uma organização do dia (o limite fica no banco).
    const { data: allowed, error: quotaError } = await supabase.rpc('consume_ai_quota');
    if (quotaError) throw quotaError;
    if (allowed !== true) return json({ error: 'quota' }, 429);

    if (!transcript && audio instanceof File) {
      transcript = await transcribe(audio, context.language);
    }
    if (transcript.length > MAX_TEXT_CHARS) return json({ error: 'text too long' }, 413);
    if (!transcript) return json({ transcript: '', tasks: [] });

    const tasks = await organize(transcript, context);
    return json({ transcript, tasks });
  } catch (error) {
    // Só a mensagem: a resposta inteira de um erro pode trazer um trecho da transcrição da pessoa.
    console.error(error instanceof Error ? error.message : String(error));
    return json({ error: 'failed' }, 502);
  }
});
