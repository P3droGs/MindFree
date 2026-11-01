-- MindFree · rede, fase 1 (céu dos amigos)
-- Perfil público (@, nome, bio, conta privada), quem segue quem, convites, brilhos e cutucões.
-- Regra de ouro: os amigos veem só os DIAS em que a pessoa acendeu uma estrela. Nunca tarefas, falas,
-- transcrições nem horários. Só contas de verdade (e-mail e senha) entram na rede.
-- Ninguém lê ou escreve estas tabelas direto: tudo passa pelas funções abaixo, que conferem quem pode o quê.
-- Para aplicar: o arquivo das contas (20261024120000_contas.sql) precisa ter rodado antes.
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em Run (pode rodar de novo sem problema).

-- Tabelas ------------------------------------------------------------------------------------------

-- O que os outros veem de você: o @ (único, só letras minúsculas, números, ponto e _), nome e bio.
create table if not exists public.social_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9](?:[a-z0-9._]{1,28}[a-z0-9])$'),
  name text not null default '' check (char_length(name) <= 60),
  bio text not null default '' check (char_length(bio) <= 80),
  -- Privada: só quem você aprova vê suas estrelas.
  private boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- O código de convite de cada pessoa (6 letras e números fáceis de ler).
create table if not exists public.invite_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$')
);

-- Quem entrou pelo convite de quem (cada pessoa conta uma vez): é a estrela cadente dos dois.
create table if not exists public.invite_uses (
  invitee_id uuid primary key references auth.users (id) on delete cascade,
  inviter_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (invitee_id <> inviter_id)
);
create index if not exists invite_uses_inviter on public.invite_uses (inviter_id);

-- Códigos errados por dia (para ninguém sair testando códigos até achar o de alguém).
create table if not exists public.invite_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0,
  primary key (user_id, day)
);

-- Quem segue quem. Pendente até a pessoa aprovar (conta privada).
create table if not exists public.follows (
  follower_id uuid not null references public.social_profiles (user_id) on delete cascade,
  followee_id uuid not null references public.social_profiles (user_id) on delete cascade,
  status text not null check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists follows_followee on public.follows (followee_id, status);

-- Brilho (parabéns por acender a estrela) e cutucão (lembrete). Um de cada por pessoa e por dia.
create table if not exists public.interactions (
  id bigint generated always as identity primary key,
  from_id uuid not null references public.social_profiles (user_id) on delete cascade,
  to_id uuid not null references public.social_profiles (user_id) on delete cascade,
  kind text not null check (kind in ('shine', 'poke')),
  day date not null,
  created_at timestamptz not null default now(),
  unique (from_id, to_id, kind, day),
  check (from_id <> to_id)
);
create index if not exists interactions_to on public.interactions (to_id, created_at desc);

-- Ninguém acessa estas tabelas direto (sem políticas, a segurança por linha bloqueia tudo).
alter table public.social_profiles enable row level security;
alter table public.invite_codes enable row level security;
alter table public.invite_uses enable row level security;
alter table public.invite_attempts enable row level security;
alter table public.follows enable row level security;
alter table public.interactions enable row level security;
revoke all on public.social_profiles, public.invite_codes, public.invite_uses, public.invite_attempts,
  public.follows, public.interactions from anon, authenticated;

-- Funções internas (o app não chama) ---------------------------------------------------------------

-- Quem está chamando, se já está na rede (conta de verdade com @). Senão, para com um erro claro.
create or replace function public.social_caller()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null or not public.is_permanent_user() then
    raise exception 'mindfree:no_account';
  end if;
  if not exists (select 1 from public.social_profiles p where p.user_id = me) then
    raise exception 'mindfree:no_profile';
  end if;
  return me;
end;
$$;

-- Uma pessoa como `p_me` a vê. As estrelas (do mês e de hoje) só aparecem para quem a segue, aprovado.
create or replace function public.social_person(p_user uuid, p_me uuid, p_today date)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'userId', p.user_id,
    'handle', p.handle,
    'name', p.name,
    'private', p.private,
    'iFollow', coalesce(
      (select f.status from public.follows f where f.follower_id = p_me and f.followee_id = p.user_id), 'none'),
    'followsMe', exists (
      select 1 from public.follows f
       where f.follower_id = p.user_id and f.followee_id = p_me and f.status = 'accepted'),
    'starsMonth', case when v.visible then (
      select count(distinct n.day) from public.nights n
       where n.user_id = p.user_id and n.deleted_at is null
         and n.day >= date_trunc('month', p_today)::date
         and n.day < (date_trunc('month', p_today) + interval '1 month')::date) end,
    'litToday', case when v.visible then exists (
      select 1 from public.nights n
       where n.user_id = p.user_id and n.deleted_at is null and n.day = p_today) end
  )
  from public.social_profiles p
  cross join lateral (
    select p.user_id = p_me or exists (
      select 1 from public.follows f
       where f.follower_id = p_me and f.followee_id = p.user_id and f.status = 'accepted') as visible
  ) v
  where p.user_id = p_user;
