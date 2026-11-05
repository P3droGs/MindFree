-- Auditoria de 2026-11-05, itens autorizados pelo dono do produto em 2026-11-05:
--   1. teto do app por dia também para as contas com e-mail, com trava contra corrida (B4);
--   2. organização devolvida quando a IA falha (B1);
--   3. nome e bio do perfil sem caracteres de controle nem invisíveis (B5);
--   4. push_wake avisa no log em vez de engolir o erro (M2).
-- Para aplicar: depois de 20261104120000_cota_ia.sql, 20261027120000_rede.sql e 20261104140000_rede_rapida.sql.
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em Run (pode rodar de novo sem problema).

-- 1. Cota da IA: um teto do app por dia para cada tipo de conta -----------------------------------
-- Antes só as contas invisíveis tinham teto (150/dia entre todas); as de e-mail tinham só o limite pessoal (20),
-- então mil contas num dia podiam gastar 20 mil organizações. Agora as contas de e-mail dividem 500 por dia.
-- Quem bate no teto vê "limite do dia" no app e organiza amanhã. Para mudar os tetos, edite as duas constantes
-- abaixo e rode o arquivo de novo.
-- A trava (pg_advisory_xact_lock, uma por tipo de conta) faz dois pedidos ao mesmo tempo entrarem um de cada
-- vez: antes, a soma e o insert eram separados e uma corrida podia passar do teto.
-- (a coluna vem do 20261104120000_cota_ia.sql; repetida aqui só para este arquivo valer sozinho nos testes)
alter table public.ai_usage add column if not exists anonymous boolean not null default false;
create index if not exists ai_usage_day_permanent on public.ai_usage (day) where not anonymous;

create or replace function public.consume_ai_quota()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'utc')::date;
  permanent boolean := public.is_permanent_user();
  personal_limit integer := case when permanent then 20 else 8 end;
  anonymous_limit constant integer := 150;
  permanent_limit constant integer := 500;
  app_limit integer := case when permanent then permanent_limit else anonymous_limit end;
  total integer;
  used integer;
begin
  if me is null then
    return false;
  end if;
  perform pg_advisory_xact_lock(case when permanent then 730101 else 730102 end);
  select coalesce(sum(u.count), 0) into total
    from public.ai_usage u
   where u.day = today and u.anonymous = (not permanent);
  if total >= app_limit then
    return false;
  end if;
  insert into public.ai_usage as u (user_id, day, count, anonymous) values (me, today, 1, not permanent)
    on conflict (user_id, day) do update set count = u.count + 1
    returning u.count into used;
  return used <= personal_limit;
end;
$$;
revoke all on function public.consume_ai_quota() from public, anon;
grant execute on function public.consume_ai_quota() to authenticated;

-- 2. Organização devolvida quando a IA falha (B1) -------------------------------------------------
-- A função organizar gasta a organização do dia antes de chamar a OpenAI e a Anthropic. Se uma delas falhar
-- (erro ou tempo esgotado), ela devolve a organização por aqui, com a chave de serviço, e a pessoa tenta de
-- novo sem perder a cota. Só a service_role chama: quem tem conta não consegue zerar a própria cota.
create or replace function public.refund_ai_quota_for(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ai_usage u
     set count = u.count - 1
   where u.user_id = p_user
     and u.day = (now() at time zone 'utc')::date
     and u.count > 0;
$$;
revoke all on function public.refund_ai_quota_for(uuid) from public, anon, authenticated;
grant execute on function public.refund_ai_quota_for(uuid) to service_role;

-- 3. Nome e bio sem caracteres de controle nem invisíveis (B5) ------------------------------------
-- Caracteres invisíveis (espaço de largura zero, marcas de direção do texto) somem; quebras de linha,
-- tabulações e outros caracteres de controle viram um espaço só. Vale para qualquer caminho que grave o
-- perfil. Evita nome "em várias linhas" na lista de amigos e truques de layout ou de direção do texto.
create or replace function public.social_profiles_clean()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := left(btrim(regexp_replace(
    regexp_replace(coalesce(new.name, ''), '[​-‏‪-‮⁠⁦-⁩﻿]', '', 'g'),
    '[\s\x01-\x1F\x7F]+', ' ', 'g')), 60);
  new.bio := left(btrim(regexp_replace(
    regexp_replace(coalesce(new.bio, ''), '[​-‏‪-‮⁠⁦-⁩﻿]', '', 'g'),
    '[\s\x01-\x1F\x7F]+', ' ', 'g')), 80);
  return new;
end;
$$;
do $trigger$
begin
  if to_regclass('public.social_profiles') is not null then
    drop trigger if exists social_profiles_clean on public.social_profiles;
    create trigger social_profiles_clean
      before insert or update of name, bio on public.social_profiles
      for each row execute function public.social_profiles_clean();
  end if;
end;
$trigger$;

-- 4. push_wake avisa no log em vez de engolir o erro (M2) ----------------------------------------
-- Um erro do pg_net ou do Vault ficava invisível (o 401 dos avisos em 2026-11-05 levou horas para aparecer).
-- Agora vai para o log do Postgres como WARNING, sem travar o brilho ou o cutucão que acionou o aviso.
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
  raise warning 'push_wake: % (%)', sqlerrm, sqlstate;
end;
$$;
revoke all on function public.push_wake() from public, anon, authenticated;
