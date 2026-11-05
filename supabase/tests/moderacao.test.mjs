// Testa o SQL da moderação: suspender, apagar post, descartar, avisos para quem foi moderado e o postar
// só pela função do servidor. Uso: npm run test:sql (ou node supabase/tests/moderacao.test.mjs)
import { check, errorOf, finish, startDb } from './local-supabase.mjs';

const { db, as } = await startDb([
  '20261024120000_contas.sql',
  '20261027120000_rede.sql',
  '20261101120000_bloquear.sql',
  '20261101180000_mural.sql',
  '20261102120000_avisos.sql',
  '20261103120000_moderacao.sql',
  '20261104130000_seguranca.sql',
  '20261104140000_rede_rapida.sql',
  '20261104150000_rate_limit.sql',
  '20261105130000_auditoria.sql',
]);
check('migrações aplicam duas vezes sem erro', true);

const A = '11111111-1111-1111-1111-111111111111'; // Ana, posta
const B = '22222222-2222-2222-2222-222222222222'; // Bruno, segue a Ana e denuncia
const C = '33333333-3333-3333-3333-333333333333'; // Carla, segue a Ana
await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}'), ('${C}');`);

const rpc = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const json = async (sql, params = []) => {
  const value = Object.values(await rpc(sql, params))[0];
  return typeof value === 'string' ? JSON.parse(value) : value;
};
const today = (await rpc(`select current_date::text as d`)).d;
const service = async (fn) => {
  await db.exec(`reset role; set role service_role;`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role;`);
  }
};
const post = async (who, name, task) => {
  await db.exec(`insert into storage.objects (bucket_id, name, owner_id) values ('mural', '${who}/${name}', '${who}');`);
  return service(() => json(`select public.mural_create_for($1, $2, $3, '') as p`, [who, `${who}/${name}`, task]));
};
const feed = (who) => as(who, () => json(`select public.mural_feed() as f`));
const search = (who, q) => as(who, () => json(`select public.social_search($1, $2) as s`, [q, today]));
const notices = (who) => as(who, () => json(`select public.mod_my_notices() as n`));

await as(A, () => json(`select public.social_save_profile('ana', 'Ana', '', false) as p`));
await as(B, () => json(`select public.social_save_profile('bruno', 'Bruno', '', false) as p`));
await as(C, () => json(`select public.social_save_profile('carla', 'Carla', '', false) as p`));
await as(B, () => db.query(`select public.social_follow($1)`, [A]));
await as(C, () => db.query(`select public.social_follow($1)`, [A]));
await as(A, () => db.query(`select public.social_follow($1)`, [B]));

// Postar só pela função do servidor.
await db.exec(`insert into storage.objects (bucket_id, name, owner_id) values ('mural', '${A}/direto.jpg', '${A}');`);
check('o app não posta direto (sem o filtro)', (await errorOf(() => as(A, () => db.query(`select public.mural_create($1, 'x', '')`, [`${A}/direto.jpg`])))) !== null);
check('ninguém do app chama o mural_create_for', (await errorOf(() => as(A, () => db.query(`select public.mural_create_for($1, $2, 'x', '')`, [A, `${A}/direto.jpg`])))) !== null);
const p1 = await post(A, 'p1.jpg', 'Correr 5 km');
check('a função do servidor posta em nome da pessoa', p1.mine === true && p1.taskTitle === 'Correr 5 km');
check('com a foto de outra pessoa, não', (await errorOf(() => service(() => db.query(`select public.mural_create_for($1, $2, 'x', '')`, [B, `${A}/p1.jpg`]))))?.includes('mindfree:photo_missing'));
check('o post aparece para quem segue', (await feed(B)).some((p) => p.id === p1.id));

// Denúncias e a fila.
await as(B, () => db.query(`select public.mural_report($1, 'offensive', 'foto ruim')`, [p1.id]));
await as(C, () => db.query(`select public.mural_report($1, 'spam', '')`, [p1.id]));
let queue = (await db.query(`select * from public.moderation_queue`)).rows;
check('a fila mostra as duas denúncias abertas', queue.length === 2 && queue.every((r) => r.post_no_ar === true && r.denunciado === 'ana'));
check('a fila conta as denúncias contra a pessoa', queue[0].denuncias_abertas_contra === 2 || queue[0].denuncias_abertas_contra === 2n);
check('ninguém do app lê a fila', (await errorOf(() => as(B, () => db.query(`select * from public.moderation_queue`)))) !== null);
check('ninguém do app chama os comandos', (await errorOf(() => as(B, () => db.query(`select public.mod_delete_post($1)`, [p1.id])))) !== null);

// Descartar.
const dismiss = (await rpc(`select public.mod_dismiss($1) as r`, [queue.find((r) => r.quem_denunciou === 'carla').denuncia])).r;
check('descartar tira a denúncia da fila', dismiss === 'Denúncia descartada.' && (await db.query(`select * from public.moderation_queue`)).rows.length === 1);
await as(C, () => db.query(`select public.mural_report($1, 'spam', 'de novo')`, [p1.id]));
check('denunciar de novo reabre', (await db.query(`select * from public.moderation_queue`)).rows.length === 2);

// Apagar o post.
const removed = (await rpc(`select public.mod_delete_post($1, 'offensive') as r`, [p1.id])).r;
check('apagar o post responde que deu certo', removed.startsWith('Post apagado'));
check('o post sai do mural', !(await feed(B)).some((p) => p.id === p1.id));
check('as denúncias do post saem da fila', (await db.query(`select * from public.moderation_queue`)).rows.length === 0);
let n = await notices(A);
check('quem postou recebe o aviso com o motivo e a tarefa', n.length === 1 && n[0].kind === 'post_removed' && n[0].reason === 'offensive' && n[0].detail === 'Correr 5 km');
check('o aviso não diz quem denunciou', !JSON.stringify(n).includes('bruno') && !JSON.stringify(n).includes('carla'));
await as(A, () => db.query(`select public.mod_notice_seen($1)`, [n[0].id]));
check('visto, o aviso não volta', (await notices(A)).length === 0);
check('apagar um post que não existe avisa', (await rpc(`select public.mod_delete_post($1) as r`, [p1.id])).r.startsWith('Nenhum post'));

// Suspender.
const p2 = await post(A, 'p2.jpg', 'Arrumar a mesa');
await as(B, () => db.query(`select public.social_report($1, 'harassment', '')`, [A]));
check('suspender responde que deu certo', (await rpc(`select public.mod_suspend('@Ana', 'harassment') as r`)).r.startsWith('Conta suspensa'));
check('suspensa, a pessoa não usa a rede', (await errorOf(() => feed(A)))?.includes('mindfree:suspended'));
check('o perfil dela diz que está suspensa', (await as(A, () => json(`select public.social_profile() as p`))).suspended === true);
check('ela recebe o aviso da suspensão', (await notices(A)).some((x) => x.kind === 'suspended' && x.reason === 'harassment'));
check('os posts dela somem do mural de quem segue', !(await feed(B)).some((p) => p.id === p2.id));
check('ela some da busca', !(await search(C, 'ana')).some((p) => p.handle === 'ana'));
check('ela some da órbita de quem segue', !(await as(B, () => json(`select public.social_orbit($1) as o`, [today]))).following.some((p) => p.handle === 'ana'));
check('ela some do céu da semana', !(await as(B, () => json(`select public.social_friends_week($1, $2) as w`, [today, today]))).some((f) => f.handle === 'ana'));
check('o número de seguidores dos outros não conta ela', (await as(B, () => json(`select public.social_profile() as p`))).followers === 0);
check('não dá para seguir quem está suspenso', (await errorOf(() => as(C, () => db.query(`select public.social_unfollow($1)`, [A])))) === null && (await errorOf(() => as(C, () => db.query(`select public.social_follow($1)`, [A]))))?.includes('mindfree:not_found'));
check('ela não posta', (await errorOf(() => post(A, 'p3.jpg', 'x')))?.includes('mindfree:suspended'));
check('as denúncias contra ela saem da fila', (await db.query(`select * from public.moderation_queue`)).rows.length === 0);
check('suspender um @ que não existe avisa', (await rpc(`select public.mod_suspend('ninguem') as r`)).r.startsWith('Nenhuma conta'));

// Reativar.
check('reativar responde que deu certo', (await rpc(`select public.mod_unsuspend('ana') as r`)).r === 'Conta reativada.');
check('reativada, volta a usar a rede', (await errorOf(() => feed(A))) === null);
check('e volta a aparecer para quem segue', (await feed(B)).some((p) => p.id === p2.id));
check('ela recebe o aviso de que voltou', (await notices(A)).some((x) => x.kind === 'unsuspended'));

// Apagar a conta leva os avisos junto.
await as(A, () => db.query(`select public.delete_my_account()`));
check('apagar a conta apaga os avisos', (await rpc(`select count(*)::int as n from public.moderation_notices where user_id = '${A}'`)).n === 0);

// Limite de chamadas por minuto: a busca aguenta 30 e a 31ª para; as leituras gerais, 120; a janela é por minuto.
{
  const results = [];
  for (let i = 0; i < 31; i += 1) results.push(await errorOf(() => as(B, () => json(`select public.social_search($1, $2) as s`, ['an', today]))));
  check('busca: 30 por minuto passam', results.slice(0, 30).every((e) => e === null));
  check('busca: a 31ª é recusada com too_many', results[30]?.includes('mindfree:too_many'));
  check('o limite da busca não trava as leituras gerais', (await errorOf(() => as(B, () => json(`select public.social_orbit($1) as o`, [today])))) === null);
  await db.exec(`update public.rate_hits set minute = minute - interval '1 minute' where action = 'busca';`);
  check('no minuto seguinte a busca volta', (await errorOf(() => as(B, () => json(`select public.social_search($1, $2) as s`, ['an', today])))) === null);
  check('ninguém lê a tabela de contagem', (await errorOf(() => as(B, () => db.query(`select * from public.rate_hits`)))) !== null);
}

finish();
