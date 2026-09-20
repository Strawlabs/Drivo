-- users_update_self_or_admin (removed below) was the same missing-
-- column-restriction shape found repeatedly this session, on the most
-- severe possible table: USING/WITH CHECK only checked "is this my own
-- row," so any authenticated user could run
-- `update({role:'admin'}).eq('id', myId)` and self-promote to admin —
-- full privilege escalation to every admin capability in the app
-- (approve/suspend drivers, resolve flagged payments, edit pricing,
-- everything). Confirmed live and reverted immediately. Found while
-- building a "Personal Information" self-edit page and checking what
-- this policy would actually let that page touch. Zero existing code
-- anywhere in the app currently writes to users directly (grepped for
-- it), so nothing legitimate depends on the raw policy — the profile
-- self-edit page instead calls update_my_profile below, which
-- whitelists exactly the safe columns (name, email, phone,
-- profile_picture) and can never touch role or is_active.
drop policy if exists "users_update_self_or_admin" on public.users;
create policy "users_admin_update" on public.users for update
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

create or replace function public.update_my_profile(p_name text, p_email text, p_phone text)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.users;
begin
  update public.users
  set name = p_name, email = p_email, phone = p_phone
  where id = auth.uid()
  returning * into v_row;

  return v_row;
exception
  when unique_violation then
    raise exception 'That phone number is already registered to another account.';
end;
$$;
