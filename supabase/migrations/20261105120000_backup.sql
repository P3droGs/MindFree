-- Cópia de segurança diária do banco (auditoria de 2026-11-05, item A1).
-- O plano gratuito do Supabase não faz backup. Todo dia às 03:30 UTC o Cron chama a função "backup",
-- que pede aqui um retrato de todas as tabelas do app (JSON) e guarda no bucket privado "backups",
-- por 14 dias. Protege contra apagar ou migrar errado; a restauração é manual (ver COMO-RODAR.md).
-- O que não entra: o esquema auth (contas e senhas, que o Supabase guarda) e as tabelas efêmeras
-- rate_hits e push_wake_log. As fotos do mural somem sozinhas em 7 dias e também ficam de fora.

-- Bucket privado: ninguém além da chave de serviço lê ou escreve (sem políticas para authenticated).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('backups', 'backups', false, 52428800, array['application/json'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- O retrato: um JSON com todas as tabelas de verdade do esquema public, menos as efêmeras.
-- Só a chave de serviço chama (a função "backup" usa a chave como credencial).
-- O SQL dinâmico usa %I: o nome da tabela vem do catálogo e entra sempre entre aspas.
create or replace function public.backup_snapshot()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_rows json;
  v_tables jsonb := '{}'::jsonb;
begin
  for r in
    select t.table_name
      from information_schema.tables t
     where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
       and t.table_name not in ('rate_hits', 'push_wake_log')
     order by t.table_name
  loop
    execute format('select coalesce(json_agg(x), ''[]''::json) from public.%I x', r.table_name) into v_rows;
    v_tables := v_tables || jsonb_build_object(r.table_name, v_rows::jsonb);
  end loop;
  return json_build_object('app', 'MindFree', 'takenAt', now(), 'tables', v_tables);
end;
$$;
revoke all on function public.backup_snapshot() from public, anon, authenticated;
grant execute on function public.backup_snapshot() to service_role;

-- O agendamento: só onde o pg_cron existe (no Supabase; o Postgres local dos testes não tem).
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $sql$select cron.unschedule(j.jobid) from cron.job j where j.jobname = 'backup'$sql$;
    execute $sql$
      select cron.schedule('backup', '30 3 * * *', $job$
        select net.http_post(
          url := (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'project_url') || '/functions/v1/backup',
          headers := public.internal_call_headers(),
          body := '{}'::jsonb);
      $job$)
    $sql$;
  end if;
end;
$cron$;
