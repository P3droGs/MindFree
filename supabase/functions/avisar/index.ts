// Função do Supabase que entrega os avisos da rede (brilho, cutucão, brilho no Mural e pedido para seguir).
// Ela esvazia a fila push_outbox (preenchida por gatilhos no banco) e manda tudo pelo Expo Push, que entrega
// no Android (Firebase) e no iPhone (Apple). No horário de sono de quem recebe, o aviso vai sem som.
// Só o banco a chama (Cron e push_wake), com a chave de serviço lida do Vault. A chave recebida vira a
// credencial do cliente: push_claim só existe para a service_role, então qualquer outra chave (anon, de
// usuário, inventada) para no banco e a função responde 401. Vale tanto para a chave legada (eyJ…) quanto
// para a nova (sb_secret_…), sem depender do que o Supabase coloca em SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

type Kind = 'shine' | 'poke' | 'mural' | 'request';
type Claimed = {
  id: number;
  kind: Kind;
  detail: string;
  language: string;
  fromName: string | null;
  quiet: boolean;
  tokens: { token: string; platform: 'ios' | 'android' }[];
};

const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100;
const MAX_ROUNDS = 5;

// Para onde o toque no aviso leva, dentro do app.
const PATHS: Record<Kind, string> = { shine: '/amigos', poke: '/?start=gravar', mural: '/mural', request: '/orbita' };

// {name} é quem mandou; {task} é a conquista do Mural.
const TEXTS: Record<string, Record<Kind, string>> = {
  'pt-BR': {
    shine: '{name} mandou um brilho para a sua estrela de hoje ✨',
    poke: '{name} te cutucou: seu céu está esperando a estrela de hoje 🌙',
    mural: '{name} brilhou a sua conquista: {task}',
    request: '{name} quer seguir você. Toque para aprovar.',
  },
  'pt-PT': {
    shine: '{name} mandou um brilho à tua estrela de hoje ✨',
    poke: '{name} deu-te um toque: o teu céu está à espera da estrela de hoje 🌙',
    mural: '{name} deu brilho à tua conquista: {task}',
    request: '{name} quer seguir-te. Toca para aprovar.',
  },
  en: {
    shine: '{name} sent a sparkle to your star today ✨',
    poke: '{name} nudged you: your sky is waiting for today’s star 🌙',
    mural: '{name} sparkled your achievement: {task}',
    request: '{name} wants to follow you. Tap to approve.',
  },
  es: {
    shine: '{name} le mandó un brillo a tu estrella de hoy ✨',
    poke: '{name} te dio un toque: tu cielo espera la estrella de hoy 🌙',
    mural: '{name} le dio brillo a tu logro: {task}',
    request: '{name} quiere seguirte. Toca para aprobar.',
  },
  fr: {
    shine: '{name} a envoyé un éclat à ton étoile du jour ✨',
    poke: '{name} t’a fait signe : ton ciel attend l’étoile du jour 🌙',
    mural: '{name} a fait briller ta réussite : {task}',
    request: '{name} veut te suivre. Touche pour accepter.',
  },
  de: {
    shine: '{name} hat deinem Stern von heute ein Funkeln geschickt ✨',
    poke: '{name} hat dich angestupst: Dein Himmel wartet auf den Stern von heute 🌙',
    mural: '{name} hat deinem Erfolg ein Funkeln geschickt: {task}',
    request: '{name} möchte dir folgen. Tippe, um zuzustimmen.',
  },
  it: {
    shine: '{name} ha mandato un luccichio alla tua stella di oggi ✨',
    poke: '{name} ti ha dato un colpetto: il tuo cielo aspetta la stella di oggi 🌙',
    mural: '{name} ha fatto luccicare il tuo traguardo: {task}',
    request: '{name} vuole seguirti. Tocca per approvare.',
  },
  ja: {
    shine: '{name}さんが今日のあなたの星にきらめきを送りました ✨',
    poke: '{name}さんからのつつき：空が今日の星を待っています 🌙',
    mural: '{name}さんがあなたの達成にきらめきを送りました：{task}',
    request: '{name}さんがあなたをフォローしたいそうです。タップして承認できます。',
  },
  ko: {
    shine: '{name}님이 오늘 내 별에 반짝임을 보냈어요 ✨',
    poke: '{name}님이 콕 찔렀어요: 하늘이 오늘의 별을 기다려요 🌙',
    mural: '{name}님이 내 성취에 반짝임을 보냈어요: {task}',
    request: '{name}님이 나를 팔로우하고 싶어 해요. 눌러서 승인하세요.',
  },
  zh: {
    shine: '{name} 给你今天的星星送了闪光 ✨',
    poke: '{name} 戳了戳你：你的天空在等今天的星星 🌙',
    mural: '{name} 给你的成就送了闪光：{task}',
    request: '{name} 想关注你。点按即可批准。',
  },
  hi: {
    shine: '{name} की ओर से आपके आज के तारे को चमक ✨',
    poke: '{name} की ओर से याद: आपका आसमान आज के तारे का इंतज़ार कर रहा है 🌙',
    mural: '{name} की ओर से आपकी उपलब्धि को चमक: {task}',
    request: '{name} की ओर से फ़ॉलो करने का अनुरोध। मंज़ूरी देने के लिए टैप करें।',
  },
  ar: {
    shine: 'بريق من {name} لنجمتك اليوم ✨',
    poke: 'تذكير من {name}: سماؤك تنتظر نجمة اليوم 🌙',
    mural: 'بريق من {name} على إنجازك: {task}',
    request: 'طلب متابعة من {name}. اضغط للموافقة.',
  },
};

