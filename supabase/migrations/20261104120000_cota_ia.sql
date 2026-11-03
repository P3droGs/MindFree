-- MindFree · cota da IA: o teto do app só vale para as contas invisíveis
-- Antes, um teto de 300 organizações por dia valia para todo mundo. Quem criasse contas invisíveis em série
-- (o login anônimo é livre) esgotava o teto e ninguém mais organizava nada naquele dia, nem quem tem conta.
-- Agora: conta de verdade (e-mail) tem só o limite dela (20 por dia). As invisíveis continuam com 8 por dia
-- cada e dividem um teto de 150 por dia entre todas: quem abusar só trava as outras invisíveis.
-- Para aplicar: o arquivo das contas (20261024120000_contas.sql) precisa ter rodado antes.
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em Run (pode rodar de novo sem problema).

-- Guarda se o uso foi de uma conta invisível, para o teto contar só esses.
alter table public.ai_usage add column if not exists anonymous boolean not null default false;
create index if not exists ai_usage_day_anonymous on public.ai_usage (day) where anonymous;

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
  anonymous_limit integer := 150;
  total integer;
  used integer;
begin
  if me is null then
    return false;
  end if;
  if not permanent then
    select coalesce(sum(u.count), 0) into total from public.ai_usage u where u.day = today and u.anonymous;
    if total >= anonymous_limit then
      return false;
    end if;
  end if;
  insert into public.ai_usage as u (user_id, day, count, anonymous) values (me, today, 1, not permanent)
    on conflict (user_id, day) do update set count = u.count + 1
    returning u.count into used;
  return used <= personal_limit;
end;
$$;
revoke all on function public.consume_ai_quota() from public, anon;
grant execute on function public.consume_ai_quota() to authenticated;
