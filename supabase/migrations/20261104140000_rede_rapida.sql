-- MindFree · rede mais rápida
-- 1. A órbita e o mural montavam o JSON de cada pessoa (ou post) com uma função por linha, e cada função fazia
--    as próprias subconsultas: com 300 seguidores eram mais de mil consultas por abertura. Agora as listas são
--    montadas de uma vez, com juntas e contagens por grupo. O JSON devolvido é o mesmo de antes.
-- 2. Cada brilho acordava a função "avisar" na hora (uma invocação por evento). Agora o banco só acorda a função
--    se não acordou nos últimos 15 segundos: num pico, os eventos do meio entram no mesmo envio, e o aviso
--    continua chegando em segundos (o Cron de 10 em 10 minutos segue como reserva).
-- Para aplicar: precisam ter rodado antes contas, rede, bloqueio, mural, avisos, moderação e segurança.
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em Run (pode rodar de novo sem problema).
-- Atenção: este arquivo troca social_orbit, mural_feed e push_wake. Se o da moderação, o do mural ou o da
-- segurança rodar de novo, rode este logo depois.

-- As pessoas de uma lista, como `p_me` as vê, de uma vez só (o mesmo formato de social_person) -----------
create or replace function public.social_people_json(p_users uuid[], p_me uuid, p_today date)
returns table (user_id uuid, person json)
language sql
stable
security definer
set search_path = ''
as $$
  with people as (
    select p.user_id, p.handle, p.name, p.private,
           p.user_id = p_me or f_in.status = 'accepted' as visible,
           coalesce(f_in.status, 'none') as i_follow,
           f_out.status = 'accepted' as follows_me
      from public.social_profiles p
      left join public.follows f_in on f_in.follower_id = p_me and f_in.followee_id = p.user_id
      left join public.follows f_out on f_out.follower_id = p.user_id and f_out.followee_id = p_me
     where p.user_id = any (p_users)
  ),
  stars as (
    select n.user_id,
           count(distinct n.day) filter (where n.day >= date_trunc('month', p_today)::date
                                            and n.day < (date_trunc('month', p_today) + interval '1 month')::date) as stars_month,
           bool_or(n.day = p_today) as lit_today
      from public.nights n
     where n.user_id = any (p_users) and n.deleted_at is null
       and n.day >= date_trunc('month', p_today)::date
     group by n.user_id
  )
  select pe.user_id,
         json_build_object(
           'userId', pe.user_id,
           'handle', pe.handle,
           'name', pe.name,
           'private', pe.private,
           'iFollow', pe.i_follow,
           'followsMe', coalesce(pe.follows_me, false),
           'starsMonth', case when pe.visible then coalesce(s.stars_month, 0) end,
           'litToday', case when pe.visible then coalesce(s.lit_today, false) end
         )
    from people pe
    left join stars s on s.user_id = pe.user_id;
$$;
revoke all on function public.social_people_json(uuid[], uuid, date) from public, anon, authenticated;

-- A órbita, montada de uma vez. Quem está suspenso continua de fora.
create or replace function public.social_orbit(p_today date)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_caller();
  v_followers uuid[];
  v_following uuid[];
  v_requests uuid[];
begin
  select coalesce(array_agg(f.follower_id order by f.accepted_at desc), '{}') into v_followers
    from public.follows f where f.followee_id = me and f.status = 'accepted' and not public.social_suspended(f.follower_id);
  select coalesce(array_agg(f.followee_id order by f.created_at desc), '{}') into v_following
    from public.follows f where f.follower_id = me and not public.social_suspended(f.followee_id);
  select coalesce(array_agg(f.follower_id order by f.created_at desc), '{}') into v_requests
    from public.follows f where f.followee_id = me and f.status = 'pending' and not public.social_suspended(f.follower_id);
  return json_build_object(
    'followers', coalesce((select json_agg(j.person order by o.ord) from unnest(v_followers) with ordinality o(id, ord)
                            join public.social_people_json(v_followers, me, p_today) j on j.user_id = o.id), '[]'::json),
    'following', coalesce((select json_agg(j.person order by o.ord) from unnest(v_following) with ordinality o(id, ord)
                            join public.social_people_json(v_following, me, p_today) j on j.user_id = o.id), '[]'::json),
    'requests', coalesce((select json_agg(j.person order by o.ord) from unnest(v_requests) with ordinality o(id, ord)
                           join public.social_people_json(v_requests, me, p_today) j on j.user_id = o.id), '[]'::json)
  );
end;
$$;

-- O mural, montado de uma vez: os brilhos de todos os posts contados por grupo (o mesmo formato de mural_post_json).
create or replace function public.mural_feed()
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
    with visible as (
      select m.id, m.author_id, m.task_title, m.caption, m.photo_path, m.created_at
        from public.mural_posts m
       where m.created_at > now() - interval '7 days' and public.mural_can_see(me, m.author_id)
       order by m.created_at desc
       limit 60
    ),
    shines as (
      -- Quem brilhou cada post, sem quem está vendo e sem quem tem bloqueio com quem está vendo.
      select s.post_id, sp.name, sp.handle, s.created_at
        from public.mural_shines s
        join visible v on v.id = s.post_id
        join public.social_profiles sp on sp.user_id = s.user_id
       where s.user_id <> me and not public.social_is_blocked(me, s.user_id)
    ),
    counts as (
      select post_id, count(*) as shines,
             (array_agg(case when btrim(name) = '' then '@' || handle else name end order by created_at desc))[1:2] as shined_by
        from shines group by post_id
    ),
    mine as (select s.post_id from public.mural_shines s join visible v on v.id = s.post_id where s.user_id = me)
    select json_agg(json_build_object(
      'id', v.id,
      'authorId', v.author_id,
      'handle', p.handle,
      'name', p.name,
      'mine', v.author_id = me,
      'taskTitle', v.task_title,
      'caption', v.caption,
      'photoPath', v.photo_path,
      'createdAt', v.created_at,
      'iShined', mi.post_id is not null,
      'shines', coalesce(c.shines, 0),
      'shinedBy', coalesce(to_json(c.shined_by), '[]'::json)
    ) order by v.created_at desc)
    from visible v
    join public.social_profiles p on p.user_id = v.author_id
    left join counts c on c.post_id = v.id
    left join mine mi on mi.post_id = v.id
  ), '[]'::json);
end;
$$;

-- Acorda a "avisar" na hora, mas no máximo uma vez a cada 15 segundos ------------------------------------
create table if not exists public.push_wake_log (
  only_row boolean primary key default true check (only_row),
  woke_at timestamptz not null default now()
);
alter table public.push_wake_log enable row level security;
revoke all on public.push_wake_log from anon, authenticated;

create or replace function public.push_wake()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last timestamptz;
begin
  -- A linha única é a trava: dois eventos ao mesmo tempo esperam um pelo outro aqui.
  insert into public.push_wake_log (only_row) values (true) on conflict (only_row) do nothing;
  select w.woke_at into v_last from public.push_wake_log w where w.only_row for update;
  if v_last > now() - interval '15 seconds' then
    return;
  end if;
  update public.push_wake_log set woke_at = now() where only_row;
  perform net.http_post(
    url := (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'project_url') || '/functions/v1/avisar',
    headers := public.internal_call_headers(),
    body := '{}'::jsonb
  );
exception when others then
  null;
end;
$$;
revoke all on function public.push_wake() from public, anon, authenticated;
