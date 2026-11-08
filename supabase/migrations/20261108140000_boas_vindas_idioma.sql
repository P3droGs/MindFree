-- E-mail de boas-vindas no idioma da pessoa (pedido do dono do produto em 2026-11-08). O app grava o idioma
-- em user_metadata.language: no cadastro por e-mail, junto com o signUp; no Google, logo depois de entrar.
-- O gatilho espera esse idioma antes de chamar a função:
--   - cadastro por e-mail: o idioma já está lá; o e-mail sai quando o código confirma a conta;
--   - Google: a conta nasce confirmada mas sem idioma; o e-mail sai quando o app grava o idioma.
-- Para aplicar: depois de 20261108130000_boas_vindas.sql. Cole inteiro no SQL Editor e clique em Run.

create or replace function public.welcome_on_confirm()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lang text := new.raw_user_meta_data ->> 'language';
  v_confirmed_now boolean;
  v_lang_now boolean;
begin
  if new.email is null or new.email_confirmed_at is null or coalesce(new.is_anonymous, false) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- Conta que nasce confirmada sem idioma (Google): espera o app gravar o idioma.
    if v_lang is null then
      return new;
    end if;
  else
    v_confirmed_now := old.email_confirmed_at is null;
    v_lang_now := (old.raw_user_meta_data ->> 'language') is null and v_lang is not null;
    if not v_confirmed_now and not v_lang_now then
      return new;
    end if;
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
  after insert or update of email_confirmed_at, raw_user_meta_data on auth.users
  for each row execute function public.welcome_on_confirm();