$$;

revoke all on function public.social_caller() from public, anon, authenticated;
revoke all on function public.social_person(uuid, uuid, date) from public, anon, authenticated;

-- O que o app chama -------------------------------------------------------------------------------

-- O seu perfil na rede, com os números (seguidores, seguindo, pedidos, convites). Nulo se ainda não entrou.
create or replace function public.social_profile()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null or not public.is_permanent_user() then
    raise exception 'mindfree:no_account';
  end if;
  return (
    select json_build_object(
      'userId', p.user_id,
      'handle', p.handle,
      'name', p.name,
      'bio', p.bio,
      'private', p.private,
      'code', (select c.code from public.invite_codes c where c.user_id = me),
      'invites', (select count(*) from public.invite_uses u where u.inviter_id = me),
      'invited', exists (select 1 from public.invite_uses u where u.invitee_id = me),
      'followers', (select count(*) from public.follows f where f.followee_id = me and f.status = 'accepted'),
      'following', (select count(*) from public.follows f where f.follower_id = me and f.status = 'accepted'),
      'requests', (select count(*) from public.follows f where f.followee_id = me and f.status = 'pending')
    )
    from public.social_profiles p
    where p.user_id = me
  );
end;
$$;

-- Entra na rede ou muda o perfil. Na primeira vez, cria também o código de convite.
create or replace function public.social_save_profile(p_handle text, p_name text, p_bio text, p_private boolean)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  v_handle text := lower(btrim(coalesce(p_handle, '')));
  v_private boolean := coalesce(p_private, true);
  v_code text;
  v_bytes bytea;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if me is null or not public.is_permanent_user() then
    raise exception 'mindfree:no_account';
  end if;
  if left(v_handle, 1) = '@' then
    v_handle := substr(v_handle, 2);
  end if;
  if v_handle !~ '^[a-z0-9](?:[a-z0-9._]{1,28}[a-z0-9])$' then
    raise exception 'mindfree:handle_invalid';
  end if;
  if exists (select 1 from public.social_profiles p where p.handle = v_handle and p.user_id <> me) then
    raise exception 'mindfree:handle_taken';
  end if;

  insert into public.social_profiles as p (user_id, handle, name, bio, private)
  values (me, v_handle, left(btrim(coalesce(p_name, '')), 60), left(btrim(coalesce(p_bio, '')), 80), v_private)
  on conflict (user_id) do update
    set handle = excluded.handle, name = excluded.name, bio = excluded.bio,
        private = excluded.private, updated_at = now();

  -- A conta ficou pública: quem estava esperando a aprovação entra.
  if not v_private then
    update public.follows f set status = 'accepted', accepted_at = now()
     where f.followee_id = me and f.status = 'pending';
  end if;

  if not exists (select 1 from public.invite_codes c where c.user_id = me) then
    loop
      v_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
      v_code := '';
      for i in 0..5 loop
        v_code := v_code || substr(alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
      end loop;
      begin
        insert into public.invite_codes (user_id, code) values (me, v_code);
        exit;
      exception when unique_violation then
        -- Código repetido: sorteia outro (ou já foi criado por outro pedido ao mesmo tempo).
        exit when exists (select 1 from public.invite_codes c where c.user_id = me);
      end;
    end loop;
  end if;

  return public.social_profile();
exception when unique_violation then
  raise exception 'mindfree:handle_taken';
end;
$$;

-- Procura pessoas pelo @ (começo) ou pelo nome (qualquer parte). Pelo menos 2 letras, até 20 resultados.
create or replace function public.social_search(p_query text, p_today date)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_caller();
  q text := lower(btrim(coalesce(p_query, '')));
begin
  if left(q, 1) = '@' then
    q := substr(q, 2);
  end if;
  if char_length(q) < 2 then
    return '[]'::json;
  end if;
  q := replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_');
  return coalesce((
    select json_agg(public.social_person(found.user_id, me, p_today) order by found.by_handle desc, found.handle)
    from (
      select p.user_id, p.handle, p.handle like q || '%' as by_handle
      from public.social_profiles p
      where p.user_id <> me and (p.handle like q || '%' or lower(p.name) like '%' || q || '%')
      order by by_handle desc, p.handle
      limit 20
    ) found
  ), '[]'::json);
end;
$$;

-- Seguir: conta pública entra na hora; conta privada vira pedido. Devolve o estado ('pending' ou 'accepted').
create or replace function public.social_follow(p_target uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_caller();
  v_status text;
begin
  if p_target is null or p_target = me then
    raise exception 'mindfree:not_found';
  end if;
  select case when p.private then 'pending' else 'accepted' end into v_status
    from public.social_profiles p where p.user_id = p_target;
  if v_status is null then
    raise exception 'mindfree:not_found';
  end if;
  insert into public.follows (follower_id, followee_id, status, accepted_at)
  values (me, p_target, v_status, case when v_status = 'accepted' then now() end)
  on conflict (follower_id, followee_id) do nothing;
  return (select f.status from public.follows f where f.follower_id = me and f.followee_id = p_target);
end;
$$;

-- Deixar de seguir (ou cancelar um pedido ainda não aprovado).
create or replace function public.social_unfollow(p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_caller();
begin
  delete from public.follows f where f.follower_id = me and f.followee_id = p_target;
end;
$$;

-- Aceitar ou recusar um pedido para entrar na sua órbita.
create or replace function public.social_respond(p_follower uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_caller();
begin
  if p_accept then
    update public.follows f set status = 'accepted', accepted_at = now()
     where f.follower_id = p_follower and f.followee_id = me and f.status = 'pending';
  else
    delete from public.follows f
     where f.follower_id = p_follower and f.followee_id = me and f.status = 'pending';
  end if;
end;
$$;

-- A órbita: quem te segue, quem você segue (com os pedidos que você mandou) e os pedidos para você.
create or replace function public.social_orbit(p_today date)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_caller();
begin
  return json_build_object(
    'followers', coalesce((
      select json_agg(public.social_person(f.follower_id, me, p_today) order by f.accepted_at desc)
      from public.follows f where f.followee_id = me and f.status = 'accepted'), '[]'::json),
    'following', coalesce((
      select json_agg(public.social_person(f.followee_id, me, p_today) order by f.created_at desc)
      from public.follows f where f.follower_id = me), '[]'::json),
    'requests', coalesce((
      select json_agg(public.social_person(f.follower_id, me, p_today) order by f.created_at desc)
      from public.follows f where f.followee_id = me and f.status = 'pending'), '[]'::json)
  );
end;
$$;

-- O céu da semana: para cada pessoa que você segue (aprovado), os dias com estrela, de segunda a domingo,
-- e se você já mandou brilho ou cutucão hoje. Só os dias: nada de tarefas, falas ou horários.
create or replace function public.social_friends_week(p_monday date, p_today date)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_caller();
begin
  if p_monday is null or p_today is null then
    raise exception 'mindfree:bad_day';
  end if;
  return coalesce((
    select json_agg(json_build_object(
      'userId', p.user_id,
      'handle', p.handle,
      'name', p.name,
      'days', (
        select coalesce(json_agg(d.day order by d.day), '[]'::json)
        from (
          select distinct n.day from public.nights n
           where n.user_id = p.user_id and n.deleted_at is null
             and n.day between p_monday and p_monday + 6
        ) d),
      'shined', exists (
        select 1 from public.interactions i
         where i.from_id = me and i.to_id = p.user_id and i.kind = 'shine' and i.day = p_today),
      'poked', exists (
        select 1 from public.interactions i
         where i.from_id = me and i.to_id = p.user_id and i.kind = 'poke' and i.day = p_today)
    ) order by f.accepted_at)
    from public.follows f
    join public.social_profiles p on p.user_id = f.followee_id
    where f.follower_id = me and f.status = 'accepted'
  ), '[]'::json);
end;
$$;

-- Mandar (ou tirar) um brilho, ou cutucar. Só para quem você segue, aprovado.
create or replace function public.social_interact(p_target uuid, p_kind text, p_day date, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_caller();
begin
  if p_kind is null or p_kind not in ('shine', 'poke') then
    raise exception 'mindfree:bad_kind';
  end if;
  if p_day is null or p_day < current_date - 2 or p_day > current_date + 2 then
    raise exception 'mindfree:bad_day';
  end if;
  if not exists (
    select 1 from public.follows f
     where f.follower_id = me and f.followee_id = p_target and f.status = 'accepted') then
    raise exception 'mindfree:not_following';
  end if;
  if coalesce(p_on, true) then
    insert into public.interactions (from_id, to_id, kind, day)
    values (me, p_target, p_kind, p_day)
    on conflict (from_id, to_id, kind, day) do nothing;
  else
    delete from public.interactions i
     where i.from_id = me and i.to_id = p_target and i.kind = p_kind and i.day = p_day;
  end if;
end;
$$;

-- O que aconteceu com você nos últimos 30 dias: brilhos, cutucões e quem entrou na sua órbita.
create or replace function public.social_activity()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_caller();
begin
  return (
    select coalesce(json_agg(x.e order by x.at desc), '[]'::json)
    from (
      (select json_build_object('kind', i.kind, 'userId', p.user_id, 'handle', p.handle, 'name', p.name,
                                'at', i.created_at) as e,
              i.created_at as at
         from public.interactions i
         join public.social_profiles p on p.user_id = i.from_id
        where i.to_id = me and i.created_at > now() - interval '30 days')
      union all
      (select json_build_object('kind', 'follow', 'userId', p.user_id, 'handle', p.handle, 'name', p.name,
                                'at', f.accepted_at) as e,
              f.accepted_at as at
         from public.follows f
         join public.social_profiles p on p.user_id = f.follower_id
        where f.followee_id = me and f.status = 'accepted' and f.accepted_at > now() - interval '30 days')
      order by at desc
      limit 40
    ) x
  );
end;
$$;

-- Usar o código de convite de alguém: os dois passam a se seguir (aprovado, porque o código foi dado de propósito)
-- e, na primeira vez, ganham a estrela cadente. Erro de código vem como { ok: false } (assim a tentativa conta).
create or replace function public.social_use_invite(p_code text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_caller();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_inviter uuid;
  v_tries integer;
  today date := (now() at time zone 'utc')::date;
begin
  select a.count into v_tries from public.invite_attempts a where a.user_id = me and a.day = today;
  if coalesce(v_tries, 0) >= 10 then
    return json_build_object('ok', false, 'reason', 'too_many');
  end if;
  select c.user_id into v_inviter from public.invite_codes c where c.code = v_code;
  if v_inviter is null then
    insert into public.invite_attempts as a (user_id, day, count) values (me, today, 1)
      on conflict (user_id, day) do update set count = a.count + 1;
    return json_build_object('ok', false, 'reason', 'code_not_found');
  end if;
  if v_inviter = me then
    return json_build_object('ok', false, 'reason', 'own_code');
  end if;
  insert into public.follows as f (follower_id, followee_id, status, accepted_at)
  values (me, v_inviter, 'accepted', now()), (v_inviter, me, 'accepted', now())
  on conflict (follower_id, followee_id) do update
    set status = 'accepted', accepted_at = coalesce(f.accepted_at, now());
  insert into public.invite_uses (invitee_id, inviter_id) values (me, v_inviter)
    on conflict (invitee_id) do nothing;
  return json_build_object('ok', true, 'friend', public.social_person(v_inviter, me, today));
end;
$$;

revoke all on function public.social_profile() from public, anon;
revoke all on function public.social_save_profile(text, text, text, boolean) from public, anon;
revoke all on function public.social_search(text, date) from public, anon;
revoke all on function public.social_follow(uuid) from public, anon;
revoke all on function public.social_unfollow(uuid) from public, anon;
revoke all on function public.social_respond(uuid, boolean) from public, anon;
revoke all on function public.social_orbit(date) from public, anon;
revoke all on function public.social_friends_week(date, date) from public, anon;
revoke all on function public.social_interact(uuid, text, date, boolean) from public, anon;
revoke all on function public.social_activity() from public, anon;
revoke all on function public.social_use_invite(text) from public, anon;
grant execute on function public.social_profile() to authenticated;
grant execute on function public.social_save_profile(text, text, text, boolean) to authenticated;
grant execute on function public.social_search(text, date) to authenticated;
grant execute on function public.social_follow(uuid) to authenticated;
grant execute on function public.social_unfollow(uuid) to authenticated;
grant execute on function public.social_respond(uuid, boolean) to authenticated;
grant execute on function public.social_orbit(date) to authenticated;
grant execute on function public.social_friends_week(date, date) to authenticated;
grant execute on function public.social_interact(uuid, text, date, boolean) to authenticated;
grant execute on function public.social_activity() to authenticated;
grant execute on function public.social_use_invite(text) to authenticated;
