// Testa o SQL do Mural na nuvem: postar, quem vê, brilhos, 7 dias, limpeza e as regras do Storage.
// Uso: npm run test:sql (ou node supabase/tests/mural.test.mjs)
import { check, errorOf, finish, startDb } from './local-supabase.mjs';

const { db, as } = await startDb([
  '20261024120000_contas.sql',
  '20261027120000_rede.sql',
  '20261101120000_bloquear.sql',
  '20261101180000_mural.sql',
]);
check('migrações aplicam duas vezes sem erro', true);

const A = '11111111-1111-1111-1111-111111111111'; // Ana, quem posta (conta pública)
const B = '22222222-2222-2222-2222-222222222222'; // Bruno, segue a Ana
const C = '33333333-3333-3333-3333-333333333333'; // Carla, não segue a Ana
const D = '44444444-4444-4444-4444-444444444444'; // Dani, segue a Ana e depois é bloqueada
const E = '55555555-5555-5555-5555-555555555555'; // Edu, conta privada
const F = '66666666-6666-6666-6666-666666666666'; // Fê, pediu para seguir o Edu (pendente)
const G = '77777777-7777-7777-7777-777777777777'; // Gabi, testa os limites
const N = '88888888-8888-8888-8888-888888888888'; // conta invisível (sem e-mail)
await db.exec(`insert into auth.users (id) values ${[A, B, C, D, E, F, G, N].map((id) => `('${id}')`).join(', ')};`);

const rpc = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const json = async (sql, params = []) => {
  const value = Object.values(await rpc(sql, params))[0];
  return typeof value === 'string' ? JSON.parse(value) : value;
};
const save = (handle, name, isPrivate = false) =>
  json(`select public.social_save_profile($1, $2, '', $3) as p`, [handle, name, isPrivate]);
const follow = (who, target) => as(who, () => rpc(`select public.social_follow($1) as s`, [target]));
const upload = (who, name) =>
  as(who, () => db.query(`insert into storage.objects (bucket_id, name) values ('mural', $1)`, [name]));
const canOpen = async (who, name) =>
  (await as(who, () => db.query(`select 1 from storage.objects where bucket_id = 'mural' and name = $1`, [name]))).rows.length === 1;
const post = (who, photo, task, caption = '') =>
  as(who, () => json(`select public.mural_create($1, $2, $3) as p`, [photo, task, caption]));
