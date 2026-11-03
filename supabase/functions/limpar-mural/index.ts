// Função do Supabase que limpa o Mural: apaga do Storage as fotos dos posts com mais de 7 dias
// (e as que ficaram sem post) e depois apaga esses posts. Roda uma vez por dia pelo Cron do Supabase.
// Só o banco a chama (Cron), com a chave de serviço lida do Vault: sem ela, responde 401.
// A chave de serviço é colocada pelo próprio Supabase em toda função (SUPABASE_SERVICE_ROLE_KEY).
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const BATCH = 100;
const MAX_ROUNDS = 10;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'config' }, 500);
  // Só o banco chama (pelo Cron e, nos avisos, na hora): ele manda a chave de serviço, lida do Vault.
  if (request.headers.get('authorization') !== `Bearer ${serviceKey}`) return json({ error: 'unauthorized' }, 401);
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  let photos = 0;
  let posts = 0;
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const { data: paths, error } = await supabase.rpc('mural_cleanup_list', { p_limit: BATCH });
    if (error) return json({ error: 'list', photos, posts }, 500);
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
