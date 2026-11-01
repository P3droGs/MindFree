-- MindFree · rede: o Mural na nuvem
-- Cada post é uma tarefa concluída, uma foto e uma legenda opcional. Quem vê: quem segue você (aprovado).
-- O post e a foto valem por 7 dias. Depois disso ninguém mais vê, e a função "limpar-mural" apaga a foto
-- do servidor (a cópia da pessoa continua no celular dela, no Perfil). Os brilhos mostram número e nomes.
-- As fotos ficam no Storage, num bucket privado ("mural"), em <id da pessoa>/<arquivo>.jpg.
-- Para aplicar: os arquivos das contas, da rede e do bloqueio precisam ter rodado antes. Cole este arquivo
-- inteiro no SQL Editor do Supabase e clique em Run (pode rodar de novo sem problema).

-- Onde as fotos ficam -------------------------------------------------------------------------------

-- Privado: as fotos só abrem com um link assinado, e o Storage só assina para quem pode ver (políticas abaixo).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mural', 'mural', false, 3145728, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Tabelas ------------------------------------------------------------------------------------------

create table if not exists public.mural_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.social_profiles (user_id) on delete cascade,
  photo_path text not null unique,
  task_title text not null check (char_length(task_title) between 1 and 200),
  caption text not null default '' check (char_length(caption) <= 140),
  created_at timestamptz not null default now()
);
create index if not exists mural_posts_author on public.mural_posts (author_id, created_at desc);
create index if not exists mural_posts_created on public.mural_posts (created_at);