const feed = (who) => as(who, () => json(`select public.mural_feed() as f`));
const shine = (who, id, on = true) => as(who, () => db.query(`select public.mural_shine($1, $2)`, [id, on]));
const asService = async (fn) => {
  await db.exec(`reset role; set role service_role;`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role;`);
  }
};

check('o bucket do mural é privado e só aceita JPEG', (await rpc(`select public, allowed_mime_types from storage.buckets where id = 'mural'`)).public === false);

await as(A, () => save('ana', 'Ana'));
await as(B, () => save('bruno', 'Bruno'));
await as(C, () => save('carla', 'Carla'));
await as(D, () => save('dani', ''));
await as(E, () => save('edu', 'Edu', true));
await as(F, () => save('fefe', 'Fê'));
await as(G, () => save('gabi', 'Gabi'));
await follow(B, A);
await follow(D, A);
check('o pedido para a conta privada fica pendente', (await follow(F, E)).s === 'pending');

// Enviar a foto (Storage).
check('envia a foto na própria pasta', (await errorOf(() => upload(A, `${A}/p1.jpg`))) === null);
check('não envia na pasta de outra pessoa', (await errorOf(() => upload(A, `${B}/intrusa.jpg`))) !== null);
check('conta invisível não envia foto', (await errorOf(() => as(N, () => db.query(`insert into storage.objects (bucket_id, name) values ('mural', $1)`, [`${N}/x.jpg`]), true))) !== null);

// Postar.
check('postar sem a foto enviada é recusado', (await errorOf(() => post(A, `${A}/nao-subiu.jpg`, 'Correr')))?.includes('mindfree:photo_missing'));
await upload(B, `${B}/b1.jpg`);
check('postar com a foto de outra pessoa é recusado', (await errorOf(() => post(A, `${B}/b1.jpg`, 'Correr')))?.includes('mindfree:photo_missing'));
check('postar sem tarefa é recusado', (await errorOf(() => post(A, `${A}/p1.jpg`, '   ')))?.includes('mindfree:task_missing'));
const p1 = await post(A, `${A}/p1.jpg`, '  Correr 5 km  ', ' Foi ótimo ');
check(
  'o post volta com os campos do app',
  Object.keys(p1).sort().join(',') ===
    'authorId,caption,createdAt,handle,iShined,id,mine,name,photoPath,shinedBy,shines,taskTitle' &&
    p1.taskTitle === 'Correr 5 km' && p1.caption === 'Foi ótimo' && p1.mine === true && p1.shines === 0,
);
check('conta invisível não posta', (await errorOf(() => as(N, () => json(`select public.mural_create($1, 'x', '') as p`, [`${N}/x.jpg`]), true)))?.includes('mindfree:no_account'));

// Quem vê.
check('a Ana vê o próprio post', (await feed(A)).some((p) => p.id === p1.id && p.mine));
check('o Bruno, que segue, vê o post da Ana', (await feed(B)).some((p) => p.id === p1.id && !p.mine && p.handle === 'ana'));
check('a Carla, que não segue, não vê', !(await feed(C)).some((p) => p.id === p1.id));
check('o Bruno abre a foto da Ana', await canOpen(B, `${A}/p1.jpg`));
check('a Carla não abre a foto da Ana', !(await canOpen(C, `${A}/p1.jpg`)));
check('a Ana abre a própria foto', await canOpen(A, `${A}/p1.jpg`));
await upload(E, `${E}/e1.jpg`);
const e1 = await post(E, `${E}/e1.jpg`, 'Ler um capítulo');
check('pedido pendente não vê o post da conta privada', !(await feed(F)).some((p) => p.id === e1.id) && !(await canOpen(F, `${E}/e1.jpg`)));
check('ninguém lê a tabela de posts direto', (await errorOf(() => as(B, () => db.query(`select * from public.mural_posts`)))) !== null);
check('ninguém lê a tabela de brilhos direto', (await errorOf(() => as(B, () => db.query(`select * from public.mural_shines`)))) !== null);

// Brilhos.
await shine(B, p1.id);
await shine(B, p1.id);
const seenByAna = (await feed(A)).find((p) => p.id === p1.id);
check('a Ana vê 1 brilho, com o nome do Bruno', seenByAna.shines === 1 && seenByAna.shinedBy.join() === 'Bruno');
const seenByBruno = (await feed(B)).find((p) => p.id === p1.id);
check('o Bruno vê que brilhou (sem contar ele mesmo)', seenByBruno.iShined === true && seenByBruno.shines === 0 && seenByBruno.shinedBy.length === 0);
await shine(D, p1.id);
const seenByDani = (await feed(D)).find((p) => p.id === p1.id);
check('outro seguidor vê o número e os nomes', seenByDani.shines === 1 && seenByDani.shinedBy.join() === 'Bruno');
check('sem nome, aparece o @', (await feed(A)).find((p) => p.id === p1.id).shinedBy.join() === '@dani,Bruno');
check('não dá para brilhar o próprio post', (await errorOf(() => shine(A, p1.id)))?.includes('mindfree:not_found'));
check('quem não segue não brilha', (await errorOf(() => shine(C, p1.id)))?.includes('mindfree:not_found'));
await shine(B, p1.id, false);
check('tirar o brilho', (await feed(A)).find((p) => p.id === p1.id).shinedBy.join() === '@dani');

// Bloqueio.
await as(A, () => db.query(`select public.social_block($1)`, [D]));
check('bloqueada não vê mais os posts', !(await feed(D)).some((p) => p.id === p1.id));
check('bloqueada não abre mais a foto', !(await canOpen(D, `${A}/p1.jpg`)));
check('quem bloqueou não vê o nome da bloqueada nos brilhos', (await feed(A)).find((p) => p.id === p1.id).shines === 0);

// Denunciar um post.
await as(B, () => db.query(`select public.mural_report($1, 'offensive', 'foto estranha')`, [p1.id]));
const report = await rpc(`select reported_handle, reason, post_id, post_text from public.social_reports where reporter_id = '${B}'`);
check('a denúncia guarda o post e o texto dele', report.reported_handle === 'ana' && report.post_id === p1.id && report.post_text === 'Correr 5 km · Foi ótimo');
check('quem não vê o post não denuncia', (await errorOf(() => as(C, () => db.query(`select public.mural_report($1, 'spam', '')`, [p1.id]))))?.includes('mindfree:not_found'));
check('motivo estranho recusado', (await errorOf(() => as(B, () => db.query(`select public.mural_report($1, 'bobo', '')`, [p1.id]))))?.includes('mindfree:bad_reason'));

// Apagar.
await upload(A, `${A}/p2.jpg`);
const p2 = await post(A, `${A}/p2.jpg`, 'Arrumar a mesa');
check('outra pessoa não apaga o post', (await as(B, () => rpc(`select public.mural_delete($1) as path`, [p2.id]))).path === null);
check('apagar o próprio post devolve a foto para apagar', (await as(A, () => rpc(`select public.mural_delete($1) as path`, [p2.id]))).path === `${A}/p2.jpg`);
check('o post apagado some do mural', !(await feed(B)).some((p) => p.id === p2.id));
check('outra pessoa não apaga a foto', (await as(B, () => db.query(`delete from storage.objects where name = $1`, [`${A}/p1.jpg`]))).affectedRows === 0);
check('a dona apaga a própria foto', (await as(A, () => db.query(`delete from storage.objects where name = $1`, [`${A}/p2.jpg`]))).affectedRows === 1);

// Limites.
for (let i = 1; i <= 11; i += 1) await upload(G, `${G}/g${i}.jpg`);
for (let i = 1; i <= 10; i += 1) await post(G, `${G}/g${i}.jpg`, `Tarefa ${i}`);
check('até 10 posts por dia', (await errorOf(() => post(G, `${G}/g11.jpg`, 'Mais uma')))?.includes('mindfree:too_many'));
for (let i = 12; i <= 20; i += 1) await upload(G, `${G}/g${i}.jpg`);
check('até 20 fotos enviadas por dia', (await errorOf(() => upload(G, `${G}/g21.jpg`))) !== null);
check('textos longos são cortados (200 na tarefa)', (await rpc(`select max(char_length(task_title)) as n from public.mural_posts`)).n <= 200);

// 7 dias depois.
await db.exec(`update public.mural_posts set created_at = now() - interval '8 days' where id = '${p1.id}';`);
check('depois de 7 dias, o post sai do mural de quem segue', !(await feed(B)).some((p) => p.id === p1.id));
check('e sai do mural de quem postou', !(await feed(A)).some((p) => p.id === p1.id));
check('depois de 7 dias, a foto não abre para quem segue', !(await canOpen(B, `${A}/p1.jpg`)));
check('depois de 7 dias, não dá para brilhar', (await errorOf(() => shine(B, p1.id)))?.includes('mindfree:not_found'));

// Limpeza.
await db.exec(`insert into storage.objects (bucket_id, name, created_at) values
  ('mural', '${C}/sobrou.jpg', now() - interval '2 days'), ('mural', '${C}/recente.jpg', now());`);
check('o app não chama a limpeza', (await errorOf(() => as(A, () => db.query(`select public.mural_cleanup_list(100)`)))) !== null);
const toClean = (await asService(() => rpc(`select public.mural_cleanup_list(100) as paths`))).paths;
check('a limpeza acha a foto do post vencido', toClean.includes(`${A}/p1.jpg`));
check('a limpeza acha a foto que ficou sem post', toClean.includes(`${C}/sobrou.jpg`));
check('a limpeza não mexe na foto recém-enviada', !toClean.includes(`${C}/recente.jpg`) && !toClean.includes(`${G}/g1.jpg`));
const forgot = (await asService(() => rpc(`select public.mural_cleanup_forget($1) as n`, [[`${A}/p1.jpg`, `${G}/g1.jpg`]]))).n;
check('a limpeza apaga só o post vencido', forgot === 1 && (await rpc(`select count(*)::int as n from public.mural_posts where id = '${p1.id}'`)).n === 0);
check('os brilhos do post vencido vão junto', (await rpc(`select count(*)::int as n from public.mural_shines where post_id = '${p1.id}'`)).n === 0);

// Apagar a conta leva os posts junto.
await as(G, () => db.query(`select public.delete_my_account()`));
check('apagar a conta apaga os posts', (await rpc(`select count(*)::int as n from public.mural_posts where author_id = '${G}'`)).n === 0);

finish();
