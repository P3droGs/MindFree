-- MindFree · rede: avisos (push) de brilho, cutucão, brilho no Mural e pedido para seguir
-- Quando alguém manda um brilho, cutuca, brilha um post ou pede para seguir, um gatilho põe o aviso numa fila
-- (push_outbox) e acorda a função "avisar", que entrega pelo Expo Push. Cada tipo de aviso pode ser desligado
-- nos Ajustes. Entre o lembrete da noite e o resumo da manhã da pessoa (no fuso dela), o aviso chega sem som.
-- O mesmo evento só avisa uma vez (tirar e pôr o brilho de novo não manda outro aviso).
-- Para aplicar: os arquivos das contas, da rede, do bloqueio, do mural e do agendamento do mural precisam ter
-- rodado antes (o endereço do projeto já está no Vault, como "project_url"). Cole este arquivo inteiro no
-- SQL Editor do Supabase e clique em Run (pode rodar de novo sem problema).

-- Tabelas ------------------------------------------------------------------------------------------

-- Os celulares de cada pessoa (o "endereço" do Expo Push). Um celular pertence a uma conta por vez.
create table if not exists public.push_devices (
  token text primary key check (char_length(token) between 10 and 200),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);
create index if not exists push_devices_user on public.push_devices (user_id);

-- O que cada pessoa quer receber, e quando ela dorme (para os avisos chegarem sem som).
create table if not exists public.push_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  shine boolean not null default true,
  poke boolean not null default true,
  mural boolean not null default true,
  requests boolean not null default true,
  night_minutes integer not null default 1350 check (night_minutes between 0 and 1439),
  morning_minutes integer not null default 420 check (morning_minutes between 0 and 1439),
  time_zone text not null default 'America/Sao_Paulo' check (char_length(time_zone) <= 64),
  language text not null default 'pt-BR' check (char_length(language) <= 8),
  updated_at timestamptz not null default now()
);

-- A fila. "ref" diferencia eventos do mesmo tipo (o dia do brilho, o post do Mural).
create table if not exists public.push_outbox (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  from_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('shine', 'poke', 'mural', 'request')),
  ref text not null default '',
  detail text not null default '',
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (user_id, from_id, kind, ref)
);
create index if not exists push_outbox_pending on public.push_outbox (created_at) where sent_at is null;

alter table public.push_devices enable row level security;
alter table public.push_prefs enable row level security;
alter table public.push_outbox enable row level security;
revoke all on public.push_devices, public.push_prefs, public.push_outbox from anon, authenticated;

-- A fila e o envio -------------------------------------------------------------------------------

-- Acorda a função "avisar" na hora. Se não der (sem pg_net ou sem o endereço no Vault), o Cron pega depois.
create or replace function public.push_wake()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url := (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'project_url') || '/functions/v1/avisar',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
exception when others then
  null;
end;
$$;
revoke all on function public.push_wake() from public, anon, authenticated;

