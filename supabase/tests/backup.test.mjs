// Testa o SQL da cópia de segurança: o retrato traz todas as tabelas do app com as linhas, deixa as
// efêmeras de fora, e só a chave de serviço consegue pedi-lo.
// Uso: npm run test:sql (ou node supabase/tests/backup.test.mjs)
import { check, errorOf, finish, startDb } from './local-supabase.mjs';

const { db, as } = await startDb([
  '20261024120000_contas.sql',
  '20261027120000_rede.sql',
  '20261101120000_bloquear.sql',
  '20261101180000_mural.sql',
  '20261102120000_avisos.sql',
  '20261103120000_moderacao.sql',
  '20261104120000_cota_ia.sql',
  '20261104130000_seguranca.sql',
  '20261104140000_rede_rapida.sql',
  '20261104150000_rate_limit.sql',
  '20261105120000_backup.sql',
]);
check('migrações aplicam duas vezes sem erro', true);

const A = '11111111-1111-1111-1111-111111111111';
await db.exec(`insert into auth.users (id) values ('${A}');`);
// Como superusuário do Postgres local, sem passar pelas políticas: só para ter o que fotografar.
await db.query(
  `insert into public.tasks (user_id, id, title, note, day, minutes, reminder, done, created_at, changed_at)
   values ($1, 'tarefa-1', 'Pagar a conta', 'até sexta', current_date, 540, true, false, now(), now())`,
  [A],
);
await db.query(`insert into public.rate_hits (user_id, action, minute, count) values ($1, 'geral', date_trunc('minute', now()), 1)`, [A]);

const snapshot = async () => {
  await db.exec(`reset role; set role service_role;`);
  try {
    const value = Object.values((await db.query(`select public.backup_snapshot() as s`)).rows[0])[0];
    return typeof value === 'string' ? JSON.parse(value) : value;
  } finally {
    await db.exec(`reset role;`);
  }
};

const snap = await snapshot();
check('o retrato diz de onde é e quando foi tirado', snap.app === 'MindFree' && typeof snap.takenAt === 'string');
check('leva a tarefa com todos os campos', snap.tables.tasks.length === 1 && snap.tables.tasks[0].title === 'Pagar a conta' && snap.tables.tasks[0].note === 'até sexta');
check(
  'leva as tabelas principais, mesmo vazias',
  ['profiles', 'nights', 'social_profiles', 'follows', 'mural_posts', 'push_devices', 'push_outbox', 'social_reports', 'ai_usage'].every(
    (name) => Array.isArray(snap.tables[name]),
  ),
);
check('deixa as efêmeras de fora', !('rate_hits' in snap.tables) && !('push_wake_log' in snap.tables));
check('não leva vistas (a fila de moderação é uma vista)', !('moderation_queue' in snap.tables));

const asUser = await errorOf(() => as(A, () => db.query(`select public.backup_snapshot()`)));
check('quem tem conta não consegue pedir o retrato', /permission denied|denied|permiss/i.test(String(asUser)));
await db.exec(`reset role; set role anon;`);
const asAnon = await errorOf(() => db.query(`select public.backup_snapshot()`));
await db.exec(`reset role;`);
check('sem login também não', /permission denied|denied|permiss/i.test(String(asAnon)));

const bucket = (await db.query(`select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'backups'`)).rows[0];
check('o bucket "backups" é privado, 50 MB e só JSON', bucket && bucket.public === false && Number(bucket.file_size_limit) === 52428800);

finish();
