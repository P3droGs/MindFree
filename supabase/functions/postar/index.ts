// Função do Supabase que publica um post no Mural, depois de passar a foto e o texto pelo filtro de moderação
// da OpenAI (gratuito). Nudez, violência, ódio e afins não são publicados, e a foto enviada é apagada.
// O app já subiu a foto para a pasta da pessoa no Storage; aqui só entra o caminho dela.
// O app não consegue postar sem passar por aqui: o mural_create foi fechado para ele (ver a moderação no SQL).
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
// O caminho da foto do jeito que o app monta: a pasta da pessoa (o id dela), um nome curto em base 36 e .jpg.
// Nada de "..", subpastas, outra extensão ou nome fora desse formato.
const PHOTO_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-z]{1,16}-[0-9a-z]{1,8}\.jpg$/;
const MODERATION_TIMEOUT_MS = 30_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Pergunta ao filtro da OpenAI se o post pode ir ao ar. Nulo quando o filtro não respondeu. */
async function allowed(photo: Uint8Array, text: string): Promise<boolean | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'omni-moderation-latest',
        input: [
          { type: 'text', text },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${toBase64(photo)}` } },
        ],
      }),
      signal: AbortSignal.timeout(MODERATION_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const result = (await response.json()) as { results?: { flagged?: boolean }[] };
    if (!result.results?.length) return null;
    return !result.results.some((item) => item.flagged);
  } catch {
    return null;
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method' }, 405);

  // O app manda a chave publicável do projeto: é só um filtro de "veio do app", não um login.
  const appKey = Deno.env.get('APP_PUBLISHABLE_KEY');
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!appKey || !url || !serviceKey) return json({ error: 'config' }, 500);
  if (request.headers.get('apikey') !== appKey) return json({ error: 'unauthorized' }, 401);

  // Quem está postando: só conta de verdade (a invisível, sem e-mail, não entra na rede).
  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return json({ error: 'no_account' }, 401);
  const asUser = createClient(url, appKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: who, error: whoError } = await asUser.auth.getUser(authorization.slice('Bearer '.length));
  if (whoError || !who.user || who.user.is_anonymous) return json({ error: 'no_account' }, 401);
  const userId = who.user.id;

  let body: { photo?: unknown; task?: unknown; caption?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const photo = typeof body.photo === 'string' ? body.photo : '';
  const task = typeof body.task === 'string' ? body.task.slice(0, 200) : '';
  const caption = typeof body.caption === 'string' ? body.caption.slice(0, 140) : '';
  if (!photo.startsWith(`${userId}/`) || !PHOTO_PATH.test(photo)) return json({ error: 'photo_missing' }, 400);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: file, error: fileError } = await admin.storage.from('mural').download(photo);
  if (fileError || !file) return json({ error: 'photo_missing' }, 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > MAX_PHOTO_BYTES) return json({ error: 'photo_missing' }, 400);

  const verdict = await allowed(bytes, `${task}\n${caption}`.trim());
  // Sem resposta do filtro, não publica (o app pede para tentar de novo).
  if (verdict === null) return json({ error: 'network' }, 503);
  if (!verdict) {
    await admin.storage.from('mural').remove([photo]);
    return json({ error: 'flagged' }, 422);
  }

  const { data: post, error: postError } = await admin.rpc('mural_create_for', {
    p_user: userId,
    p_photo: photo,
    p_task: task,
    p_caption: caption,
  });
  if (postError) {
    const code = /mindfree:([a-z_]+)/.exec(postError.message ?? '')?.[1] ?? 'unknown';
    return json({ error: code }, 400);
  }
  return json(post);
});
