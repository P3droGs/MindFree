-- MindFree · rede: a limpeza diária do Mural
-- Agenda a função "limpar-mural" para rodar todo dia às 04:00 (UTC), pelo Cron do próprio Supabase.
-- Ela apaga do Storage as fotos dos posts com mais de 7 dias e depois os posts.
-- A função não pede login (só apaga o que já venceu), então aqui não vai nenhuma chave.
-- O endereço do projeto não fica neste arquivo: ele mora no Vault do Supabase, com o nome "project_url".
-- Para aplicar, no SQL Editor:
--   1. uma vez só, guarde o endereço (o mesmo do EXPO_PUBLIC_SUPABASE_URL, no .env.local):
--        select vault.create_secret('https://SEU_REF.supabase.co', 'project_url');
--   2. cole este arquivo inteiro e clique em Run (pode rodar de novo sem problema).
-- Não entra no npm run test:sql: o Postgres local não tem pg_cron nem pg_net.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'project_url') then
    raise exception 'Guarde antes o endereço do projeto no Vault (passo 1 do topo deste arquivo).';
  end if;
end;
$$;

-- Rodar de novo troca o agendamento, em vez de criar outro.
select cron.unschedule(j.jobid) from cron.job j where j.jobname = 'limpar-mural';

select cron.schedule(
  'limpar-mural',
  '0 4 * * *',
  $$
  select net.http_post(
    url := (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'project_url')
           || '/functions/v1/limpar-mural',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
