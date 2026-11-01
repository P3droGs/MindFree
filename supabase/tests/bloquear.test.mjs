// Testa o SQL de bloquear, denunciar e remover seguidor.
// Uso: npm run test:sql (ou node supabase/tests/bloquear.test.mjs)
import { check, errorOf, finish, startDb } from './local-supabase.mjs';

const { db, as } = await startDb(['20261024120000_contas.sql', '20261027120000_rede.sql', '20261101120000_bloquear.sql']);
check('migrações aplicam duas vezes sem erro', true);

const A = '11111111-1111-1111-1111-111111111111'; // Ana, conta pública
const B = '22222222-2222-2222-2222-222222222222'; // Bruno
const C = '33333333-3333-3333-3333-333333333333'; // Carla
await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}'), ('${C}');`);

const rpc = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const json = async (sql, params = []) => {
  const value = Object.values(await rpc(sql, params))[0];
  return typeof value === 'string' ? JSON.parse(value) : value;
};
const today = (await rpc(`select current_date::text as d`)).d;
const save = (handle, isPrivate) => json(`select public.social_save_profile($1, '', '', $2) as p`, [handle, isPrivate]);
const search = (who, q) => as(who, () => json(`select public.social_search($1, $2) as s`, [q, today]));
const follow = (who, target) => as(who, () => rpc(`select public.social_follow($1) as s`, [target]));
const count = async (sql) => Number((await rpc(sql)).n);

const ana = await as(A, () => save('ana', false));
const bruno = await as(B, () => save('bruno', false));
await as(C, () => save('carla', false));

// Antes do bloqueio: os dois se seguem e trocam brilhos.
await follow(A, B);
await follow(B, A);
await as(A, () => db.query(`select public.social_interact($1, 'shine', $2, true)`, [B, today]));
await as(B, () => db.query(`select public.social_interact($1, 'poke', $2, true)`, [A, today]));
check('antes: Bruno acha a Ana na busca', (await search(B, 'ana')).some((p) => p.handle === 'ana'));

// Bloquear.
await as(A, () => db.query(`select public.social_block($1)`, [B]));
check('bloquear desfaz o seguir nos dois sentidos', (await count(`select count(*) as n from public.follows where '${A}' in (follower_id, followee_id) and '${B}' in (follower_id, followee_id)`)) === 0);
check('bloquear apaga os brilhos e cutucões entre os dois', (await count(`select count(*) as n from public.interactions where '${A}' in (from_id, to_id) and '${B}' in (from_id, to_id)`)) === 0);
check('quem foi bloqueado não acha quem bloqueou', !(await search(B, 'ana')).some((p) => p.handle === 'ana'));
check('quem bloqueou também não acha o bloqueado', !(await search(A, 'bruno')).some((p) => p.handle === 'bruno'));
check('os outros continuam achando os dois', (await search(C, 'an')).some((p) => p.handle === 'ana') && (await search(C, 'bru')).some((p) => p.handle === 'bruno'));
check('o bloqueado não consegue seguir', (await errorOf(() => follow(B, A)))?.includes('mindfree:not_found'));
check('quem bloqueou também não consegue seguir', (await errorOf(() => follow(A, B)))?.includes('mindfree:not_found'));
check(
  'o bloqueado não manda brilho',
  (await errorOf(() => as(B, () => db.query(`select public.social_interact($1, 'shine', $2, true)`, [A, today]))))?.includes('mindfree:not_following'),
);
const invite = await as(B, () => json(`select public.social_use_invite($1) as r`, [ana.code]));
check('o código de quem bloqueou responde como inexistente', invite.ok === false && invite.reason === 'code_not_found');
check('a Ana não recebe aviso nenhum do Bruno', !(await as(A, () => json(`select public.social_activity() as a`))).some((e) => e.handle === 'bruno'));
check('bloquear duas vezes não dá erro', (await errorOf(() => as(A, () => db.query(`select public.social_block($1)`, [B])))) === null);
check('não dá para bloquear a si mesmo', (await errorOf(() => as(A, () => db.query(`select public.social_block($1)`, [A]))))?.includes('mindfree:not_found'));

const list = await as(A, () => json(`select public.social_blocked_list() as l`));
check('a lista de bloqueados mostra o Bruno', list.length === 1 && list[0].handle === 'bruno' && Object.keys(list[0]).sort().join(',') === 'handle,name,userId');
check('o Bruno não vê quem o bloqueou', (await as(B, () => json(`select public.social_blocked_list() as l`))).length === 0);
check('ninguém lê a tabela de bloqueios direto', (await errorOf(() => as(A, () => db.query(`select * from public.social_blocks`)))) !== null);

// Desbloquear.
await as(A, () => db.query(`select public.social_unblock($1)`, [B]));
check('desbloqueado: o Bruno acha a Ana de novo', (await search(B, 'ana')).some((p) => p.handle === 'ana'));
check('desbloqueado: o seguir não volta sozinho', (await count(`select count(*) as n from public.follows where follower_id = '${B}' and followee_id = '${A}'`)) === 0);
check('desbloqueado: dá para seguir de novo', (await follow(B, A)).s === 'accepted');

// Remover seguidor.
await as(A, () => db.query(`select public.social_remove_follower($1)`, [B]));
check('remover seguidor tira o Bruno da órbita da Ana', (await as(A, () => json(`select public.social_profile() as p`))).followers === 0);
check('removido pode pedir de novo (não é bloqueio)', (await follow(B, A)).s === 'accepted');

// Denunciar.
await as(A, () => db.query(`select public.social_report($1, 'spam', '  mandou link estranho  ')`, [C]));
await as(A, () => db.query(`select public.social_report($1, 'harassment', '')`, [C]));
const reports = (await db.query(`select reporter_id, reported_handle, reason, details from public.social_reports`)).rows;
check('a denúncia fica guardada com o @ (e repetir só atualiza)', reports.length === 1 && reports[0].reported_handle === 'carla' && reports[0].reason === 'harassment');
check('motivo estranho recusado', (await errorOf(() => as(A, () => db.query(`select public.social_report($1, 'bobo', '')`, [C]))))?.includes('mindfree:bad_reason'));
check('não dá para denunciar a si mesmo', (await errorOf(() => as(A, () => db.query(`select public.social_report($1, 'spam', '')`, [A]))))?.includes('mindfree:not_found'));
check('ninguém lê as denúncias pelo app', (await errorOf(() => as(C, () => db.query(`select * from public.social_reports`)))) !== null);
check('texto da denúncia limitado a 500', (await errorOf(() => as(B, () => db.query(`select public.social_report($1, 'other', $2)`, [C, 'x'.repeat(900)])))) === null);

// Apagar a conta leva bloqueios e denúncias junto.
await as(A, () => db.query(`select public.social_block($1)`, [C]));
await as(A, () => db.query(`select public.delete_my_account()`));
check('apagar a conta apaga bloqueios e denúncias da pessoa', (await count(`select (select count(*) from public.social_blocks where '${A}' in (blocker_id, blocked_id)) + (select count(*) from public.social_reports where reporter_id = '${A}') as n`)) === 0);
check('bruno segue com o perfil', bruno.handle === 'bruno');

finish();
