// Testa o SQL da rede (fase 1): quem vê o quê, pedidos, brilhos, convites e apagar a conta.
// Uso: npm run test:sql (ou node supabase/tests/rede.test.mjs)
import { check, errorOf, finish, startDb } from './local-supabase.mjs';

const { db, as } = await startDb(['20261024120000_contas.sql', '20261027120000_rede.sql', '20261105130000_auditoria.sql']);
check('migrações aplicam duas vezes sem erro', true);

const A = '11111111-1111-1111-1111-111111111111'; // Ana, conta privada
const B = '22222222-2222-2222-2222-222222222222'; // Bruno
const C = '33333333-3333-3333-3333-333333333333'; // Carla, conta pública
const D = '44444444-4444-4444-4444-444444444444'; // Diego, entra por convite
const E = '55555555-5555-5555-5555-555555555555'; // Elisa, pede para seguir
const N = '66666666-6666-6666-6666-666666666666'; // conta de verdade sem @
const X = '99999999-9999-9999-9999-999999999999'; // conta invisível (anônima)

await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}'), ('${C}'), ('${D}'), ('${E}'), ('${N}'), ('${X}');`);

const rpc = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const json = async (sql, params = []) => {
  const row = await rpc(sql, params);
  const value = Object.values(row)[0];
  return typeof value === 'string' ? JSON.parse(value) : value;
};
const save = (handle, name = '', isPrivate = true) =>
  json(`select public.social_save_profile($1, $2, '', $3) as p`, [handle, name, isPrivate]);

// As datas saem do relógio do banco, como no Supabase: o brilho só aceita dias perto de hoje.
const dates = (
  await db.query(`
    select current_date::text as today,
           date_trunc('week', current_date)::date::text as monday,
           (case when extract(isodow from current_date) = 1 then current_date + 1 else current_date - 1 end)::text as other_day,
           (current_date - 7)::text as last_week`)
).rows[0];
const TODAY = dates.today;
const MONDAY = dates.monday;
// Outro dia da mesma semana, e um da semana passada, que fica fora do céu da semana.
const OTHER_DAY = dates.other_day;
const LAST_WEEK = dates.last_week;
const STARS_THIS_MONTH = new Set([OTHER_DAY, TODAY, LAST_WEEK].filter((day) => day.slice(0, 7) === TODAY.slice(0, 7))).size;

// 1. Quem pode entrar na rede.
check('conta invisível não entra na rede', (await errorOf(() => as(X, () => save('anonimo'), true)))?.includes('mindfree:no_account'));
check('conta sem @ recebe perfil nulo', (await as(N, () => json(`select public.social_profile() as p`))) === null);
check(
  'conta sem @ não usa a rede (no_profile)',
  (await errorOf(() => as(N, () => json(`select public.social_orbit($1) as o`, [TODAY]))))?.includes('mindfree:no_profile'),
);
check(
  'ninguém lê a tabela de perfis direto',
  (await errorOf(() => as(B, () => db.query(`select * from public.social_profiles`)))) !== null,
);
check(
  'ninguém lê os códigos de convite direto',
  (await errorOf(() => as(B, () => db.query(`select * from public.invite_codes`)))) !== null,
);

// 2. Criar o perfil e o @.
const ana = await as(A, () => save('@Ana.Ribeiro', 'Ana Ribeiro'));
check('o @ vira minúsculo e sem o "@"', ana.handle === 'ana.ribeiro');
check('a conta começa privada', ana.private === true);
check('nasce o código de convite (6 letras fáceis)', /^[A-HJ-NP-Z2-9]{6}$/.test(ana.code ?? ''));
for (const bad of ['a', '.ana', 'ana.', 'ana ribeiro', 'ána', 'a'.repeat(31)]) {
  check(`@ inválido recusado: "${bad}"`, (await errorOf(() => as(B, () => save(bad))))?.includes('mindfree:handle_invalid'));
}
check('@ repetido recusado', (await errorOf(() => as(B, () => save('ana.ribeiro'))))?.includes('mindfree:handle_taken'));
await as(B, () => save('bruno', 'Bruno Lima'));
await as(C, () => save('carla', 'Carla Souza', false));
await as(D, () => save('diego', 'Diego'));
await as(E, () => save('elisa', 'Elisa'));
const anaAgain = await as(A, () => save('ana.ribeiro', 'Ana R.'));
check('mudar o próprio perfil mantém o mesmo código', anaAgain.code === ana.code && anaAgain.name === 'Ana R.');

// 3. Busca.
const found = await as(B, () => json(`select public.social_search($1, $2) as s`, ['an', TODAY]));
check('busca acha pelo começo do @', found.some((p) => p.handle === 'ana.ribeiro'));
check('busca não mostra a própria pessoa', !(await as(A, () => json(`select public.social_search($1, $2) as s`, ['ana', TODAY]))).some((p) => p.handle === 'ana.ribeiro'));
check('busca acha pelo nome', (await as(A, () => json(`select public.social_search($1, $2) as s`, ['souza', TODAY]))).some((p) => p.handle === 'carla'));
check('busca com % não vira curinga', (await as(B, () => json(`select public.social_search($1, $2) as s`, ['%%', TODAY]))).length === 0);
check('busca com 1 letra não procura', (await as(B, () => json(`select public.social_search($1, $2) as s`, ['a', TODAY]))).length === 0);

