// Testa o SQL das contas: cada um só vê o que é seu, a última mudança vence, a cota da IA e apagar a conta.
// Uso: npm run test:sql (ou node supabase/tests/contas.test.mjs)
import { check, errorOf, finish, startDb } from './local-supabase.mjs';

const { db, as } = await startDb(['20261024120000_contas.sql', '20261104120000_cota_ia.sql', '20261105130000_auditoria.sql', '20261108120000_cota_menor.sql']);
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
    for (let i = 0; i < 4; i += 1) results.push((await db.query(`select public.consume_ai_quota() as ok`)).rows[0].ok);
    check('anônima: 3 organizações por dia e a 4ª é recusada', results.slice(0, 3).every(Boolean) && results[3] === false);
  },
  true,
);

await as(A, async () => {
  const results = [];
  for (let i = 0; i < 11; i += 1) results.push((await db.query(`select public.consume_ai_quota() as ok`)).rows[0].ok);
  check('com conta: 10 por dia e a 11ª é recusada', results.slice(0, 10).every(Boolean) && results[10] === false);
});

// O teto das invisíveis: 20 por dia entre todas. Quem tem conta não é travado por elas.
const D = '44444444-4444-4444-4444-444444444444'; // outra conta invisível, que abusou
await db.exec(`insert into auth.users (id) values ('${D}');`);
await db.exec(`insert into public.ai_usage (user_id, day, count, anonymous) values ('${D}', (now() at time zone 'utc')::date, 20 - 3, true);`);
await as(C, async () => {
  check('teto das invisíveis (20) barra outra invisível', (await db.query(`select public.consume_ai_quota() as ok`)).rows[0].ok === false);
}, true);
await as(B, async () => {
  check('com o teto das invisíveis cheio, quem tem conta continua organizando', (await db.query(`select public.consume_ai_quota() as ok`)).rows[0].ok === true);
});
await db.exec(`insert into public.ai_usage (user_id, day, count, anonymous) values ('${A}', (now() at time zone 'utc')::date, 60, false) on conflict (user_id, day) do update set count = 60;`);
const anonymousUsed = (await db.query(`select coalesce(sum(count), 0)::int as n from public.ai_usage where anonymous`)).rows[0].n;
// C registrou 4 (a tentativa recusada pelo limite pessoal também conta) e D, 17: as 60 de A ficam de fora.
check('uso das contas de verdade não conta no teto das invisíveis', anonymousUsed === 21);

// O teto das contas com e-mail (60 por dia entre todas): A sozinha já gastou 60, então B não organiza mais.
await as(B, async () => {
  check('teto das contas com e-mail (60) barra quem tem conta', (await db.query(`select public.consume_ai_quota() as ok`)).rows[0].ok === false);
});
// A IA falhou para A: a função organizar devolve a organização com a chave de serviço, e o teto reabre.
await db.exec(`reset role; set role service_role;`);
await db.exec(`select public.refund_ai_quota_for('${A}'); select public.refund_ai_quota_for('${A}');`);
await db.exec(`reset role;`);
const refunded = (await db.query(`select count from public.ai_usage where user_id = '${A}' and day = (now() at time zone 'utc')::date`)).rows[0].count;
check('devolver tira uma organização de quem usou', Number(refunded) === 58);
await as(B, async () => {
  check('com a devolução, o teto das contas com e-mail reabre', (await db.query(`select public.consume_ai_quota() as ok`)).rows[0].ok === true);
  check('quem tem conta não devolve a própria cota', await fails(() => db.query(`select public.refund_ai_quota_for('${B}')`)));
});
// (como superusuário do Postgres local, sem passar pelas políticas: só para zerar o uso de B)
await db.exec(`reset role;`);
await db.exec(`update public.ai_usage set count = 0 where user_id = '${B}';`);
await db.exec(`set role service_role;`);
await db.exec(`select public.refund_ai_quota_for('${B}');`);
await db.exec(`reset role;`);
check('devolver não deixa o uso negativo', Number((await db.query(`select count from public.ai_usage where user_id = '${B}'`)).rows[0].count) === 0);

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