/** A RPC recusou a chave: ou não é de serviço (42501) ou o gateway nem a aceitou (apikey/JWT inválido). */
function keyRejected(error: { code?: string; message?: string }): boolean {
  return error.code === '42501' || /api ?key|jwt|unauthorized/i.test(error.message ?? '');
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function messagesOf(item: Claimed) {
  const texts = TEXTS[item.language] ?? TEXTS['pt-BR'];
  const body = texts[item.kind]
    .replace('{name}', item.fromName ?? '?')
    .replace('{task}', item.detail);
  return item.tokens.map(({ token }) => ({
    to: token,
    title: 'MindFree',
    body,
    data: { url: PATHS[item.kind] },
    // No sono: sem som, prioridade normal, e no iPhone "passivo" (não acende a tela).
    sound: item.quiet ? null : 'default',
    priority: item.quiet ? 'normal' : 'high',
    channelId: item.quiet ? 'amigos-silencio' : 'amigos',
    interruptionLevel: item.quiet ? 'passive' : 'active',
  }));
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  if (!url) return json({ error: 'config' }, 500);
  // Só o banco chama (pelo Cron e, nos avisos, na hora), com a chave de serviço lida do Vault.
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  if (!bearer) return json({ error: 'unauthorized' }, 401);
  const supabase = createClient(url, bearer, { auth: { persistSession: false, autoRefreshToken: false } });

  let sent = 0;
  let failed = 0;
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const { data, error } = await supabase.rpc('push_claim', { p_limit: BATCH });
    if (error) return keyRejected(error) ? json({ error: 'unauthorized' }, 401) : json({ error: 'claim', code: error.code, sent, failed }, 500);
    const claimed = (data ?? []) as Claimed[];
    const messages = claimed.flatMap(messagesOf);
    for (let start = 0; start < messages.length; start += BATCH) {
      const chunk = messages.slice(start, start + BATCH);
      const response = await fetch(EXPO_PUSH, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
      });
      const result = (await response.json().catch(() => ({}))) as {
        data?: { status: string; details?: { error?: string } }[];
      };
      const tickets = result.data ?? [];
      // O Expo responde na mesma ordem: celular que não existe mais sai da lista.
      const gone = chunk.filter((_, index) => tickets[index]?.details?.error === 'DeviceNotRegistered').map((m) => m.to);
      if (gone.length) await supabase.rpc('push_forget_tokens', { p_tokens: gone });
      sent += tickets.filter((ticket) => ticket.status === 'ok').length;
      failed += chunk.length - tickets.filter((ticket) => ticket.status === 'ok').length;
    }
    if (claimed.length < BATCH) break;
  }
  return json({ ok: true, sent, failed });
});
