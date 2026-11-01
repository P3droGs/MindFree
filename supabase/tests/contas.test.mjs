// Testa o SQL das contas: cada um só vê o que é seu, a última mudança vence, a cota da IA e apagar a conta.
// Uso: npm run test:sql (ou node supabase/tests/contas.test.mjs)
import { check, errorOf, finish, startDb } from './local-supabase.mjs';

const { db, as } = await startDb(['20261024120000_contas.sql']);
check('migração aplica duas vezes sem erro', true);

const A = '11111111-1111-1111-1111-111111111111'; // conta de verdade
const B = '22222222-2222-2222-2222-222222222222'; // outra conta de verdade
const C = '33333333-3333-3333-3333-333333333333'; // conta invisível (anônima)

await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}'), ('${C}');`);

const fails = async (fn) => (await errorOf(fn)) !== null;

const insertTask = (id, owner) =>
  db.query(
    `insert into public.tasks (${owner ? 'user_id, ' : ''}id, title, day, minutes, created_at, changed_at)
     values (${owner ? `'${owner}', ` : ''}$1, 'Ligar pro dentista', '2026-10-25', 600, now(), now())`,
    [id],
  );

// A grava e lê as próprias tarefas.
await as(A, async () => {
  await insertTask('tarefa-a1');
  const mine = await db.query(`select id, synced_at from public.tasks`);
  check('A cria e vê a própria tarefa', mine.rows.length === 1);
  const before = mine.rows[0].synced_at;
  await new Promise((resolve) => setTimeout(resolve, 20));
  await db.query(`update public.tasks set done = true, changed_at = now() where id = 'tarefa-a1'`);
  const after = (await db.query(`select synced_at from public.tasks where id = 'tarefa-a1'`)).rows[0].synced_at;
  check('synced_at avança quando a tarefa muda', new Date(after) > new Date(before));
  await db.query(`insert into public.profiles (settings) values ('{"name":"Ana"}')`);
  check('A cria o próprio perfil', (await db.query(`select * from public.profiles`)).rows.length === 1);
});

// Vence a mudança mais recente: um celular atrasado não desfaz nem ressuscita.
await as(A, async () => {
  await db.query(`insert into public.tasks (id, title, day, created_at, changed_at)
                  values ('tarefa-a2', 'Pagar o boleto', '2026-10-25', now(), '2026-10-24T22:00:00Z')`);
  await db.query(`update public.tasks set deleted_at = '2026-10-24T23:00:00Z', changed_at = '2026-10-24T23:00:00Z' where id = 'tarefa-a2'`);
  await db.query(`insert into public.tasks (id, title, day, created_at, changed_at, deleted_at)
                  values ('tarefa-a2', 'Pagar o boleto (versão velha)', '2026-10-25', now(), '2026-10-24T22:30:00Z', null)
                  on conflict (user_id, id) do update set title = excluded.title, changed_at = excluded.changed_at, deleted_at = excluded.deleted_at`);
  const row = (await db.query(`select title, deleted_at from public.tasks where id = 'tarefa-a2'`)).rows[0];
  check('versão mais velha não ressuscita tarefa apagada', row.deleted_at !== null && !row.title.includes('velha'));
  await db.query(`update public.tasks set done = true, changed_at = '2026-10-25T08:00:00Z' where id = 'tarefa-a2'`);
  const newer = (await db.query(`select done from public.tasks where id = 'tarefa-a2'`)).rows[0];
  check('mudança mais nova continua valendo', newer.done === true);
});

// B não enxerga nem mexe no que é de A.
await as(B, async () => {
  check('B não vê as tarefas de A', (await db.query(`select * from public.tasks`)).rows.length === 0);
  check('B não vê o perfil de A', (await db.query(`select * from public.profiles`)).rows.length === 0);
  check('B não consegue criar tarefa em nome de A', await fails(() => insertTask('tarefa-b-falsa', A)));
  const updated = await db.query(`update public.tasks set title = 'hackeado' where id = 'tarefa-a1'`);
  check('B não consegue mudar a tarefa de A', (updated.affectedRows ?? 0) === 0);
  const deleted = await db.query(`delete from public.tasks where id = 'tarefa-a1'`);
  check('B não consegue apagar a tarefa de A', (deleted.affectedRows ?? 0) === 0);
  check('B não lê a tabela de uso da IA', await fails(() => db.query(`select * from public.ai_usage`)));
});

// A conta invisível não grava na nuvem, mas usa a IA com limite menor.
await as(
  C,
  async () => {
    check('conta anônima não grava tarefas', await fails(() => insertTask('tarefa-c1')));
    const results = [];
    for (let i = 0; i < 9; i += 1) results.push((await db.query(`select public.consume_ai_quota() as ok`)).rows[0].ok);
    check('anônima: 8 organizações por dia e a 9ª é recusada', results.slice(0, 8).every(Boolean) && results[8] === false);
  },
  true,
);

await as(A, async () => {
  const results = [];
  for (let i = 0; i < 21; i += 1) results.push((await db.query(`select public.consume_ai_quota() as ok`)).rows[0].ok);
  check('com conta: 20 por dia e a 21ª é recusada', results.slice(0, 20).every(Boolean) && results[20] === false);
});

// Limite total do app: com 300 usos no dia, ninguém mais consegue.
await db.exec(`insert into public.ai_usage (user_id, day, count) values ('${B}', (now() at time zone 'utc')::date, 300 - 29);`);
await as(B, async () => {
  check('limite total de 300 por dia barra todo mundo', (await db.query(`select public.consume_ai_quota() as ok`)).rows[0].ok === false);
});

// Sem login, nada funciona.
await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); set role anon;`);
check('sem login não lê tarefas', await fails(() => db.query(`select * from public.tasks`)));
check('sem login não usa a IA', await fails(() => db.query(`select public.consume_ai_quota()`)));
await db.exec(`reset role;`);

// Apagar a conta leva tudo junto.
await as(A, async () => {
  await db.query(`select public.delete_my_account()`);
});
const leftovers = await db.query(
  `select (select count(*) from auth.users where id = '${A}') as users,
          (select count(*) from public.tasks where user_id = '${A}') as tasks,
          (select count(*) from public.profiles where user_id = '${A}') as profiles,
          (select count(*) from public.ai_usage where user_id = '${A}') as usage`,
);
const row = leftovers.rows[0];
check('apagar a conta remove usuário, tarefas, perfil e uso', [row.users, row.tasks, row.profiles, row.usage].every((n) => Number(n) === 0));

finish();