create table if not exists public.mural_shines (
  post_id uuid not null references public.mural_posts (id) on delete cascade,
  user_id uuid not null references public.social_profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists mural_shines_user on public.mural_shines (user_id);

alter table public.mural_posts enable row level security;
alter table public.mural_shines enable row level security;
revoke all on public.mural_posts, public.mural_shines from anon, authenticated;

-- A denúncia de um post guarda qual foi e o texto dele (a foto some em 7 dias, como as outras).
alter table public.social_reports add column if not exists post_id uuid;
alter table public.social_reports add column if not exists post_text text;

-- Funções internas ---------------------------------------------------------------------------------

-- Quem vê os posts de alguém: a própria pessoa e quem a segue (aprovado), sem bloqueio entre os dois.
create or replace function public.mural_can_see(p_viewer uuid, p_author uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_viewer is not null and (
    p_viewer = p_author
    or (exists (select 1 from public.follows f
                 where f.follower_id = p_viewer and f.followee_id = p_author and f.status = 'accepted')
        and not public.social_is_blocked(p_viewer, p_author)));
$$;
revoke all on function public.mural_can_see(uuid, uuid) from public, anon, authenticated;

-- O post como o app recebe. Brilhos: quantos e os nomes de quem brilhou, sem contar quem está vendo
-- (o app mostra "Você" na frente) e sem quem tem bloqueio com quem está vendo.
create or replace function public.mural_post_json(p_post uuid, p_me uuid)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'id', m.id,
    'authorId', m.author_id,
    'handle', p.handle,
    'name', p.name,
    'mine', m.author_id = p_me,
    'taskTitle', m.task_title,
    'caption', m.caption,
    'photoPath', m.photo_path,
    'createdAt', m.created_at,
    'iShined', exists (select 1 from public.mural_shines s where s.post_id = m.id and s.user_id = p_me),
    'shines', (select count(*) from public.mural_shines s
                where s.post_id = m.id and s.user_id <> p_me and not public.social_is_blocked(p_me, s.user_id)),
    'shinedBy', coalesce((
      select json_agg(case when btrim(q.name) = '' then '@' || q.handle else q.name end order by q.created_at desc)
        from (select sp.name, sp.handle, s.created_at
                from public.mural_shines s
                join public.social_profiles sp on sp.user_id = s.user_id
               where s.post_id = m.id and s.user_id <> p_me and not public.social_is_blocked(p_me, s.user_id)
               order by s.created_at desc
               limit 2) q
    ), '[]'::json)
  )
  from public.mural_posts m
  join public.social_profiles p on p.user_id = m.author_id
  where m.id = p_post;
$$;
revoke all on function public.mural_post_json(uuid, uuid) from public, anon, authenticated;

-- Um post que quem está vendo pode ver agora (dentro dos 7 dias). Nulo se não pode.
create or replace function public.mural_visible_author(p_post uuid, p_me uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.author_id from public.mural_posts m
   where m.id = p_post and m.created_at > now() - interval '7 days' and public.mural_can_see(p_me, m.author_id);
$$;
revoke all on function public.mural_visible_author(uuid, uuid) from public, anon, authenticated;

-- Regras do Storage (as políticas chamam estas duas como a pessoa que está usando o app) ------------

-- Enviar foto: só conta de verdade que já entrou na rede, só na própria pasta, até 20 fotos por dia.
create or replace function public.mural_can_upload()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and public.is_permanent_user()
     and exists (select 1 from public.social_profiles p where p.user_id = auth.uid())
     and (select count(*) from storage.objects o
           where o.bucket_id = 'mural' and o.name like auth.uid()::text || '/%'
             and o.created_at > now() - interval '1 day') < 20;
$$;

-- Abrir foto de outra pessoa: só a de um post que você pode ver agora.
create or replace function public.mural_photo_visible(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.mural_posts m
                  where m.photo_path = p_name and m.created_at > now() - interval '7 days'
                    and public.mural_can_see(auth.uid(), m.author_id));
$$;
revoke all on function public.mural_can_upload() from public, anon;
revoke all on function public.mural_photo_visible(text) from public, anon;
grant execute on function public.mural_can_upload() to authenticated;
grant execute on function public.mural_photo_visible(text) to authenticated;

drop policy if exists "mural: enviar a propria foto" on storage.objects;
drop policy if exists "mural: ver a propria foto ou a de quem voce segue" on storage.objects;
drop policy if exists "mural: apagar a propria foto" on storage.objects;
create policy "mural: enviar a propria foto" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'mural' and (storage.foldername(name))[1] = (select auth.uid())::text
              and public.mural_can_upload());
create policy "mural: ver a propria foto ou a de quem voce segue" on storage.objects
  for select to authenticated
  using (bucket_id = 'mural' and ((storage.foldername(name))[1] = (select auth.uid())::text
                                  or public.mural_photo_visible(name)));
create policy "mural: apagar a propria foto" on storage.objects
  for delete to authenticated
  using (bucket_id = 'mural' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Funções que o app chama ---------------------------------------------------------------------------

-- Postar: a foto já subiu para a sua pasta; aqui o post passa a existir. Até 10 posts por dia.
create or replace function public.mural_create(p_photo text, p_task text, p_caption text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_caller();
  v_task text := left(btrim(coalesce(p_task, '')), 200);
  v_id uuid;
begin
  if p_photo is null or p_photo not like me::text || '/%'
     or not exists (select 1 from storage.objects o where o.bucket_id = 'mural' and o.name = p_photo) then
    raise exception 'mindfree:photo_missing';
  end if;
  if v_task = '' then
    raise exception 'mindfree:task_missing';
  end if;
  if (select count(*) from public.mural_posts m
       where m.author_id = me and m.created_at > now() - interval '1 day') >= 10 then
    raise exception 'mindfree:too_many';
  end if;
  insert into public.mural_posts (author_id, photo_path, task_title, caption)
  values (me, p_photo, v_task, left(btrim(coalesce(p_caption, '')), 140))
  returning id into v_id;
  return public.mural_post_json(v_id, me);
end;
$$;

-- O mural: os seus posts e os de quem você segue, dos últimos 7 dias, do mais novo para o mais antigo.
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
    select json_agg(public.mural_post_json(found.id, me) order by found.created_at desc)
      from (select m.id, m.created_at
              from public.mural_posts m
             where m.created_at > now() - interval '7 days' and public.mural_can_see(me, m.author_id)
             order by m.created_at desc
             limit 60) found
  ), '[]'::json);
end;
$$;

-- Brilho num post de quem você segue (no seu próprio, não).
create or replace function public.mural_shine(p_post uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_caller();
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

-- Apagar o seu post. Devolve o caminho da foto, que o app apaga do Storage em seguida.
create or replace function public.mural_delete(p_post uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_caller();
  v_photo text;
begin
  delete from public.mural_posts m where m.id = p_post and m.author_id = me returning m.photo_path into v_photo;
  return v_photo;
end;
$$;

-- Denunciar um post: entra na mesma tabela das denúncias, com o post e o texto dele.
create or replace function public.mural_report(p_post uuid, p_reason text, p_details text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_caller();
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

revoke all on function public.mural_create(text, text, text) from public, anon;
revoke all on function public.mural_feed() from public, anon;
revoke all on function public.mural_shine(uuid, boolean) from public, anon;
revoke all on function public.mural_delete(uuid) from public, anon;
revoke all on function public.mural_report(uuid, text, text) from public, anon;
grant execute on function public.mural_create(text, text, text) to authenticated;
grant execute on function public.mural_feed() to authenticated;
grant execute on function public.mural_shine(uuid, boolean) to authenticated;
grant execute on function public.mural_delete(uuid) to authenticated;
grant execute on function public.mural_report(uuid, text, text) to authenticated;

-- Limpeza (só a função "limpar-mural", com a chave de serviço) ---------------------------------------

-- As fotos para apagar: as dos posts com mais de 7 dias e as que ficaram sem post há mais de 1 dia
-- (o envio subiu a foto mas o post não foi criado, ou a conta foi apagada).
create or replace function public.mural_cleanup_list(p_limit integer)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(found.name), '{}')
    from (select m.photo_path as name from public.mural_posts m where m.created_at <= now() - interval '7 days'
          union
          select o.name from storage.objects o
           where o.bucket_id = 'mural' and o.created_at <= now() - interval '1 day'
             and not exists (select 1 from public.mural_posts m where m.photo_path = o.name)
          limit greatest(1, least(coalesce(p_limit, 100), 500))) found;
$$;

-- Depois que as fotos saíram do Storage: apaga os posts vencidos delas (os brilhos vão junto).
create or replace function public.mural_cleanup_forget(p_paths text[])
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.mural_posts m
     where m.photo_path = any (p_paths) and m.created_at <= now() - interval '7 days'
    returning 1)
  select count(*)::integer from gone;
$$;
revoke all on function public.mural_cleanup_list(integer) from public, anon, authenticated;
revoke all on function public.mural_cleanup_forget(text[]) from public, anon, authenticated;
grant execute on function public.mural_cleanup_list(integer) to service_role;
grant execute on function public.mural_cleanup_forget(text[]) to service_role;
