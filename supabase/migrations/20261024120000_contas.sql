-- MindFree · contas e nuvem (fase 1)
-- O que fica guardado para quem cria uma conta: tarefas, noites (sem áudio e sem transcrição) e ajustes.
-- Regra de ouro: cada pessoa só lê e escreve o que é dela (RLS), e quem usa sem conta (anônimo) não grava nada.
-- Para aplicar: cole este arquivo inteiro no SQL Editor do Supabase e clique em Run.

-- Marca a hora em que a linha chegou ou mudou no servidor: é por ela que os outros celulares puxam as novidades.
-- Vence a mudança mais recente: se um celular que ficou sem internet manda uma versão mais velha,
-- ela é ignorada (assim uma tarefa apagada em outro aparelho não volta).
create or replace function public.touch_synced_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.changed_at < old.changed_at then
    return old;
  end if;
  new.synced_at := now();
  return new;
end;
$$;

-- Verdadeiro para quem tem conta de verdade (e-mail e senha), falso para a conta invisível.
create or replace function public.is_permanent_user()
returns boolean
language sql
stable
set search_path = ''
as $$
  select auth.uid() is not null and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$$;

-- Tarefas ------------------------------------------------------------------------------------------
create table if not exists public.tasks (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) <= 64),
  title text not null check (char_length(title) <= 200),
  note text check (char_length(note) <= 300),
  day date not null,
  minutes smallint check (minutes between 0 and 1439),
  reminder boolean not null default true,
  done boolean not null default false,
  night_id text check (char_length(night_id) <= 64),
  created_at timestamptz not null,
  changed_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists tasks_user_synced on public.tasks (user_id, synced_at);
drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before insert or update on public.tasks
  for each row execute function public.touch_synced_at();

-- Noites (as estrelas do céu) ----------------------------------------------------------------------
create table if not exists public.nights (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) <= 64),
  day date not null,
  at smallint not null check (at between 0 and 1439),
  noted smallint not null default 0 check (noted between 0 and 100),
  via text not null check (via in ('voz', 'texto')),
  pending boolean not null default false,
  changed_at timestamptz not null,
  deleted_at timestamptz,
  synced_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists nights_user_synced on public.nights (user_id, synced_at);
drop trigger if exists nights_touch on public.nights;
create trigger nights_touch before insert or update on public.nights
  for each row execute function public.touch_synced_at();

-- Perfil e ajustes (nome, cores, horários, idioma...) ----------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb check (pg_column_size(settings) <= 8192),
  changed_at timestamptz not null default now()
);

-- Quem pode o quê ----------------------------------------------------------------------------------
alter table public.tasks enable row level security;
alter table public.nights enable row level security;
alter table public.profiles enable row level security;

revoke all on public.tasks, public.nights, public.profiles from anon;
grant select, insert, update, delete on public.tasks, public.nights, public.profiles to authenticated;

drop policy if exists "tarefas: ler as minhas" on public.tasks;
drop policy if exists "tarefas: criar as minhas" on public.tasks;
drop policy if exists "tarefas: mudar as minhas" on public.tasks;
drop policy if exists "tarefas: apagar as minhas" on public.tasks;
create policy "tarefas: ler as minhas" on public.tasks for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "tarefas: criar as minhas" on public.tasks for insert to authenticated
  with check ((select auth.uid()) = user_id and (select public.is_permanent_user()));
create policy "tarefas: mudar as minhas" on public.tasks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and (select public.is_permanent_user()));
create policy "tarefas: apagar as minhas" on public.tasks for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "noites: ler as minhas" on public.nights;
drop policy if exists "noites: criar as minhas" on public.nights;
drop policy if exists "noites: mudar as minhas" on public.nights;
drop policy if exists "noites: apagar as minhas" on public.nights;
create policy "noites: ler as minhas" on public.nights for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "noites: criar as minhas" on public.nights for insert to authenticated
  with check ((select auth.uid()) = user_id and (select public.is_permanent_user()));
create policy "noites: mudar as minhas" on public.nights for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and (select public.is_permanent_user()));
create policy "noites: apagar as minhas" on public.nights for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "perfil: ler o meu" on public.profiles;
drop policy if exists "perfil: criar o meu" on public.profiles;
drop policy if exists "perfil: mudar o meu" on public.profiles;
create policy "perfil: ler o meu" on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "perfil: criar o meu" on public.profiles for insert to authenticated
  with check ((select auth.uid()) = user_id and (select public.is_permanent_user()));
create policy "perfil: mudar o meu" on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and (select public.is_permanent_user()));

-- Limite de uso da IA ------------------------------------------------------------------------------
-- Conta por pessoa e por dia (UTC). Ninguém lê ou escreve esta tabela direto: só a função abaixo.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

-- Gasta uma organização do dia. Devolve falso quando a pessoa (ou o app inteiro) passou do limite.
-- Limites: 8 por dia sem conta, 20 com conta e 300 no total do app por dia (protege os créditos
-- mesmo que alguém crie muitas contas anônimas). Para mudar, edite os números e rode de novo.
create or replace function public.consume_ai_quota()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'utc')::date;
  personal_limit integer := case when public.is_permanent_user() then 20 else 8 end;
  global_limit integer := 300;
  total integer;
  used integer;
begin
  if me is null then
    return false;
  end if;
  select coalesce(sum(u.count), 0) into total from public.ai_usage u where u.day = today;
  if total >= global_limit then
    return false;
  end if;
  insert into public.ai_usage as u (user_id, day, count) values (me, today, 1)
    on conflict (user_id, day) do update set count = u.count + 1
    returning u.count into used;
  return used <= personal_limit;
end;
$$;
revoke all on function public.consume_ai_quota() from public, anon;
grant execute on function public.consume_ai_quota() to authenticated;

-- Apagar a conta (pedido pela Apple e pela LGPD) ---------------------------------------------------
-- Apaga o usuário; as tarefas, noites, perfil e contagens somem junto (on delete cascade).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
