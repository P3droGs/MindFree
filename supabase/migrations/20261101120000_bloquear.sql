-- MindFree · rede: bloquear, denunciar e remover seguidor
-- Bloquear some dos dois lados: desfaz o seguir nos dois sentidos, apaga os brilhos e cutucões entre os dois,
-- e um não acha mais o outro na busca nem consegue seguir, pedir ou usar o convite. Quem foi bloqueado não é avisado.
-- A denúncia vai para uma tabela que só o dono do app vê, no painel do Supabase (Table Editor › social_reports).
-- Para aplicar: os arquivos das contas e da rede (20261024120000_contas.sql e 20261027120000_rede.sql) precisam ter
-- rodado antes. Cole este arquivo inteiro no SQL Editor do Supabase e clique em Run (pode rodar de novo sem problema).
-- Atenção: este arquivo troca a busca, o seguir e o convite da rede. Se o arquivo da rede rodar de novo, rode este
-- logo depois, senão o bloqueio para de valer nessas três funções.

-- Tabelas ------------------------------------------------------------------------------------------

create table if not exists public.social_blocks (
  blocker_id uuid not null references public.social_profiles (user_id) on delete cascade,
  blocked_id uuid not null references public.social_profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists social_blocks_blocked on public.social_blocks (blocked_id);

-- Uma denúncia por pessoa denunciada (denunciar de novo atualiza o motivo). O @ fica guardado para quem for ler.
create table if not exists public.social_reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references public.social_profiles (user_id) on delete cascade,
  reported_id uuid not null references public.social_profiles (user_id) on delete cascade,
  reported_handle text not null,
  reason text not null check (reason in ('spam', 'offensive', 'harassment', 'other')),
  details text not null default '' check (char_length(details) <= 500),
  created_at timestamptz not null default now(),
  unique (reporter_id, reported_id),
  check (reporter_id <> reported_id)
);

alter table public.social_blocks enable row level security;
alter table public.social_reports enable row level security;
revoke all on public.social_blocks, public.social_reports from anon, authenticated;

-- Função interna: um dos dois bloqueou o outro? ------------------------------------------------------

create or replace function public.social_is_blocked(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.social_blocks b
     where (b.blocker_id = p_a and b.blocked_id = p_b) or (b.blocker_id = p_b and b.blocked_id = p_a));
$$;
revoke all on function public.social_is_blocked(uuid, uuid) from public, anon, authenticated;

-- Funções que o app chama ---------------------------------------------------------------------------

-- Bloquear: guarda o bloqueio e apaga tudo o que ligava os dois (seguir, pedidos, brilhos e cutucões).
create or replace function public.social_block(p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_caller();
begin
  if p_target is null or p_target = me
     or not exists (select 1 from public.social_profiles p where p.user_id = p_target) then
    raise exception 'mindfree:not_found';
  end if;
  insert into public.social_blocks (blocker_id, blocked_id) values (me, p_target) on conflict do nothing;
  delete from public.follows f
   where (f.follower_id = me and f.followee_id = p_target) or (f.follower_id = p_target and f.followee_id = me);
  delete from public.interactions i
   where (i.from_id = me and i.to_id = p_target) or (i.from_id = p_target and i.to_id = me);
end;
$$;

create or replace function public.social_unblock(p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_caller();
begin
  delete from public.social_blocks b where b.blocker_id = me and b.blocked_id = p_target;
end;
$$;

-- Quem você bloqueou (para desbloquear em Ajustes).
create or replace function public.social_blocked_list()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_caller();
begin
  return coalesce((
    select json_agg(json_build_object('userId', p.user_id, 'handle', p.handle, 'name', p.name) order by b.created_at desc)
      from public.social_blocks b
      join public.social_profiles p on p.user_id = b.blocked_id
     where b.blocker_id = me
  ), '[]'::json);
end;
$$;

-- Tirar alguém dos seus seguidores (ela não é avisada e pode pedir de novo; para impedir, é bloquear).
create or replace function public.social_remove_follower(p_follower uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_caller();
begin
  delete from public.follows f where f.follower_id = p_follower and f.followee_id = me;
end;
$$;

create or replace function public.social_report(p_target uuid, p_reason text, p_details text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_caller();
  v_handle text;
begin
  if p_reason is null or p_reason not in ('spam', 'offensive', 'harassment', 'other') then
    raise exception 'mindfree:bad_reason';
  end if;
  select p.handle into v_handle from public.social_profiles p where p.user_id = p_target;
  if v_handle is null or p_target = me then
    raise exception 'mindfree:not_found';
  end if;
  insert into public.social_reports as r (reporter_id, reported_id, reported_handle, reason, details)
  values (me, p_target, v_handle, p_reason, left(btrim(coalesce(p_details, '')), 500))
  on conflict (reporter_id, reported_id) do update
    set reason = excluded.reason, details = excluded.details, reported_handle = excluded.reported_handle,
        created_at = now();
end;
$$;

-- As funções da rede que agora respeitam o bloqueio ---------------------------------------------------

-- Busca: quem bloqueou ou foi bloqueado não aparece.
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
        and not public.social_is_blocked(me, p.user_id)
      order by by_handle desc, p.handle
      limit 20
    ) found
  ), '[]'::json);
end;
$$;

-- Seguir: com bloqueio no meio, é como se a pessoa não existisse.
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
  if p_target is null or p_target = me or public.social_is_blocked(me, p_target) then
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

-- Convite: o código de quem está bloqueado (dos dois lados) responde como código que não existe.
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
  if public.social_is_blocked(me, v_inviter) then
    return json_build_object('ok', false, 'reason', 'code_not_found');
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

revoke all on function public.social_block(uuid) from public, anon;
revoke all on function public.social_unblock(uuid) from public, anon;
revoke all on function public.social_blocked_list() from public, anon;
revoke all on function public.social_remove_follower(uuid) from public, anon;
revoke all on function public.social_report(uuid, text, text) from public, anon;
revoke all on function public.social_search(text, date) from public, anon;
revoke all on function public.social_follow(uuid) from public, anon;
revoke all on function public.social_use_invite(text) from public, anon;
grant execute on function public.social_block(uuid) to authenticated;
grant execute on function public.social_unblock(uuid) to authenticated;
grant execute on function public.social_blocked_list() to authenticated;
grant execute on function public.social_remove_follower(uuid) to authenticated;
grant execute on function public.social_report(uuid, text, text) to authenticated;
grant execute on function public.social_search(text, date) to authenticated;
grant execute on function public.social_follow(uuid) to authenticated;
grant execute on function public.social_use_invite(text) to authenticated;
