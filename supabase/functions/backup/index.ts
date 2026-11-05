// Função do Supabase que guarda a cópia de segurança diária: pede ao banco o retrato de todas as tabelas
// (backup_snapshot) e grava no bucket privado "backups" como AAAA-MM-DD.json, apagando o que tem mais de
// 14 dias. Roda uma vez por dia pelo Cron (03:30 UTC). Só o banco a chama, com a chave de serviço lida do
// Vault: a chave recebida vira a credencial do cliente, e backup_snapshot só existe para a service_role,
// então qualquer outra chave para no banco e a função responde 401.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const BUCKET = 'backups';
const KEEP_DAYS = 14;
const NAME = /^\d{4}-\d{2}-\d{2}\.json$/;

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
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  if (!bearer) return json({ error: 'unauthorized' }, 401);
  const supabase = createClient(url, bearer, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data, error } = await supabase.rpc('backup_snapshot');
  if (error) return keyRejected(error) ? json({ error: 'unauthorized' }, 401) : json({ error: 'snapshot', code: error.code }, 500);
  const snapshot = data as { tables?: Record<string, unknown[]> };
  const body = JSON.stringify(snapshot);
  const file = `${new Date().toISOString().slice(0, 10)}.json`;

  const upload = await supabase.storage
    .from(BUCKET)
    .upload(file, new Blob([body], { type: 'application/json' }), { contentType: 'application/json', upsert: true });
  if (upload.error) return json({ error: 'upload', message: upload.error.message }, 500);

  // As cópias com mais de 14 dias saem. O nome é a data, então basta comparar.
  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  const { data: files } = await supabase.storage.from(BUCKET).list('', { limit: 100 });
  const old = (files ?? []).map((item) => item.name).filter((name) => NAME.test(name) && Date.parse(name.slice(0, 10)) < cutoff);
  let removed = 0;
  if (old.length) {
    const result = await supabase.storage.from(BUCKET).remove(old);
    removed = result.data?.length ?? 0;
  }
  return json({ ok: true, file, bytes: body.length, tables: Object.keys(snapshot.tables ?? {}).length, removed });
});
