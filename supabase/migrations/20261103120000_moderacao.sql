-- MindFree · rede: moderação (pelo painel do Supabase)
-- O dono do app olha a fila de denúncias e age rodando comandos no SQL Editor:
--   select * from public.moderation_queue;                         -- denúncias abertas, da mais antiga
--   select public.mod_delete_post('<id do post>', 'offensive');    -- apaga o post e avisa quem postou
--   select public.mod_suspend('<@ sem a arroba>', 'harassment');   -- suspende a conta na rede
--   select public.mod_unsuspend('<@ sem a arroba>');               -- reativa
--   select public.mod_dismiss(<número da denúncia>);               -- descarta (está tudo bem)
-- Motivos: spam, offensive, harassment ou other (o app traduz para quem recebe o aviso).
-- Suspensa, a pessoa some da rede para todo mundo (como um bloqueio geral) e não consegue usar a rede.
-- Postar no mural passa a ser só pela função "postar", que checa a foto e o texto com o filtro de moderação
-- da OpenAI antes de publicar (o app não chama mais o mural_create direto).
-- Para aplicar: os arquivos das contas, da rede, do bloqueio, do mural e dos avisos precisam ter rodado antes.
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em Run (pode rodar de novo sem problema).
-- Atenção: este arquivo troca funções da rede e do bloqueio (social_caller, social_is_blocked, social_profile,
-- social_orbit, social_friends_week e social_activity). Se um daqueles arquivos rodar de novo, rode este depois.

-- Colunas e tabelas -------------------------------------------------------------------------------

alter table public.social_profiles add column if not exists suspended_at timestamptz;
alter table public.social_profiles add column if not exists suspended_reason text;
alter table public.social_reports add column if not exists status text not null default 'open';
alter table public.social_reports add column if not exists resolved_at timestamptz;
alter table public.social_reports drop constraint if exists social_reports_status_check;
alter table public.social_reports add constraint social_reports_status_check
  check (status in ('open', 'post_removed', 'suspended', 'dismissed'));

-- Os avisos que o app mostra a quem teve um post apagado ou a conta suspensa (sem dizer quem denunciou).
create table if not exists public.moderation_notices (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('post_removed', 'suspended', 'unsuspended')),
  reason text not null default '',
  detail text not null default '',
  created_at timestamptz not null default now(),
  seen_at timestamptz
);
create index if not exists moderation_notices_user on public.moderation_notices (user_id) where seen_at is null;
alter table public.moderation_notices enable row level security;
revoke all on public.moderation_notices from anon, authenticated;

-- Denunciar de novo (a mesma pessoa, depois de resolvida) reabre a denúncia.
create or replace function public.social_report_reopen()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.created_at is distinct from old.created_at then
    new.status := 'open';
    new.resolved_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists social_report_reopen on public.social_reports;
create trigger social_report_reopen before update on public.social_reports
  for each row execute function public.social_report_reopen();

-- Suspensão: valendo em toda a rede ----------------------------------------------------------------

create or replace function public.social_suspended(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.suspended_at is not null from public.social_profiles p where p.user_id = p_user), false);
$$;
revoke all on function public.social_suspended(uuid) from public, anon, authenticated;

-- Quem está suspenso não usa a rede.
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
  if public.social_suspended(me) then
    raise exception 'mindfree:suspended';
  end if;
  return me;
end;
$$;
revoke all on function public.social_caller() from public, anon, authenticated;

-- E some para todo mundo: a busca, o seguir, o convite, o mural e os brilhos já respeitam o bloqueio.
create or replace function public.social_is_blocked(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.social_blocks b
     where (b.blocker_id = p_a and b.blocked_id = p_b) or (b.blocker_id = p_b and b.blocked_id = p_a))
    or public.social_suspended(p_a) or public.social_suspended(p_b);
$$;
revoke all on function public.social_is_blocked(uuid, uuid) from public, anon, authenticated;