// 4. Seguir conta privada vira pedido; as estrelas ficam escondidas até aprovar.
// A Ana gravou duas vezes hoje, uma em outro dia da semana e uma na semana passada.
await as(A, () =>
  db.query(
    `insert into public.nights (id, day, at, noted, via, changed_at) values
       ('n1', $1, 1380, 3, 'voz', now()), ('n2', $2, 1390, 2, 'texto', now()),
       ('n3', $2, 1400, 1, 'voz', now()), ('n4', $3, 1380, 1, 'voz', now())`,
    [OTHER_DAY, TODAY, LAST_WEEK],
  ),
);
check('seguir conta privada fica pendente', (await as(B, () => rpc(`select public.social_follow($1) as s`, [A]))).s === 'pending');
const beforeAccept = (await as(B, () => json(`select public.social_search($1, $2) as s`, ['ana', TODAY]))).find((p) => p.handle === 'ana.ribeiro');
check('pedido pendente não vê as estrelas', beforeAccept.starsMonth === null && beforeAccept.litToday === null && beforeAccept.iFollow === 'pending');
check('pendente não aparece no céu da semana', (await as(B, () => json(`select public.social_friends_week($1, $2) as w`, [MONDAY, TODAY]))).length === 0);
const anaProfile = await as(A, () => json(`select public.social_profile() as p`));
check('Ana vê 1 pedido', anaProfile.requests === 1);
const anaOrbit = await as(A, () => json(`select public.social_orbit($1) as o`, [TODAY]));
check('o pedido aparece na órbita da Ana', anaOrbit.requests.length === 1 && anaOrbit.requests[0].handle === 'bruno');
await as(A, () => db.query(`select public.social_respond($1, true)`, [B]));
const week = await as(B, () => json(`select public.social_friends_week($1, $2) as w`, [MONDAY, TODAY]));
check('aprovado: a Ana aparece no céu do Bruno', week.length === 1 && week[0].handle === 'ana.ribeiro');
check('o céu mostra só os dias da semana, sem repetir', JSON.stringify(week[0].days) === JSON.stringify([OTHER_DAY, TODAY].sort()));
check('o céu não leva tarefas, horários nem quantidade', Object.keys(week[0]).sort().join(',') === 'days,handle,name,poked,shined,userId');
const anaForBruno = (await as(B, () => json(`select public.social_orbit($1) as o`, [TODAY]))).following.find((p) => p.handle === 'ana.ribeiro');
check('aprovado: vê as estrelas do mês e a de hoje', anaForBruno.starsMonth === STARS_THIS_MONTH && anaForBruno.litToday === true);
check('quem não segue não vê a Ana no céu', (await as(C, () => json(`select public.social_friends_week($1, $2) as w`, [MONDAY, TODAY]))).length === 0);

// 5. Conta pública entra na hora.
check('seguir conta pública entra na hora', (await as(B, () => rpc(`select public.social_follow($1) as s`, [C]))).s === 'accepted');
check('não dá para seguir a si mesmo', (await errorOf(() => as(B, () => rpc(`select public.social_follow($1) as s`, [B]))))?.includes('mindfree:not_found'));

// 6. Brilho e cutucão.
await as(B, () => db.query(`select public.social_interact($1, 'shine', $2, true)`, [A, TODAY]));
await as(B, () => db.query(`select public.social_interact($1, 'shine', $2, true)`, [A, TODAY]));
const shined = await as(B, () => json(`select public.social_friends_week($1, $2) as w`, [MONDAY, TODAY]));
check('o brilho fica marcado (e não duplica)', shined.find((p) => p.handle === 'ana.ribeiro').shined === true);
check(
  'quem não segue não manda brilho',
  (await errorOf(() => as(C, () => db.query(`select public.social_interact($1, 'shine', $2, true)`, [A, TODAY]))))?.includes('mindfree:not_following'),
);
check(
  'tipo estranho recusado',
  (await errorOf(() => as(B, () => db.query(`select public.social_interact($1, 'like', $2, true)`, [A, TODAY]))))?.includes('mindfree:bad_kind'),
);
check(
  'dia muito longe recusado',
  (await errorOf(() => as(B, () => db.query(`select public.social_interact($1, 'poke', '2020-01-01', true)`, [A]))))?.includes('mindfree:bad_day'),
);
const activity = await as(A, () => json(`select public.social_activity() as a`));
check('a Ana vê o brilho e quem entrou na órbita', activity.some((e) => e.kind === 'shine' && e.handle === 'bruno') && activity.some((e) => e.kind === 'follow' && e.handle === 'bruno'));
const carlaActivity = await as(C, () => json(`select public.social_activity() as a`));
check(
  'a Carla vê só o que é dela (o Bruno seguindo), não o brilho da Ana',
  carlaActivity.length === 1 && carlaActivity[0].kind === 'follow' && carlaActivity[0].handle === 'bruno',
);
await as(B, () => db.query(`select public.social_interact($1, 'shine', $2, false)`, [A, TODAY]));
check('tirar o brilho funciona', (await as(B, () => json(`select public.social_friends_week($1, $2) as w`, [MONDAY, TODAY]))).find((p) => p.handle === 'ana.ribeiro').shined === false);

