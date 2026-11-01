// Um Postgres de verdade (PGlite) com o mínimo do Supabase, para testar as migrações sem servidor:
// os papéis anon e authenticated, a tabela auth.users e as funções auth.uid() e auth.jwt().
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

/** Sobe o banco e aplica as migrações duas vezes, porque elas precisam aguentar rodar de novo. */
export async function startDb(migrations) {
  const db = new PGlite();
  // UTC, como no Supabase: as funções que olham "hoje" usam o relógio do banco.
  await db.exec(`
    set time zone 'UTC';
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    grant usage on schema auth to anon, authenticated;
    grant usage on schema public to anon, authenticated;
  `);
  const files = migrations.map((name) => readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
  for (const sql of [...files, ...files]) await db.exec(sql);

  /** Roda `fn` como a pessoa `user`, do jeito que o app chega ao Supabase (papel authenticated). */
  async function as(user, fn, anonymous = false) {
    await db.exec(`reset role;`);
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user]);
    await db.query(`select set_config('request.jwt.claims', $1, false)`, [
      JSON.stringify({ sub: user, is_anonymous: anonymous }),
    ]);
    await db.exec(`set role authenticated;`);
    try {
      return await fn();
    } finally {
      await db.exec(`reset role;`);
    }
  }

  return { db, as };
}

let failures = 0;

export function check(name, condition) {
  console.log(`${condition ? 'OK  ' : 'FALHOU'} ${name}`);
  if (!condition) failures += 1;
}

/** A mensagem do erro, ou null quando não deu erro. */
export async function errorOf(fn) {
  try {
    await fn();
    return null;
  } catch (error) {
    return String(error.message ?? error);
  }
}

export function finish() {
  console.log(failures === 0 ? '\nTudo certo.' : `\n${failures} teste(s) falharam.`);
  process.exit(failures === 0 ? 0 : 1);
}
