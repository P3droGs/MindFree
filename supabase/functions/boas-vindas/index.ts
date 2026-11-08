// Função do Supabase que manda o e-mail de boas-vindas quando uma conta nasce confirmada (código do e-mail
// ou Google). O banco a chama por um gatilho em auth.users (pg_net, chave de serviço do Vault): a chave
// recebida vira a credencial do cliente, e welcome_mark só existe para a service_role, então qualquer outra
// chave para no banco e a função responde 401. O e-mail sai pela Resend (segredo RESEND_API_KEY), do
// nao-responda@, com resposta para o contato@. Uma vez por conta: welcome_mark devolve false na segunda.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const FROM = 'MindFree <nao-responda@mindfree.com.br>';
const REPLY_TO = 'contato@mindfree.com.br';
const SITE = 'https://p3drogs.github.io/MindFree/';
const RESEND_TIMEOUT_MS = 20_000;

/** A RPC recusou a chave: ou não é de serviço (42501) ou o gateway nem a aceitou (apikey/JWT inválido). */
function keyRejected(error: { code?: string; message?: string }): boolean {
  return error.code === '42501' || /api ?key|jwt|unauthorized/i.test(error.message ?? '');
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** O primeiro nome, só letras, para a saudação. Sem nome, a saudação sai sem ele. */
function firstName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const first = raw.trim().split(/\s+/)[0] ?? '';
  return /^[\p{L}'-]{1,40}$/u.test(first) ? first : '';
}

function html(name: string): string {
  const hiPt = name ? `Olá, ${escapeHtml(name)}!` : 'Olá!';
  const hiEn = name ? `Hi, ${escapeHtml(name)}!` : 'Hi!';
  const p = 'style="margin:0 0 12px;font-size:16px;line-height:24px;color:#2B2F4A"';
  const h = 'style="margin:0 0 10px;font-size:22px;line-height:28px;color:#10142E"';
  const a = 'style="color:#6C57D9"';
  return `<!doctype html><html><body style="margin:0;padding:0;background:#F4F2FF;font-family:Nunito,Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
  <div style="background:#FFFFFF;border-radius:20px;padding:28px 24px">
    <p style="margin:0 0 18px;font-size:14px;font-weight:700;letter-spacing:0.08em;color:#6C57D9">MINDFREE</p>
    <h1 ${h}>${hiPt} Bem-vindo ao MindFree.</h1>
    <p ${p}>Sua conta está pronta. Hoje à noite, quando o lembrete chegar, fale por um minuto tudo o que está na sua cabeça. O app organiza em tarefas com dia e horário, e de manhã está tudo esperando você.</p>
    <p ${p}>Cada noite em que você esvazia a mente acende uma estrela no seu céu. Se quiser, convide amigos para ver as estrelas uns dos outros.</p>
    <p ${p}>Dúvida ou ideia? É só responder a este e-mail. A <a href="${SITE}privacidade/" ${a}>política de privacidade</a> e os <a href="${SITE}termos/" ${a}>termos de uso</a> estão sempre no app, em Ajustes.</p>
    <hr style="border:0;border-top:1px solid #E6E2FF;margin:22px 0">
    <h1 ${h}>${hiEn} Welcome to MindFree.</h1>
    <p ${p}>Your account is ready. Tonight, when the reminder arrives, talk for a minute about everything on your mind. The app turns it into tasks with a day and a time, and in the morning it is all waiting for you.</p>
    <p ${p}>Every night you clear your mind lights a star in your sky. If you like, invite friends to see each other's stars.</p>
    <p ${p}>Questions or ideas? Just reply to this email. The <a href="${SITE}privacidade/" ${a}>privacy policy</a> and the <a href="${SITE}termos/" ${a}>terms of use</a> are always in the app, under Settings.</p>
  </div>
  <p style="margin:16px 0 0;text-align:center;font-size:12px;line-height:18px;color:#8C92C4">MindFree · ${REPLY_TO}</p>
</div></body></html>`;
}

function text(name: string): string {
  const hiPt = name ? `Olá, ${name}!` : 'Olá!';
  const hiEn = name ? `Hi, ${name}!` : 'Hi!';
  return [
    `${hiPt} Bem-vindo ao MindFree.`,
    'Sua conta está pronta. Hoje à noite, quando o lembrete chegar, fale por um minuto tudo o que está na sua cabeça. O app organiza em tarefas com dia e horário, e de manhã está tudo esperando você.',
    'Cada noite em que você esvazia a mente acende uma estrela no seu céu.',
    `Dúvida ou ideia? Responda a este e-mail. Política: ${SITE}privacidade/ · Termos: ${SITE}termos/`,
    '',
    `${hiEn} Welcome to MindFree.`,
    'Your account is ready. Tonight, when the reminder arrives, talk for a minute about everything on your mind. The app turns it into tasks with a day and a time, and in the morning it is all waiting for you.',
    'Every night you clear your mind lights a star in your sky.',
    `Questions or ideas? Reply to this email. Privacy: ${SITE}privacidade/ · Terms: ${SITE}termos/`,
  ].join('\n');
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!url) return json({ error: 'config' }, 500);
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  if (!bearer) return json({ error: 'unauthorized' }, 401);

  let body: { user_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const userId = typeof body.user_id === 'string' ? body.user_id : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(userId)) return json({ error: 'bad_request' }, 400);

  const supabase = createClient(url, bearer, { auth: { persistSession: false, autoRefreshToken: false } });
  // Marca antes de mandar: a segunda chamada para a mesma conta não manda de novo.
  const { data: fresh, error: markError } = await supabase.rpc('welcome_mark', { p_user: userId });
  if (markError) return keyRejected(markError) ? json({ error: 'unauthorized' }, 401) : json({ error: 'mark', code: markError.code }, 500);
  if (fresh !== true) return json({ ok: true, skipped: 'already_sent' });

  const { data: found, error: userError } = await supabase.auth.admin.getUserById(userId);
  if (userError || !found.user?.email) return json({ error: 'user', message: userError?.message ?? 'no email' }, 404);
  const user = found.user;
  if (user.is_anonymous) return json({ ok: true, skipped: 'anonymous' });
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const name = firstName(meta.name ?? meta.full_name ?? meta.given_name);

  if (!resendKey) return json({ error: 'config', message: 'RESEND_API_KEY ausente' }, 500);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: [user.email],
      reply_to: REPLY_TO,
      subject: 'Bem-vindo ao MindFree · Welcome to MindFree',
      html: html(name),
      text: text(name),
    }),
    signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
  });
  if (!response.ok) {
    // Não foi: desfaz a marca para o próximo disparo tentar de novo.
    await supabase.rpc('welcome_unmark', { p_user: userId });
    return json({ error: 'resend', status: response.status }, 502);
  }
  return json({ ok: true, sent: true });
});
