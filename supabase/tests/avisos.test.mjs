// Testa o SQL dos avisos (push): a fila, os tipos que a pessoa desliga, o horário de sono e o cadastro do celular.
// Uso: npm run test:sql (ou node supabase/tests/avisos.test.mjs)
import { check, errorOf, finish, startDb } from './local-supabase.mjs';

const { db, as } = await startDb([
  '20261024120000_contas.sql',
  '20261027120000_rede.sql',
  '20261101120000_bloquear.sql',
  '20261101180000_mural.sql',
  '20261102120000_avisos.sql',
]);
check('migrações aplicam duas vezes sem erro', true);

const A = '11111111-1111-1111-1111-111111111111'; // Ana, recebe os avisos (conta privada)
const B = '22222222-2222-2222-2222-222222222222'; // Bruno, manda brilho, cutuca, pede para seguir
const C = '33333333-3333-3333-3333-333333333333'; // Carla, sem celular cadastrado
await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}'), ('${C}');`);

const rpc = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const json = async (sql, params = []) => {
  const value = Object.values(await rpc(sql, params))[0];
  return typeof value === 'string' ? JSON.parse(value) : value;
};
const today = (await rpc(`select current_date::text as d`)).d;
const save = (handle, name, isPrivate) => json(`select public.social_save_profile($1, $2, '', $3) as p`, [handle, name, isPrivate]);
const queue = async (to) => (await db.query(`select kind, ref, detail, sent_at from public.push_outbox where user_id = $1 order by id`, [to])).rows;
const claim = async () => {
  await db.exec(`reset role; set role service_role;`);
  try {
    return await json(`select public.push_claim(100) as c`);
  } finally {
    await db.exec(`reset role;`);
  }
};
const prefs = (who, on, night, morning, zone = 'UTC', lang = 'pt-BR') =>
  as(who, () =>
    db.query(`select public.push_save_prefs($1, $2, $3, $4, $5, $6, $7, $8)`, [on.shine, on.poke, on.mural, on.requests, night, morning, zone, lang]),
  );
const ALL = { shine: true, poke: true, mural: true, requests: true };

await as(A, () => save('ana', 'Ana', false));
await as(B, () => save('bruno', '', false));
await as(C, () => save('carla', 'Carla', false));

// Cadastro do celular.
check('cadastrar celular exige @ (conta de verdade)', (await errorOf(() => as(A, () => db.query(`select public.push_register('ExponentPushToken[xx]', 'android')`), true)))?.includes('mindfree:no_account'));
await as(A, () => db.query(`select public.push_register('ExponentPushToken[ana-1]', 'android')`));
check('celular cadastrado', (await rpc(`select count(*)::int as n from public.push_devices where user_id = '${A}'`)).n === 1);
check('token estranho recusado', (await errorOf(() => as(A, () => db.query(`select public.push_register('x', 'android')`))))?.includes('mindfree:bad_token'));
check('ninguém lê os celulares direto', (await errorOf(() => as(A, () => db.query(`select * from public.push_devices`)))) !== null);

// Sem celular, nada vai para a fila.
await as(B, () => db.query(`select public.social_follow($1)`, [C]));
await as(B, () => db.query(`select public.social_interact($1, 'shine', $2, true)`, [C, today]));
check('quem não tem celular não recebe nada na fila', (await queue(C)).length === 0);

// Brilho e cutucão.
await as(B, () => db.query(`select public.social_follow($1)`, [A]));
await as(B, () => db.query(`select public.social_interact($1, 'shine', $2, true)`, [A, today]));
await as(B, () => db.query(`select public.social_interact($1, 'poke', $2, true)`, [A, today]));
let q = await queue(A);
check('brilho e cutucão entram na fila', q.map((r) => r.kind).join() === 'shine,poke' && q[0].ref === today);
await as(B, () => db.query(`select public.social_interact($1, 'shine', $2, false)`, [A, today]));
await as(B, () => db.query(`select public.social_interact($1, 'shine', $2, true)`, [A, today]));
check('tirar e pôr o brilho de novo não avisa duas vezes', (await queue(A)).filter((r) => r.kind === 'shine').length === 1);

// Brilho no Mural.
await db.exec(`insert into storage.objects (bucket_id, name, owner_id) values ('mural', '${A}/p.jpg', '${A}');`);
const post = await as(A, () => json(`select public.mural_create($1, 'Correr 5 km', '') as p`, [`${A}/p.jpg`]));
await as(B, () => db.query(`select public.mural_shine($1, true)`, [post.id]));
q = await queue(A);
check('brilho no post entra na fila com a tarefa', q.some((r) => r.kind === 'mural' && r.ref === post.id && r.detail === 'Correr 5 km'));

