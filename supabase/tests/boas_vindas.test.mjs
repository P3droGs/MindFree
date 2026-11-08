// Testa o SQL do e-mail de boas-vindas: o gatilho só dispara para conta confirmada e não anônima, a marca
// de envio vale uma vez por conta e só a chave de serviço mexe nela.
// Uso: npm run test:sql (ou node supabase/tests/boas_vindas.test.mjs)
import { check, errorOf, finish, startDb } from './local-supabase.mjs';

const { db, as } = await startDb([
  '20261024120000_contas.sql',
  '20261027120000_rede.sql',
  '20261101120000_bloquear.sql',
  '20261101180000_mural.sql',
  '20261102120000_avisos.sql',
  '20261104130000_seguranca.sql',
  '20261108130000_boas_vindas.sql',
  '20261108140000_boas_vindas_idioma.sql',
]);
check('migrações aplicam duas vezes sem erro', true);

// O pg_net de mentira dos testes não grava nada; aqui ele passa a anotar cada chamada para o teste ler.
await db.exec(`
  create table if not exists net.calls (url text, body jsonb);
  create or replace function net.http_post(url text, headers jsonb default '{}', body jsonb default '{}') returns bigint
  language sql as $$ insert into net.calls values (url, body) returning 1::bigint $$;
`);

const A = '11111111-1111-1111-1111-111111111111'; // confirmada ao nascer (Google)
const B = '22222222-2222-2222-2222-222222222222'; // nasce sem confirmar, confirma depois (código)
const C = '33333333-3333-3333-3333-333333333333'; // invisível (anônima)
const calls = async () => (await db.query(`select url, body from net.calls order by url`)).rows;

// A: nasce confirmada (Google) e sem idioma: espera o app gravar o idioma.
await db.exec(`insert into auth.users (id, email, email_confirmed_at, is_anonymous) values ('${A}', 'a@teste.dev', now(), false);`);
check('conta do Google sem idioma ainda não chama', (await calls()).length === 0);
await db.exec(`update auth.users set raw_user_meta_data = '{"language":"pt-BR"}'::jsonb where id = '${A}';`);
check('quando o app grava o idioma, chama a função uma vez', (await calls()).length === 1 && (await calls())[0].url.endsWith('/functions/v1/boas-vindas'));
await db.exec(`update auth.users set raw_user_meta_data = '{"language":"pt-BR","name":"Ana"}'::jsonb where id = '${A}';`);
check('mudar outro dado do perfil não chama de novo', (await calls()).length === 1);
check('a chamada leva o id da conta', JSON.stringify((await calls())[0].body).includes(A));

// B: cadastro por e-mail, com o idioma desde o início; o e-mail sai na confirmação.
await db.exec(`insert into auth.users (id, email, email_confirmed_at, is_anonymous, raw_user_meta_data) values ('${B}', 'b@teste.dev', null, false, '{"language":"en"}'::jsonb);`);
check('conta sem confirmar não chama', (await calls()).length === 1);
await db.exec(`update auth.users set email_confirmed_at = now() where id = '${B}';`);
check('confirmar o e-mail chama', (await calls()).length === 2);
await db.exec(`update auth.users set email_confirmed_at = now() where id = '${B}';`);
check('confirmar de novo não chama outra vez', (await calls()).length === 2);

await db.exec(`insert into auth.users (id, email, email_confirmed_at, is_anonymous, raw_user_meta_data) values ('${C}', null, now(), true, '{"language":"es"}'::jsonb);`);
check('conta invisível não chama', (await calls()).length === 2);

await db.exec(`reset role; set role service_role;`);
const first = (await db.query(`select public.welcome_mark('${A}') as m`)).rows[0].m;
const second = (await db.query(`select public.welcome_mark('${A}') as m`)).rows[0].m;
check('a marca vale uma vez: true na primeira, false na segunda', first === true && second === false);
await db.exec(`select public.welcome_unmark('${A}');`);
check('desmarcar permite mandar de novo', (await db.query(`select public.welcome_mark('${A}') as m`)).rows[0].m === true);
await db.exec(`reset role;`);

const asUser = await errorOf(() => as(A, () => db.query(`select public.welcome_mark('${A}')`)));
check('quem tem conta não mexe na marca', /permission denied|denied|permiss/i.test(String(asUser)));
const reads = await errorOf(() => as(A, () => db.query(`select * from public.welcome_emails`)));
check('ninguém lê a tabela pelo app', /permission denied|denied|permiss/i.test(String(reads)));

finish();
