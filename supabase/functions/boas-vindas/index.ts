// Função do Supabase que manda o e-mail de boas-vindas quando uma conta nasce confirmada (código do e-mail
// ou Google). O banco a chama por um gatilho em auth.users (pg_net, chave de serviço do Vault): a chave
// recebida vira a credencial do cliente, e welcome_mark só existe para a service_role, então qualquer outra
// chave para no banco e a função responde 401. O e-mail sai pela Resend (segredo RESEND_API_KEY), do
// nao-responda@, com resposta para o contato@, no idioma que o app mandou no cadastro
// (user_metadata.language); sem idioma conhecido, vai em português e inglês. Uma vez por conta.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const FROM = 'MindFree <nao-responda@mindfree.com.br>';
const REPLY_TO = 'contato@mindfree.com.br';
const SITE = 'https://mindfree.com.br/';
const RESEND_TIMEOUT_MS = 20_000;

type Copy = {
  subject: string;
  hi: (name: string) => string;
  title: string;
  ready: string;
  star: string;
  reply: (privacy: string, terms: string) => string;
  privacy: string;
  terms: string;
  rtl?: boolean;
};

// Os textos por idioma. {privacy} e {terms} viram links.
const COPY: Record<string, Copy> = {
  'pt-BR': {
    subject: 'Bem-vindo ao MindFree',
    hi: (n) => (n ? `Olá, ${n}!` : 'Olá!'),
    title: 'Bem-vindo ao MindFree.',
    ready: 'Sua conta está pronta. Hoje à noite, quando o lembrete chegar, fale por um minuto tudo o que está na sua cabeça. O app organiza em tarefas com dia e horário, e de manhã está tudo esperando você.',
    star: 'Cada noite em que você esvazia a mente acende uma estrela no seu céu. Se quiser, convide amigos para ver as estrelas uns dos outros.',
    reply: (p, t) => `Dúvida ou ideia? É só responder a este e-mail. A ${p} e os ${t} estão sempre no app, em Ajustes.`,
    privacy: 'política de privacidade',
    terms: 'termos de uso',
  },
  'pt-PT': {
    subject: 'Bem-vindo ao MindFree',
    hi: (n) => (n ? `Olá, ${n}!` : 'Olá!'),
    title: 'Bem-vindo ao MindFree.',
    ready: 'A sua conta está pronta. Hoje à noite, quando o lembrete chegar, fale durante um minuto sobre tudo o que tem na cabeça. A app organiza em tarefas com dia e hora, e de manhã está tudo à sua espera.',
    star: 'Cada noite em que esvazia a mente acende uma estrela no seu céu. Se quiser, convide amigos para verem as estrelas uns dos outros.',
    reply: (p, t) => `Dúvidas ou ideias? Basta responder a este e-mail. A ${p} e os ${t} estão sempre na app, em Definições.`,
    privacy: 'política de privacidade',
    terms: 'termos de utilização',
  },
  en: {
    subject: 'Welcome to MindFree',
    hi: (n) => (n ? `Hi, ${n}!` : 'Hi!'),
    title: 'Welcome to MindFree.',
    ready: 'Your account is ready. Tonight, when the reminder arrives, talk for a minute about everything on your mind. The app turns it into tasks with a day and a time, and in the morning it is all waiting for you.',
    star: "Every night you clear your mind lights a star in your sky. If you like, invite friends to see each other's stars.",
    reply: (p, t) => `Questions or ideas? Just reply to this email. The ${p} and the ${t} are always in the app, under Settings.`,
    privacy: 'privacy policy',
    terms: 'terms of use',
  },
  es: {
    subject: 'Bienvenido a MindFree',
    hi: (n) => (n ? `¡Hola, ${n}!` : '¡Hola!'),
    title: 'Bienvenido a MindFree.',
    ready: 'Tu cuenta está lista. Esta noche, cuando llegue el recordatorio, habla durante un minuto de todo lo que tienes en la cabeza. La app lo convierte en tareas con día y hora, y por la mañana está todo esperándote.',
    star: 'Cada noche en que vacías la mente enciende una estrella en tu cielo. Si quieres, invita a amigos a ver las estrellas de los demás.',
    reply: (p, t) => `¿Dudas o ideas? Responde a este correo. La ${p} y los ${t} están siempre en la app, en Ajustes.`,
    privacy: 'política de privacidad',
    terms: 'términos de uso',
  },
  fr: {
    subject: 'Bienvenue sur MindFree',
    hi: (n) => (n ? `Bonjour ${n} !` : 'Bonjour !'),
    title: 'Bienvenue sur MindFree.',
    ready: "Ton compte est prêt. Ce soir, quand le rappel arrivera, parle pendant une minute de tout ce que tu as en tête. L'app le transforme en tâches avec un jour et une heure, et le matin tout t'attend.",
    star: 'Chaque nuit où tu vides ta tête allume une étoile dans ton ciel. Si tu veux, invite des amis à voir les étoiles les uns des autres.',
    reply: (p, t) => `Une question, une idée ? Réponds simplement à cet e-mail. La ${p} et les ${t} sont toujours dans l'app, dans Réglages.`,
    privacy: 'politique de confidentialité',
    terms: "conditions d'utilisation",
  },
  de: {
    subject: 'Willkommen bei MindFree',
    hi: (n) => (n ? `Hallo ${n}!` : 'Hallo!'),
    title: 'Willkommen bei MindFree.',
    ready: 'Dein Konto ist bereit. Wenn heute Abend die Erinnerung kommt, sprich eine Minute lang über alles, was dir durch den Kopf geht. Die App macht daraus Aufgaben mit Tag und Uhrzeit, und am Morgen wartet alles auf dich.',
    star: 'Jede Nacht, in der du den Kopf frei machst, lässt einen Stern an deinem Himmel leuchten. Wenn du magst, lade Freunde ein, die Sterne der anderen zu sehen.',
    reply: (p, t) => `Fragen oder Ideen? Antworte einfach auf diese E-Mail. Die ${p} und die ${t} findest du immer in der App unter Einstellungen.`,
    privacy: 'Datenschutzerklärung',
    terms: 'Nutzungsbedingungen',
  },
  it: {
    subject: 'Benvenuto su MindFree',
    hi: (n) => (n ? `Ciao, ${n}!` : 'Ciao!'),
    title: 'Benvenuto su MindFree.',
    ready: "Il tuo account è pronto. Stasera, quando arriva il promemoria, parla per un minuto di tutto ciò che hai in testa. L'app lo trasforma in attività con giorno e ora, e al mattino è tutto lì ad aspettarti.",
    star: 'Ogni notte in cui svuoti la mente accende una stella nel tuo cielo. Se vuoi, invita gli amici a vedere le stelle gli uni degli altri.',
    reply: (p, t) => `Domande o idee? Rispondi a questa e-mail. L'${p} e i ${t} sono sempre nell'app, in Impostazioni.`,
    privacy: 'informativa sulla privacy',
    terms: "termini d'uso",
  },
  ja: {
    subject: 'MindFreeへようこそ',
    hi: (n) => (n ? `${n}さん、こんにちは。` : 'こんにちは。'),
    title: 'MindFreeへようこそ。',
    ready: 'アカウントの準備ができました。今夜リマインダーが届いたら、頭の中にあることを1分間話してください。アプリが日付と時刻つきのタスクに整理して、朝にはすべてそろっています。',
    star: '頭を空にした夜ごとに、あなたの空に星がひとつ灯ります。よければ友だちを招待して、お互いの星を見せ合いましょう。',
    reply: (p, t) => `質問やアイデアは、このメールに返信してください。${p}と${t}はアプリの設定からいつでも読めます。`,
    privacy: 'プライバシーポリシー',
    terms: '利用規約',
  },
  ko: {
    subject: 'MindFree에 오신 것을 환영합니다',
    hi: (n) => (n ? `${n}님, 안녕하세요!` : '안녕하세요!'),
    title: 'MindFree에 오신 것을 환영합니다.',
    ready: '계정이 준비됐어요. 오늘 밤 알림이 오면 머릿속에 있는 것을 1분 동안 말해 보세요. 앱이 날짜와 시간이 있는 할 일로 정리하고, 아침이면 모두 준비되어 있어요.',
    star: '마음을 비운 밤마다 나의 하늘에 별이 하나 켜져요. 원한다면 친구를 초대해 서로의 별을 볼 수 있어요.',
    reply: (p, t) => `궁금한 점이나 아이디어가 있으면 이 이메일에 답장해 주세요. ${p}과 ${t}은 앱의 설정에서 언제든 볼 수 있어요.`,
    privacy: '개인정보 처리방침',
    terms: '이용약관',
  },
  zh: {
    subject: '欢迎使用 MindFree',
    hi: (n) => (n ? `你好，${n}！` : '你好！'),
    title: '欢迎使用 MindFree。',
    ready: '你的账号已就绪。今晚提醒到来时，用一分钟说出脑子里的一切。应用会把它整理成带日期和时间的任务，早上一切都在等你。',
    star: '每一个清空思绪的夜晚，都会在你的星空点亮一颗星。如果愿意，邀请朋友互相看看彼此的星星。',
    reply: (p, t) => `有疑问或想法？直接回复这封邮件即可。${p}和${t}随时可在应用的设置中查看。`,
    privacy: '隐私政策',
    terms: '使用条款',
  },
  hi: {
    subject: 'MindFree में आपका स्वागत है',
    hi: (n) => (n ? `नमस्ते, ${n}!` : 'नमस्ते!'),
    title: 'MindFree में आपका स्वागत है।',
    ready: 'आपका अकाउंट तैयार है। आज रात रिमाइंडर आने पर, एक मिनट तक वह सब बोलिए जो आपके दिमाग में है। ऐप उसे दिन और समय वाले कामों में बदल देता है, और सुबह सब कुछ आपका इंतज़ार कर रहा होता है।',
    star: 'जिस रात आप दिमाग़ खाली करते हैं, आपके आसमान में एक तारा जलता है। चाहें तो दोस्तों को बुलाइए और एक-दूसरे के तारे देखिए।',
    reply: (p, t) => `कोई सवाल या सुझाव? बस इस ईमेल का जवाब दीजिए। ${p} और ${t} हमेशा ऐप की सेटिंग्स में हैं।`,
    privacy: 'गोपनीयता नीति',
    terms: 'उपयोग की शर्तें',
  },
  ar: {
    subject: 'مرحبًا بك في MindFree',
    hi: (n) => (n ? `مرحبًا ${n}!` : 'مرحبًا!'),
    title: 'مرحبًا بك في MindFree.',
    ready: 'حسابك جاهز. الليلة، عندما يصل التذكير، تحدّث لدقيقة عن كل ما يشغل بالك. يحوّله التطبيق إلى مهام بيوم ووقت، وفي الصباح يكون كل شيء بانتظارك.',
    star: 'كل ليلة تفرّغ فيها ذهنك تضيء نجمة في سمائك. إن شئت، ادعُ أصدقاءك لرؤية نجوم بعضكم بعضًا.',
    reply: (p, t) => `سؤال أو فكرة؟ ما عليك سوى الرد على هذه الرسالة. ${p} و${t} متاحان دائمًا في التطبيق، ضمن الإعدادات.`,
    privacy: 'سياسة الخصوصية',
    terms: 'شروط الاستخدام',
    rtl: true,
  },
};

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