-- O perfil diz ao app se a conta está suspensa (para mostrar o aviso em vez da rede).
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
      'suspended', p.suspended_at is not null,
      'code', (select c.code from public.invite_codes c where c.user_id = me),
      'invites', (select count(*) from public.invite_uses u where u.inviter_id = me),
      'invited', exists (select 1 from public.invite_uses u where u.invitee_id = me),
      'followers', (select count(*) from public.follows f where f.followee_id = me and f.status = 'accepted'
                      and not public.social_suspended(f.follower_id)),
      'following', (select count(*) from public.follows f where f.follower_id = me and f.status = 'accepted'
                      and not public.social_suspended(f.followee_id)),
      'requests', (select count(*) from public.follows f where f.followee_id = me and f.status = 'pending'
                      and not public.social_suspended(f.follower_id))
    )
    from public.social_profiles p
    where p.user_id = me
  );
end;
$$;

-- A órbita, o céu da semana e as novidades deixam de mostrar quem está suspenso.
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
      from public.follows f where f.followee_id = me and f.status = 'accepted'
        and not public.social_suspended(f.follower_id)), '[]'::json),
    'following', coalesce((
      select json_agg(public.social_person(f.followee_id, me, p_today) order by f.created_at desc)
      from public.follows f where f.follower_id = me and not public.social_suspended(f.followee_id)), '[]'::json),
    'requests', coalesce((
      select json_agg(public.social_person(f.follower_id, me, p_today) order by f.created_at desc)
      from public.follows f where f.followee_id = me and f.status = 'pending'
        and not public.social_suspended(f.follower_id)), '[]'::json)
  );
end;
$$;

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
    where f.follower_id = me and f.status = 'accepted' and p.suspended_at is null
  ), '[]'::json);
end;
$$;

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
        where i.to_id = me and i.created_at > now() - interval '30 days' and p.suspended_at is null)
      union all
      (select json_build_object('kind', 'follow', 'userId', p.user_id, 'handle', p.handle, 'name', p.name,
                                'at', f.accepted_at) as e,
              f.accepted_at as at
         from public.follows f
         join public.social_profiles p on p.user_id = f.follower_id
        where f.followee_id = me and f.status = 'accepted' and f.accepted_at > now() - interval '30 days'
          and p.suspended_at is null)
      order by at desc
      limit 40
    ) x
  );
end;
$$;

-- Postar só pela função "postar" (que passa pelo filtro de moderação) ------------------------------

