-- MindFree · segurança: funções do servidor fechadas, token do push conferido e busca com índice
-- 1. As funções "avisar" e "limpar-mural" passam a exigir a chave de serviço. Só o banco as chama (pelo Cron e
--    pelo push_wake), e ele lê a chave do Vault, como já faz com o endereço do projeto. Antes, qualquer um na
--    internet podia chamá-las à vontade (não vazava nada, mas gastava invocações e chamadas à Expo).
-- 2. push_register só aceita o formato do Expo ("ExponentPushToken[...]"): um token inventado fazia a
--    "avisar" gastar chamadas à Expo à toa.
-- 3. A busca de pessoas (por @ e por nome) ganha índices trigram: sem eles, cada letra digitada varria a
--    tabela inteira de perfis.
-- Para aplicar, ANTES de rodar este arquivo, guarde a chave de serviço no Vault (uma vez só; a chave está em
-- Project Settings › API › service_role, e nunca vai para o app nem para o Git):
--        select vault.create_secret('<a chave service_role>', 'service_role_key');
-- Depois cole este arquivo inteiro no SQL Editor e clique em Run (pode rodar de novo sem problema).
-- Precisa ter rodado antes: contas, rede, bloqueio, mural, o agendamento do mural e os avisos.

-- O segredo precisa existir, senão o Cron e o push_wake chamariam as funções sem a chave e elas recusariam.
do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'service_role_key') then
    raise exception 'Guarde antes a chave de serviço no Vault (veja o topo deste arquivo).';
  end if;
end;
$$;

-- Os cabeçalhos que as chamadas do banco mandam: o tipo do corpo e a chave de serviço.
create or replace function public.internal_call_headers()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'service_role_key'));
$$;
revoke all on function public.internal_call_headers() from public, anon, authenticated;

-- Acorda a função "avisar" na hora, agora com a chave.
create or replace function public.push_wake()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
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

-- Os dois Crons, de novo, com a chave. (No Postgres local dos testes não há Cron, e esta parte é pulada.)
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $sql$select cron.unschedule(j.jobid) from cron.job j where j.jobname in ('avisar', 'limpar-mural')$sql$;
    execute $sql$
      select cron.schedule('avisar', '*/10 * * * *', $job$
        select net.http_post(
          url := (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'project_url') || '/functions/v1/avisar',
          headers := public.internal_call_headers(),
          body := '{}'::jsonb);
      $job$)
    $sql$;
    execute $sql$
      select cron.schedule('limpar-mural', '0 4 * * *', $job$
        select net.http_post(
          url := (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'project_url') || '/functions/v1/limpar-mural',
          headers := public.internal_call_headers(),
          body := '{}'::jsonb);
      $job$)
    $sql$;
  end if;
end;
$cron$;

-- Cadastra este celular na conta, só com um token no formato do Expo. Até 10 por pessoa.
create or replace function public.push_register(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.social_caller();
begin
  if p_token is null or p_token !~ '^ExponentPushToken\[[A-Za-z0-9_-]{4,180}\]$' or p_platform not in ('ios', 'android') then
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
revoke all on function public.push_register(text, text) from public, anon;
grant execute on function public.push_register(text, text) to authenticated;

-- A busca: índices trigram no @ e no nome (a busca usa "like" com o mesmo lower(name) de sempre).
-- (No Postgres local dos testes o pg_trgm não existe, e esta parte é pulada; no Supabase ele sempre está.)
do $trgm$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_trgm') then
    create extension if not exists pg_trgm with schema extensions;
    create index if not exists social_profiles_handle_trgm on public.social_profiles using gin (handle extensions.gin_trgm_ops);
    create index if not exists social_profiles_name_trgm on public.social_profiles using gin (lower(name) extensions.gin_trgm_ops);
  end if;
end;
$trgm$;