// Pedido para seguir (conta privada).
await as(A, () => save('ana', 'Ana', true));
await as(C, () => db.query(`select public.social_follow($1)`, [A]));
check('pedido para seguir conta privada entra na fila', (await queue(A)).some((r) => r.kind === 'request'));
await as(A, () => db.query(`select public.social_follow($1)`, [C]));
check('seguir conta pública (sem pedido) não avisa', !(await queue(C)).some((r) => r.kind === 'request'));

// Desligar um tipo.
await prefs(A, { ...ALL, poke: false }, 1350, 420);
await as(B, () => db.query(`select public.social_interact($1, 'poke', $2, false)`, [A, today]));
await db.exec(`delete from public.push_outbox where kind = 'poke';`);
await as(B, () => db.query(`select public.social_interact($1, 'poke', $2, true)`, [A, today]));
check('cutucão desligado não entra na fila', !(await queue(A)).some((r) => r.kind === 'poke'));

// O envio: horário de sono e o que vem para a função.
const minutesNow = Number((await rpc(`select (extract(hour from now() at time zone 'UTC') * 60 + extract(minute from now() at time zone 'UTC'))::int as m`)).m);
await prefs(A, ALL, (minutesNow + 1439) % 1440, (minutesNow + 60) % 1440); // dormindo agora
check('o app não chama o envio', (await errorOf(() => as(A, () => db.query(`select public.push_claim(10)`)))) !== null);
let batch = await claim();
check('o envio pega os 3 avisos da Ana (e o da Carla não existe)', batch.length === 3 && batch.every((m) => m.tokens.length === 1));
check('no horário de sono, o aviso vem sem som', batch.every((m) => m.quiet === true));
check('sem nome, quem mandou aparece pelo @', batch.find((m) => m.kind === 'shine').fromName === '@bruno');
check('o pedido vem com o nome de quem pediu', batch.find((m) => m.kind === 'request').fromName === 'Carla');
check('o que foi pego não sai de novo', (await claim()).length === 0);

await db.exec(`delete from public.push_outbox;`);
await prefs(A, ALL, (minutesNow + 120) % 1440, (minutesNow + 600) % 1440, 'Lugar/Inventado', 'en'); // acordada
await as(B, () => db.query(`select public.social_interact($1, 'shine', $2, false)`, [A, today]));
await as(B, () => db.query(`select public.social_interact($1, 'shine', $2, true)`, [A, today]));
batch = await claim();
check('fora do horário de sono, o aviso vem com som', batch.length === 1 && batch[0].quiet === false && batch[0].language === 'en');
check('fuso desconhecido vira UTC', (await rpc(`select time_zone from public.push_prefs where user_id = '${A}'`)).time_zone === 'UTC');

// Aviso velho e bloqueio.
await db.exec(`insert into public.push_outbox (user_id, from_id, kind, ref, created_at) values ('${A}', '${B}', 'poke', 'velho', now() - interval '2 days');`);
check('aviso com mais de 1 dia é descartado', (await claim()).length === 0);
await db.exec(`insert into public.push_outbox (user_id, from_id, kind, ref) values ('${A}', '${B}', 'poke', 'antes-do-bloqueio');`);
await as(A, () => db.query(`select public.social_block($1)`, [B]));
check('aviso de quem foi bloqueado não sai', (await claim()).length === 0);

// Celular muda de conta, sai da conta e o Expo diz que o celular sumiu.
await as(C, () => db.query(`select public.push_register('ExponentPushToken[ana-1]', 'android')`));
check('o mesmo celular passa para a outra conta', (await rpc(`select user_id from public.push_devices where token = 'ExponentPushToken[ana-1]'`)).user_id === C);
await as(A, () => db.query(`select public.push_unregister('ExponentPushToken[ana-1]')`));
check('outra conta não tira o celular de quem está nele', (await rpc(`select count(*)::int as n from public.push_devices`)).n === 1);
await as(C, () => db.query(`select public.push_unregister('ExponentPushToken[ana-1]')`));
check('sair da conta tira o celular', (await rpc(`select count(*)::int as n from public.push_devices`)).n === 0);
for (let i = 0; i < 12; i += 1) await as(C, () => db.query(`select public.push_register($1, 'ios')`, [`ExponentPushToken[c-${String(i).padStart(2, '0')}]`]));
check('até 10 celulares por conta', (await rpc(`select count(*)::int as n from public.push_devices where user_id = '${C}'`)).n === 10);
await db.exec(`reset role; set role service_role;`);
await db.query(`select public.push_forget_tokens($1)`, [['ExponentPushToken[c-11]']]);
await db.exec(`reset role;`);
check('celular que sumiu é esquecido', (await rpc(`select count(*)::int as n from public.push_devices where token = 'ExponentPushToken[c-11]'`)).n === 0);

// Apagar a conta leva tudo junto.
await as(C, () => db.query(`select public.delete_my_account()`));
check('apagar a conta apaga celulares e preferências', (await rpc(`select (select count(*) from public.push_devices where user_id = '${C}') + (select count(*) from public.push_prefs where user_id = '${C}') as n`)).n == 0);

finish();
