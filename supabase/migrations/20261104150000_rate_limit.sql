-- MindFree · limite de chamadas por pessoa (rate limit)
-- O teste de carga mostrou que uma conta conseguia fazer 200 buscas em segundos sem nenhum freio. Agora cada
-- pessoa tem um limite por minuto em cada grupo de ações da rede: geral (abrir telas), busca e escritas (seguir,
-- brilhar, bloquear, denunciar, postar). Passou, a função responde "mindfree:too_many" e o app pede para
-- esperar um pouco. A contagem é por janela de 1 minuto, numa tabela que só o banco lê.
-- Para aplicar: precisam ter rodado antes contas, rede, bloqueio, mural, avisos, moderação, segurança e rede
-- rápida. Cole este arquivo inteiro no SQL Editor do Supabase e clique em Run (pode rodar de novo sem problema).
-- Atenção: este arquivo troca social_caller (ganha parâmetros), social_search, social_follow, social_interact,
-- social_block, social_report, mural_shine, mural_report e social_use_invite. Se o da moderação ou o do
-- bloqueio rodar de novo, rode este logo depois.

create table if not exists public.rate_hits (
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  minute timestamptz not null,
  count integer not null default 0,
  primary key (user_id, action, minute)
);
alter table public.rate_hits enable row level security;
revoke all on public.rate_hits from anon, authenticated;

-- Conta uma chamada de `p_user` na ação `p_action` neste minuto. Passou de `p_limit`, para com too_many.
-- Linhas de minutos antigos são apagadas de vez em quando (1 em cada 50 chamadas), para a tabela não crescer.
create or replace function public.rate_check(p_user uuid, p_action text, p_limit integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_minute timestamptz := date_trunc('minute', now());
  v_count integer;
begin
  insert into public.rate_hits as r (user_id, action, minute, count) values (p_user, p_action, v_minute, 1)
    on conflict (user_id, action, minute) do update set count = r.count + 1
    returning r.count into v_count;
  if v_count > p_limit then
    raise exception 'mindfree:too_many';
  end if;
  if random() < 0.02 then
    delete from public.rate_hits r where r.minute < now() - interval '10 minutes';
  end if;
end;
$$;
revoke all on function public.rate_check(uuid, text, integer) from public, anon, authenticated;

-- Quem está chamando, já contando a chamada no limite. Sem argumentos: o limite geral (120 por minuto, que é
-- abrir todas as telas várias vezes). As funções de busca e de escrita passam o próprio grupo e limite.
drop function if exists public.social_caller();
create or replace function public.social_caller(p_action text default 'geral', p_limit integer default 120)
returns uuid
language plpgsql
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
  if public.social_suspended(me) then
    raise exception 'mindfree:suspended';
  end if;
  perform public.rate_check(me, p_action, p_limit);
  return me;
end;
$$;
revoke all on function public.social_caller(text, integer) from public, anon, authenticated;

-- A busca: 30 por minuto (o app espera a pessoa parar de digitar antes de buscar).
create or replace function public.social_search(p_query text, p_today date)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_caller('busca', 30);
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

-- Escritas: 30 por minuto no grupo "escrita" (seguir, brilho/cutucão, bloquear, denunciar, brilho no mural, convite).
create or replace function public.social_follow(p_target uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_caller('escrita', 30);
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

create or replace function public.social_interact(p_target uuid, p_kind text, p_day date, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_caller('escrita', 30);
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

create or replace function public.social_block(p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_caller('escrita', 30);
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

create or replace function public.social_report(p_target uuid, p_reason text, p_details text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_caller('escrita', 30);
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

create or replace function public.mural_shine(p_post uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_caller('escrita', 30);
  v_author uuid := public.mural_visible_author(p_post, me);
begin
  if v_author is null or v_author = me then
    raise exception 'mindfree:not_found';
  end if;
  if p_on then
    insert into public.mural_shines (post_id, user_id) values (p_post, me) on conflict do nothing;
  else
    delete from public.mural_shines s where s.post_id = p_post and s.user_id = me;
  end if;
end;
$$;

create or replace function public.mural_report(p_post uuid, p_reason text, p_details text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_caller('escrita', 30);
  v_author uuid := public.mural_visible_author(p_post, me);
  v_text text;
begin
  if p_reason is null or p_reason not in ('spam', 'offensive', 'harassment', 'other') then
    raise exception 'mindfree:bad_reason';
  end if;
  if v_author is null or v_author = me then
    raise exception 'mindfree:not_found';
  end if;
  select m.task_title || case when m.caption = '' then '' else ' · ' || m.caption end into v_text
    from public.mural_posts m where m.id = p_post;
  insert into public.social_reports as r (reporter_id, reported_id, reported_handle, reason, details, post_id, post_text)
  select me, v_author, p.handle, p_reason, left(btrim(coalesce(p_details, '')), 500), p_post, v_text
    from public.social_profiles p where p.user_id = v_author
  on conflict (reporter_id, reported_id) do update
    set reason = excluded.reason, details = excluded.details, reported_handle = excluded.reported_handle,
        post_id = excluded.post_id, post_text = excluded.post_text, created_at = now();
end;
$$;

-- O convite já tem o limite diário de 10 erros; ganha também o de escrita por minuto.
create or replace function public.social_use_invite(p_code text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_caller('escrita', 30);
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

-- As leituras eram "stable" e agora chamam uma função que grava a contagem: passam a "volatile"
-- (só muda a dica ao planejador; o corpo e o resultado são os mesmos).
alter function public.social_orbit(date) volatile;
alter function public.social_friends_week(date, date) volatile;
alter function public.social_activity() volatile;
alter function public.social_blocked_list() volatile;
alter function public.mural_feed() volatile;