-- O mesmo mural_create, mas para a função do servidor dizer em nome de quem posta.
create or replace function public.mural_create_for(p_user uuid, p_photo text, p_task text, p_caption text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task text := left(btrim(coalesce(p_task, '')), 200);
  v_id uuid;
begin
  if p_user is null or not exists (select 1 from public.social_profiles p where p.user_id = p_user) then
    raise exception 'mindfree:no_profile';
  end if;
  if public.social_suspended(p_user) then
    raise exception 'mindfree:suspended';
  end if;
  if p_photo is null or p_photo not like p_user::text || '/%'
     or not exists (select 1 from storage.objects o where o.bucket_id = 'mural' and o.name = p_photo) then
    raise exception 'mindfree:photo_missing';
  end if;
  if v_task = '' then
    raise exception 'mindfree:task_missing';
  end if;
  if (select count(*) from public.mural_posts m
       where m.author_id = p_user and m.created_at > now() - interval '1 day') >= 10 then
    raise exception 'mindfree:too_many';
  end if;
  insert into public.mural_posts (author_id, photo_path, task_title, caption)
  values (p_user, p_photo, v_task, left(btrim(coalesce(p_caption, '')), 140))
  returning id into v_id;
  return public.mural_post_json(v_id, p_user);
end;
$$;
revoke all on function public.mural_create_for(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.mural_create_for(uuid, text, text, text) to service_role;
revoke execute on function public.mural_create(text, text, text) from authenticated;

-- Os avisos para quem foi moderado (o app chama; vale até com a conta suspensa) --------------------

create or replace function public.mod_my_notices()
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
  return coalesce((
    select json_agg(json_build_object('id', n.id, 'kind', n.kind, 'reason', n.reason, 'detail', n.detail,
                                      'at', n.created_at) order by n.id)
      from public.moderation_notices n where n.user_id = me and n.seen_at is null
  ), '[]'::json);
end;
$$;

create or replace function public.mod_notice_seen(p_id bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.moderation_notices n set seen_at = now() where n.id = p_id and n.user_id = auth.uid();
$$;
revoke all on function public.mod_my_notices() from public, anon;
revoke all on function public.mod_notice_seen(bigint) from public, anon;
grant execute on function public.mod_my_notices() to authenticated;
grant execute on function public.mod_notice_seen(bigint) to authenticated;

-- O painel do dono do app (só no SQL Editor: ninguém do app chama) ---------------------------------

create or replace view public.moderation_queue with (security_invoker = true) as
select r.id as denuncia,
       r.created_at as quando,
       r.reason as motivo,
       r.details as detalhes,
       quem.handle as quem_denunciou,
       r.reported_handle as denunciado,
       r.post_id,
       r.post_text as post,
       m.id is not null as post_no_ar,
       m.photo_path as foto,
       (select count(*) from public.social_reports x where x.reported_id = r.reported_id and x.status = 'open')
         as denuncias_abertas_contra,
       alvo.suspended_at is not null as suspenso
  from public.social_reports r
  left join public.social_profiles quem on quem.user_id = r.reporter_id
  left join public.social_profiles alvo on alvo.user_id = r.reported_id
  left join public.mural_posts m on m.id = r.post_id
 where r.status = 'open'
 order by r.created_at;
revoke all on public.moderation_queue from anon, authenticated;

create or replace function public.mod_reason(p_reason text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_reason in ('spam', 'offensive', 'harassment', 'other') then p_reason else 'other' end;
$$;

create or replace function public.mod_delete_post(p_post uuid, p_reason text default 'offensive')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author uuid;
  v_text text;
begin
  delete from public.mural_posts m where m.id = p_post
  returning m.author_id, m.task_title into v_author, v_text;
  if v_author is null then
    return 'Nenhum post com esse id (talvez já tenha saído do mural).';
  end if;
  insert into public.moderation_notices (user_id, kind, reason, detail)
  values (v_author, 'post_removed', public.mod_reason(p_reason), v_text);
  update public.social_reports r set status = 'post_removed', resolved_at = now()
   where r.post_id = p_post and r.status = 'open';
  return 'Post apagado e quem postou vai ver o aviso. A foto sai do servidor na próxima limpeza (em até 1 dia).';
end;
$$;

create or replace function public.mod_suspend(p_handle text, p_reason text default 'offensive')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  update public.social_profiles p set suspended_at = coalesce(p.suspended_at, now()), suspended_reason = public.mod_reason(p_reason)
   where p.handle = lower(btrim(replace(p_handle, '@', '')))
  returning p.user_id into v_user;
  if v_user is null then
    return 'Nenhuma conta com esse @.';
  end if;
  insert into public.moderation_notices (user_id, kind, reason) values (v_user, 'suspended', public.mod_reason(p_reason));
  update public.social_reports r set status = 'suspended', resolved_at = now()
   where r.reported_id = v_user and r.status = 'open';
  return 'Conta suspensa: ela sumiu da rede para todo mundo.';
end;
$$;

create or replace function public.mod_unsuspend(p_handle text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  update public.social_profiles p set suspended_at = null, suspended_reason = null
   where p.handle = lower(btrim(replace(p_handle, '@', ''))) and p.suspended_at is not null
  returning p.user_id into v_user;
  if v_user is null then
    return 'Nenhuma conta suspensa com esse @.';
  end if;
  insert into public.moderation_notices (user_id, kind) values (v_user, 'unsuspended');
  return 'Conta reativada.';
end;
$$;

create or replace function public.mod_dismiss(p_report bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.social_reports r set status = 'dismissed', resolved_at = now() where r.id = p_report and r.status = 'open';
  return case when found then 'Denúncia descartada.' else 'Nenhuma denúncia aberta com esse número.' end;
end;
$$;

revoke all on function public.mod_reason(text) from public, anon, authenticated, service_role;
revoke all on function public.mod_delete_post(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.mod_suspend(text, text) from public, anon, authenticated, service_role;
revoke all on function public.mod_unsuspend(text) from public, anon, authenticated, service_role;
revoke all on function public.mod_dismiss(bigint) from public, anon, authenticated, service_role;
