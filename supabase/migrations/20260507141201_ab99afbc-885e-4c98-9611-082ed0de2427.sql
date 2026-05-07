-- Tabela de perfis de acesso customizáveis
create table if not exists public.access_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  permissions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.access_profiles enable row level security;

create policy "Auth can view access_profiles"
  on public.access_profiles for select
  to authenticated using (true);

create policy "Admins manage access_profiles"
  on public.access_profiles for all
  to authenticated
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));

create trigger trg_access_profiles_updated_at
  before update on public.access_profiles
  for each row execute function public.update_updated_at_column();

-- Vínculo usuário <-> perfil (em user_roles)
alter table public.user_roles
  add column if not exists access_profile_id uuid references public.access_profiles(id) on delete set null;

-- Sync: ao mudar permissões de um perfil, atualiza user_permissions dos usuários vinculados
create or replace function public.sync_access_profile_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.user_permissions
   where user_id in (select user_id from public.user_roles where access_profile_id = NEW.id);

  insert into public.user_permissions (user_id, permission)
  select ur.user_id, p.perm
    from public.user_roles ur
    cross join lateral unnest(NEW.permissions) as p(perm)
   where ur.access_profile_id = NEW.id;

  return NEW;
end;
$$;

drop trigger if exists trg_sync_access_profile_perms on public.access_profiles;
create trigger trg_sync_access_profile_perms
  after update of permissions on public.access_profiles
  for each row execute function public.sync_access_profile_permissions();

-- Sync: ao vincular/atualizar perfil em user_roles, recria user_permissions
create or replace function public.sync_user_role_profile_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.user_permissions where user_id = NEW.user_id;
  if NEW.access_profile_id is not null then
    insert into public.user_permissions (user_id, permission)
    select NEW.user_id, p.perm
      from public.access_profiles ap
      cross join lateral unnest(ap.permissions) as p(perm)
     where ap.id = NEW.access_profile_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_sync_user_role_profile on public.user_roles;
create trigger trg_sync_user_role_profile
  after insert or update of access_profile_id on public.user_roles
  for each row execute function public.sync_user_role_profile_permissions();
