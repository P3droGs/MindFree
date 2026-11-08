-- E-mail de boas-vindas (pedido do dono do produto em 2026-11-08): quando uma conta nasce confirmada, por código
-- de e-mail ou pelo Google, o banco chama a função "boas-vindas", que manda o e-mail pela Resend. Uma vez por
-- conta (tabela welcome_emails). As contas invisíveis (anônimas) ficam de fora.
-- Para aplicar: depois de 20261104130000_seguranca.sql (internal_call_headers) e com o project_url no Vault.
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em Run (pode rodar de novo sem problema).
-- Depois: supabase secrets set RESEND_API_KEY=… e supabase functions deploy boas-vindas --no-verify-jwt.

-- Quem já recebeu. Só a service_role mexe (pela função); ninguém lê pelo app.
create table if not exists public.welcome_emails (
  user_id uuid primary key references auth.users (id) on delete cascade,
  sent_at timestamptz not null default now()
);
alter table public.welcome_emails enable row level security;
revoke all on table public.welcome_emails from public, anon, authenticated;

-- Marca o envio e diz se é a primeira vez (true) ou se já tinha (false).
create or replace function public.welcome_mark(p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.welcome_emails (user_id) values (p_user) on conflict (user_id) do nothing;
  return found;
end;
$$;
revoke all on function public.welcome_mark(uuid) from public, anon, authenticated;
grant execute on function public.welcome_mark(uuid) to service_role;

-- Desfaz a marca quando a Resend recusou, para o próximo disparo tentar de novo.
create or replace function public.welcome_unmark(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.welcome_emails w where w.user_id = p_user;
$$;
revoke all on function public.welcome_unmark(uuid) from public, anon, authenticated;
grant execute on function public.welcome_unmark(uuid) to service_role;

-- O gatilho: conta nova já confirmada (Google) ou conta que acabou de confirmar o e-mail (código).
-- Qualquer erro do pg_net ou do Vault vira WARNING no log, sem atrapalhar o cadastro.
create or replace function public.welcome_on_confirm()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null or new.email_confirmed_at is null or coalesce(new.is_anonymous, false) then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null then
    return new;
  end if;
  perform net.http_post(
    url := (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'project_url') || '/functions/v1/boas-vindas',
    headers := public.internal_call_headers(),
    body := jsonb_build_object('user_id', new.id)
  );
  return new;
exception when others then
  raise warning 'welcome_on_confirm: % (%)', sqlerrm, sqlstate;
  return new;
end;
$$;
drop trigger if exists welcome_on_confirm on auth.users;
create trigger welcome_on_confirm
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.welcome_on_confirm();
