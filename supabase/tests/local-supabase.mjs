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
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz, is_anonymous boolean not null default false, raw_user_meta_data jsonb not null default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    grant usage on schema auth to anon, authenticated;
    grant usage on schema public to anon, authenticated;
    create role service_role nologin;
    -- O Storage, do jeito que as políticas do Supabase o veem: buckets, objects (com RLS) e foldername().
    create schema storage;
    create table storage.buckets (
      id text primary key, name text not null, public boolean default false,
      file_size_limit bigint, allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id),
      name text, owner_id text default auth.uid()::text, created_at timestamptz default now(),
      unique (bucket_id, name)
    );
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as
      $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
    grant usage on schema storage to anon, authenticated, service_role;
    grant select, insert, delete on storage.objects to anon, authenticated, service_role;
    grant usage on schema public to service_role;
    -- O Vault, do jeito que o SQL o lê: os dois segredos que o servidor de verdade tem.
    create schema vault;
    create table vault.decrypted_secrets (name text primary key, decrypted_secret text);
    insert into vault.decrypted_secrets values ('project_url', 'https://teste.supabase.co'), ('service_role_key', 'chave-de-teste');
    -- O pg_net, só a assinatura (não há rede nos testes).
    create schema extensions;
    create schema net;
    create function net.http_post(url text, headers jsonb default '{}', body jsonb default '{}') returns bigint language sql as $$ select 1::bigint $$;
    grant usage on schema net, extensions, vault to anon, authenticated, service_role;
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