/** Os idiomas que o e-mail sabe: o do cadastro; sem ele, português e inglês. */
function languagesFor(raw: unknown): string[] {
  return typeof raw === 'string' && raw in COPY ? [raw] : ['pt-BR', 'en'];
}

const P = 'style="margin:0 0 12px;font-size:16px;line-height:24px;color:#2B2F4A"';
const H = 'style="margin:0 0 10px;font-size:22px;line-height:28px;color:#10142E"';
const A = 'style="color:#6C57D9"';

function blockHtml(copy: Copy, name: string): string {
  const privacy = `<a href="${SITE}privacidade/" ${A}>${escapeHtml(copy.privacy)}</a>`;
  const terms = `<a href="${SITE}termos/" ${A}>${escapeHtml(copy.terms)}</a>`;
  const dir = copy.rtl ? ' dir="rtl"' : '';
  return `<div${dir}>
    <h1 ${H}>${escapeHtml(copy.hi(name))} ${escapeHtml(copy.title)}</h1>
    <p ${P}>${escapeHtml(copy.ready)}</p>
    <p ${P}>${escapeHtml(copy.star)}</p>
    <p ${P}>${copy.reply(privacy, terms)}</p>
  </div>`;
}

function html(languages: string[], name: string): string {
  const blocks = languages.map((code) => blockHtml(COPY[code], name)).join('\n    <hr style="border:0;border-top:1px solid #E6E2FF;margin:22px 0">\n');
  return `<!doctype html><html><body style="margin:0;padding:0;background:#F4F2FF;font-family:Nunito,Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
  <div style="background:#FFFFFF;border-radius:20px;padding:28px 24px">
    <p style="margin:0 0 18px;font-size:14px;font-weight:700;letter-spacing:0.08em;color:#6C57D9">MINDFREE</p>
    ${blocks}
  </div>
  <p style="margin:16px 0 0;text-align:center;font-size:12px;line-height:18px;color:#8C92C4">MindFree · ${REPLY_TO}</p>
</div></body></html>`;
}

function text(languages: string[], name: string): string {
  return languages
    .map((code) => {
      const c = COPY[code];
      return [`${c.hi(name)} ${c.title}`, c.ready, c.star, c.reply(`${c.privacy}: ${SITE}privacidade/`, `${c.terms}: ${SITE}termos/`)].join('\n');
    })
    .join('\n\n');
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
  const languages = languagesFor(meta.language);

  if (!resendKey) return json({ error: 'config', message: 'RESEND_API_KEY ausente' }, 500);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: [user.email],
      reply_to: REPLY_TO,
      subject: languages.map((code) => COPY[code].subject).join(' · '),
      html: html(languages, name),
      text: text(languages, name),
    }),
    signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
  });
  if (!response.ok) {
    // Não foi: desfaz a marca para o próximo disparo tentar de novo.
    await supabase.rpc('welcome_unmark', { p_user: userId });
    return json({ error: 'resend', status: response.status }, 502);
  }
  return json({ ok: true, sent: true, language: languages.join('+') });
});