// 7. Convites.
check('o próprio código não vale', (await as(A, () => json(`select public.social_use_invite($1) as r`, [ana.code]))).reason === 'own_code');
check('código errado avisa', (await as(B, () => json(`select public.social_use_invite($1) as r`, ['ZZZZZZ']))).reason === 'code_not_found');
for (let i = 0; i < 10; i += 1) await as(E, () => json(`select public.social_use_invite($1) as r`, ['WRONG' + i]));
check('depois de 10 códigos errados, espera o dia seguinte', (await as(E, () => json(`select public.social_use_invite($1) as r`, [ana.code]))).reason === 'too_many');
const used = await as(D, () => json(`select public.social_use_invite($1) as r`, [ana.code.toLowerCase()]));
check('código certo (até em minúsculas) liga os dois', used.ok === true && used.friend.handle === 'ana.ribeiro');
check('quem entrou pelo convite já vê as estrelas', used.friend.litToday === true);
await as(D, () => json(`select public.social_use_invite($1) as r`, [ana.code]));
const anaAfterInvite = await as(A, () => json(`select public.social_profile() as p`));
check('o convite conta uma vez só (estrela cadente)', anaAfterInvite.invites === 1);
check('quem foi convidado também ganha', (await as(D, () => json(`select public.social_profile() as p`))).invited === true);
check(
  'convite liga nos dois sentidos, aprovado',
  (await as(A, () => json(`select public.social_friends_week($1, $2) as w`, [MONDAY, TODAY]))).some((p) => p.handle === 'diego'),
);

// 8. Conta que vira pública aprova quem estava esperando.
check('pedido da Elisa fica pendente', (await as(E, () => rpc(`select public.social_follow($1) as s`, [A]))).s === 'pending');
await as(A, () => save('ana.ribeiro', 'Ana R.', false));
check('virou pública: o pedido entra', (await as(E, () => json(`select public.social_friends_week($1, $2) as w`, [MONDAY, TODAY]))).some((p) => p.handle === 'ana.ribeiro'));

// 9. Recusar e deixar de seguir.
check('Ana volta a ser privada', (await as(A, () => save('ana.ribeiro', 'Ana R.', true))).private === true);
await as(N, () => save('nina', 'Nina'));
await as(N, () => rpc(`select public.social_follow($1) as s`, [A]));
await as(A, () => db.query(`select public.social_respond($1, false)`, [N]));
check('recusado: o pedido some', (await as(N, () => json(`select public.social_orbit($1) as o`, [TODAY]))).following.length === 0);
await as(B, () => db.query(`select public.social_unfollow($1)`, [A]));
check('deixou de seguir: some do céu', !(await as(B, () => json(`select public.social_friends_week($1, $2) as w`, [MONDAY, TODAY]))).some((p) => p.handle === 'ana.ribeiro'));

// 10. Apagar a conta leva junto o perfil, os seguidores, os brilhos e os convites.
await as(A, () => db.query(`select public.delete_my_account()`));
const leftovers = await rpc(`
  select (select count(*) from public.social_profiles where user_id = '${A}') as profiles,
         (select count(*) from public.follows where follower_id = '${A}' or followee_id = '${A}') as follows,
         (select count(*) from public.interactions where from_id = '${A}' or to_id = '${A}') as interactions,
         (select count(*) from public.invite_uses where inviter_id = '${A}' or invitee_id = '${A}') as invites,
         (select count(*) from public.invite_codes where user_id = '${A}') as codes`);
check(
  'apagar a conta apaga tudo da rede',
  Object.values(leftovers).every((value) => Number(value) === 0),
);
check('o @ fica livre de novo', (await as(B, () => json(`select public.social_search($1, $2) as s`, ['ana', TODAY]))).length === 0);

// Nome e bio sem caracteres invisíveis nem de controle (auditoria B5): o gatilho limpa em qualquer caminho.
const Z = '77777777-7777-7777-7777-777777777777';
await db.exec(`insert into auth.users (id) values ('${Z}');`);
await as(Z, async () => {
  await json(`select public.social_save_profile($1, $2, $3, $4) as p`, ['zeca', 'Ze​ca\u0007 Silva\n', '\tfaz‮ bolo\nde cenoura ', false]);
  const me = await json(`select public.social_profile() as p`);
  check('nome perde o invisível e os controles viram um espaço só', me.name === 'Zeca Silva');
  check('bio idem', me.bio === 'faz bolo de cenoura');
});

finish();