-- Põe um aviso na fila, se a pessoa tem celular cadastrado e não desligou esse tipo.
create or replace function public.push_enqueue(p_to uuid, p_from uuid, p_kind text, p_ref text, p_detail text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wants boolean;
begin
  if p_to is null or p_from is null or p_to = p_from then
    return;
  end if;
  if not exists (select 1 from public.push_devices d where d.user_id = p_to) then
    return;
  end if;
  select case p_kind when 'shine' then p.shine when 'poke' then p.poke when 'mural' then p.mural else p.requests end
    into v_wants
    from public.push_prefs p where p.user_id = p_to;
  if v_wants is false then
    return;
  end if;
  insert into public.push_outbox (user_id, from_id, kind, ref, detail)
  values (p_to, p_from, p_kind, coalesce(p_ref, ''), left(coalesce(p_detail, ''), 120))
  on conflict (user_id, from_id, kind, ref) do nothing;
  if found then
    perform public.push_wake();
  end if;
end;
$$;
revoke all on function public.push_enqueue(uuid, uuid, text, text, text) from public, anon, authenticated;

-- Os gatilhos: brilho e cutucão no Céu dos amigos, brilho no Mural e pedido para seguir (conta privada).
create or replace function public.push_on_interaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.push_enqueue(new.to_id, new.from_id, new.kind, new.day::text, '');
  return null;
end;
$$;

create or replace function public.push_on_mural_shine()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author uuid;
  v_task text;
begin
  select m.author_id, m.task_title into v_author, v_task from public.mural_posts m where m.id = new.post_id;
  perform public.push_enqueue(v_author, new.user_id, 'mural', new.post_id::text, v_task);
  return null;
end;
$$;

create or replace function public.push_on_follow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'pending' then
    perform public.push_enqueue(new.followee_id, new.follower_id, 'request', '', '');
  end if;
  return null;
end;
$$;
revoke all on function public.push_on_interaction() from public, anon, authenticated;
revoke all on function public.push_on_mural_shine() from public, anon, authenticated;
revoke all on function public.push_on_follow() from public, anon, authenticated;

drop trigger if exists push_on_interaction on public.interactions;
create trigger push_on_interaction after insert on public.interactions
  for each row execute function public.push_on_interaction();
drop trigger if exists push_on_mural_shine on public.mural_shines;
create trigger push_on_mural_shine after insert on public.mural_shines
  for each row execute function public.push_on_mural_shine();
drop trigger if exists push_on_follow on public.follows;
create trigger push_on_follow after insert on public.follows
  for each row execute function public.push_on_follow();

-- O que o app chama --------------------------------------------------------------------------------

-- Cadastra este celular na conta (se o celular era de outra conta, passa a ser desta). Até 10 por pessoa.
create or replace function public.push_register(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_caller();
begin
  if p_token is null or char_length(p_token) not between 10 and 200 or p_platform not in ('ios', 'android') then
    raise exception 'mindfree:bad_token';
  end if;
  insert into public.push_devices as d (token, user_id, platform) values (p_token, me, p_platform)
  on conflict (token) do update set user_id = me, platform = excluded.platform, updated_at = now();
  insert into public.push_prefs (user_id) values (me) on conflict (user_id) do nothing;
  delete from public.push_devices d
   where d.user_id = me
     and d.token not in (select k.token from public.push_devices k where k.user_id = me order by k.updated_at desc limit 10);
end;
$$;

-- Ao sair da conta: este celular para de receber os avisos dela.
create or replace function public.push_unregister(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.push_devices d where d.token = p_token and d.user_id = auth.uid();
end;
$$;

-- Quais avisos a pessoa quer, e o horário de sono dela (lembrete da noite até o resumo da manhã).
create or replace function public.push_save_prefs(
  p_shine boolean, p_poke boolean, p_mural boolean, p_requests boolean,
  p_night integer, p_morning integer, p_time_zone text, p_language text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_caller();
  v_zone text := coalesce(nullif(btrim(p_time_zone), ''), 'UTC');
begin
  if p_night not between 0 and 1439 or p_morning not between 0 and 1439 then
    raise exception 'mindfree:bad_time';
  end if;
  -- Um fuso que o banco não conhece vira UTC (em vez de quebrar o envio depois).
  begin
    perform now() at time zone v_zone;
  exception when others then
    v_zone := 'UTC';
  end;
  insert into public.push_prefs as p (user_id, shine, poke, mural, requests, night_minutes, morning_minutes, time_zone, language)
  values (me, coalesce(p_shine, true), coalesce(p_poke, true), coalesce(p_mural, true), coalesce(p_requests, true),
          p_night, p_morning, left(v_zone, 64), left(coalesce(p_language, 'pt-BR'), 8))
  on conflict (user_id) do update
    set shine = excluded.shine, poke = excluded.poke, mural = excluded.mural, requests = excluded.requests,
        night_minutes = excluded.night_minutes, morning_minutes = excluded.morning_minutes,
        time_zone = excluded.time_zone, language = excluded.language, updated_at = now();
end;
$$;

revoke all on function public.push_register(text, text) from public, anon;
revoke all on function public.push_unregister(text) from public, anon;
revoke all on function public.push_save_prefs(boolean, boolean, boolean, boolean, integer, integer, text, text) from public, anon;
grant execute on function public.push_register(text, text) to authenticated;
grant execute on function public.push_unregister(text) to authenticated;
grant execute on function public.push_save_prefs(boolean, boolean, boolean, boolean, integer, integer, text, text) to authenticated;

-- O que só a função "avisar" chama (chave de serviço) ----------------------------------------------

-- Pega os próximos avisos da fila e já os marca como enviados. Cada um vem com os celulares de quem recebe,
-- o nome de quem mandou, o idioma e se é hora de sono (sem som). Aviso com mais de 1 dia, ou entre pessoas
-- que agora têm bloqueio, é descartado. Também limpa da fila o que foi enviado há mais de 7 dias.
create or replace function public.push_claim(p_limit integer)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result json;
begin
  delete from public.push_outbox o where o.sent_at < now() - interval '7 days';
  with picked as (
    select o.id from public.push_outbox o
     where o.sent_at is null
     order by o.created_at
     limit greatest(1, least(coalesce(p_limit, 100), 500))
     for update skip locked
  ), marked as (
    update public.push_outbox o set sent_at = now()
      from picked where o.id = picked.id
    returning o.*
  ), ready as (
    select m.*, coalesce(pp.night_minutes, 1350) as night, coalesce(pp.morning_minutes, 420) as morning,
           coalesce(pp.language, 'pt-BR') as language,
           (extract(hour from now() at time zone coalesce(pp.time_zone, 'UTC')) * 60
            + extract(minute from now() at time zone coalesce(pp.time_zone, 'UTC')))::integer as local_minutes
      from marked m
      left join public.push_prefs pp on pp.user_id = m.user_id
     where m.created_at > now() - interval '1 day'
       and not public.social_is_blocked(m.user_id, m.from_id)
  )
  select coalesce(json_agg(json_build_object(
    'id', r.id,
    'kind', r.kind,
    'detail', r.detail,
    'language', r.language,
    'fromName', (select case when btrim(sp.name) = '' then '@' || sp.handle else sp.name end
                   from public.social_profiles sp where sp.user_id = r.from_id),
    'quiet', case when r.night > r.morning then r.local_minutes >= r.night or r.local_minutes < r.morning
                  else r.local_minutes >= r.night and r.local_minutes < r.morning end,
    'tokens', coalesce((select json_agg(json_build_object('token', d.token, 'platform', d.platform))
                          from public.push_devices d where d.user_id = r.user_id), '[]'::json)
  ) order by r.id), '[]'::json) into v_result
  from ready r;
  return v_result;
end;
$$;

-- O Expo avisou que um celular não existe mais (app desinstalado): esquece esse endereço.
create or replace function public.push_forget_tokens(p_tokens text[])
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_devices d where d.token = any (p_tokens);
$$;
revoke all on function public.push_claim(integer) from public, anon, authenticated;
revoke all on function public.push_forget_tokens(text[]) from public, anon, authenticated;
grant execute on function public.push_claim(integer) to service_role;
grant execute on function public.push_forget_tokens(text[]) to service_role;

-- Rede de segurança: se acordar na hora falhar, o Cron chama a "avisar" a cada 10 minutos.
-- (No Postgres local dos testes não há Cron, e esta parte é pulada.)
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $sql$select cron.unschedule(j.jobid) from cron.job j where j.jobname = 'avisar'$sql$;
    execute $sql$
      select cron.schedule('avisar', '*/10 * * * *', $job$
        select net.http_post(
          url := (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'project_url') || '/functions/v1/avisar',
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := '{}'::jsonb);
      $job$)
    $sql$;
  end if;
end;
$cron$;
