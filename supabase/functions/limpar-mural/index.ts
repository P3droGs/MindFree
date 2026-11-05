// Função do Supabase que limpa o Mural: apaga do Storage as fotos dos posts com mais de 7 dias
// (e as que ficaram sem post) e depois apaga esses posts. Roda uma vez por dia pelo Cron do Supabase.
// Só o banco a chama (Cron), com a chave de serviço lida do Vault. A chave recebida vira a credencial do
// cliente: mural_cleanup_list só existe para a service_role, então qualquer outra chave para no banco e a
// função responde 401. Vale para a chave legada (eyJ…) e para a nova (sb_secret_…).
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const BATCH = 100;
const MAX_ROUNDS = 10;

/** A RPC recusou a chave: ou não é de serviço (42501) ou o gateway nem a aceitou (apikey/JWT inválido). */
function keyRejected(error: { code?: string; message?: string }): boolean {
  return error.code === '42501' || /api ?key|jwt|unauthorized/i.test(error.message ?? '');
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  if (!url) return json({ error: 'config' }, 500);
  // Só o banco chama (pelo Cron), com a chave de serviço lida do Vault.
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  if (!bearer) return json({ error: 'unauthorized' }, 401);
  const supabase = createClient(url, bearer, { auth: { persistSession: false, autoRefreshToken: false } });

  let photos = 0;
  let posts = 0;
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const { data: paths, error } = await supabase.rpc('mural_cleanup_list', { p_limit: BATCH });
    if (error) return keyRejected(error) ? json({ error: 'unauthorized' }, 401) : json({ error: 'list', code: error.code, photos, posts }, 500);
    const list = (paths ?? []) as string[];
    if (list.length === 0) break;
    // Primeiro a foto, depois o post: se o Storage falhar, o post fica e a próxima rodada tenta de novo.
    const removed = await supabase.storage.from('mural').remove(list);
    if (removed.error) return json({ error: 'storage', photos, posts }, 500);
    photos += removed.data?.length ?? 0;
    const { data: forgot, error: forgetError } = await supabase.rpc('mural_cleanup_forget', { p_paths: list });
    if (forgetError) return json({ error: 'forget', photos, posts }, 500);
    posts += (forgot as number) ?? 0;
    if (list.length < BATCH) break;
  }
  return json({ ok: true, photos, posts });
});
