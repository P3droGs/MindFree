-- Cota da IA menor (decisão do dono do produto em 2026-11-08): o saldo nas duas IAs é pequeno (US$ 5 em cada),
-- então os limites precisam caber nele mesmo num dia ruim. Antes: 20 / 8 por pessoa e tetos 500 / 150 por dia
-- (pior caso ~US$ 4 por dia). Agora: 10 por conta com e-mail, 3 por conta invisível, e tetos do app de 60 e 20
-- por dia (pior caso 80 pedidos, ~US$ 0,55). Para mudar, edite as quatro constantes e rode o arquivo de novo.
-- Para aplicar: depois de 20261105130000_auditoria.sql. Cole inteiro no SQL Editor e clique em Run.

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
  personal_permanent constant integer := 10;
  personal_anonymous constant integer := 3;
  app_permanent constant integer := 60;
  app_anonymous constant integer := 20;
  personal_limit integer := case when permanent then personal_permanent else personal_anonymous end;
  app_limit integer := case when permanent then app_permanent else app_anonymous end;
  total integer;
  used integer;
begin
  if me is null then
    return false;
  end if;
  -- Uma trava por tipo de conta: dois pedidos ao mesmo tempo entram um de cada vez e o teto não é ultrapassado.
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
